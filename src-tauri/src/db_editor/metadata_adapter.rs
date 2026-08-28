use super::error::{DbEditorError, DbEditorErrorCode};
use super::management_api_adapter::{HttpTransport, ManagementApiAdapter};
use super::models::{DbEditorColumn, DbEditorSchema, DbEditorTable, DbEditorTableMetadata};
use serde_json::Value;

const SCHEMAS_QUERY: &str = r#"
SELECT nspname AS schema_name
FROM pg_catalog.pg_namespace
WHERE nspname NOT LIKE 'pg_%'
  AND nspname NOT IN (
    'information_schema',
    'auth',
    'storage',
    'realtime',
    'extensions',
    'graphql',
    'graphql_public',
    'vault',
    'cron',
    'net',
    'pgbouncer',
    'pgmq',
    'supabase_functions',
    'supabase_migrations'
  )
ORDER BY nspname
"#;

const TABLES_QUERY: &str = r#"
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = $1
  AND table_type IN ('BASE TABLE', 'VIEW')
ORDER BY table_name
"#;

const COLUMNS_QUERY: &str = r#"
SELECT
  c.column_name,
  c.ordinal_position,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.is_identity,
  c.is_generated,
  pk.primary_key_position
FROM information_schema.columns AS c
LEFT JOIN (
  SELECT
    ns.nspname AS schema_name,
    cls.relname AS table_name,
    attrs.attname AS column_name,
    array_position(idx.indkey, attrs.attnum) AS primary_key_position
  FROM pg_catalog.pg_class AS cls
  JOIN pg_catalog.pg_namespace AS ns ON ns.oid = cls.relnamespace
  JOIN pg_catalog.pg_index AS idx
    ON idx.indrelid = cls.oid
   AND idx.indisprimary
  JOIN pg_catalog.pg_attribute AS attrs
    ON attrs.attrelid = cls.oid
   AND attrs.attnum = ANY(idx.indkey)
) AS pk
  ON pk.schema_name = c.table_schema
 AND pk.table_name = c.table_name
 AND pk.column_name = c.column_name
WHERE c.table_schema = $1
  AND c.table_name = $2
ORDER BY c.ordinal_position
"#;

pub const BLOCKED_SCHEMA_NAMES: &[&str] = &[
    "pg_catalog",
    "information_schema",
    "auth",
    "storage",
    "realtime",
    "extensions",
    "graphql",
    "graphql_public",
    "vault",
    "cron",
    "net",
    "pgbouncer",
    "pgmq",
    "supabase_functions",
    "supabase_migrations",
    "pg_toast",
];

pub fn is_blocked_schema(value: &str) -> bool {
    let normalized = value.trim().to_ascii_lowercase();

    normalized.starts_with("pg_")
        || BLOCKED_SCHEMA_NAMES
            .iter()
            .any(|blocked| *blocked == normalized)
}

pub fn validate_identifier(value: &str, label: &str) -> Result<String, DbEditorError> {
    let value = value.trim();
    let mut bytes = value.bytes();
    let first = bytes.next();

    let valid_first = first
        .map(|byte| byte.is_ascii_alphabetic() || byte == b'_')
        .unwrap_or(false);
    let valid_rest = bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_');

    if value.is_empty() || value.len() > 63 || !valid_first || !valid_rest {
        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidIdentifier,
            format!("{label} 식별자가 올바르지 않습니다."),
        ));
    }

    Ok(value.to_string())
}

pub fn validate_schema_identifier(value: &str) -> Result<String, DbEditorError> {
    let value = validate_identifier(value, "스키마")?;

    if is_blocked_schema(&value) {
        return Err(DbEditorError::new(
            DbEditorErrorCode::BlockedSchema,
            "시스템 스키마에는 접근할 수 없습니다.",
        ));
    }

    Ok(value)
}

pub fn quote_identifier(value: &str, label: &str) -> Result<String, DbEditorError> {
    let value = validate_identifier(value, label)?;
    Ok(format!("\"{value}\""))
}

pub struct MetadataAdapter<T> {
    api: ManagementApiAdapter<T>,
}

impl<T> MetadataAdapter<T>
where
    T: HttpTransport,
{
    pub fn new(api: ManagementApiAdapter<T>) -> Self {
        Self { api }
    }

    pub async fn list_schemas(
        &self,
        project_ref: &str,
    ) -> Result<Vec<DbEditorSchema>, DbEditorError> {
        let rows = self
            .api
            .run_read_only_query(project_ref, SCHEMAS_QUERY, Vec::new())
            .await?;
        let mut schemas = rows
            .into_iter()
            .filter_map(|row| {
                row.get("schema_name")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .filter_map(|name| validate_schema_identifier(&name).ok())
            .map(|name| DbEditorSchema { name })
            .collect::<Vec<_>>();

        schemas.sort_by(|left, right| left.name.cmp(&right.name));
        schemas.dedup_by(|left, right| left.name == right.name);
        Ok(schemas)
    }

    pub async fn list_tables(
        &self,
        project_ref: &str,
        schema: &str,
    ) -> Result<Vec<DbEditorTable>, DbEditorError> {
        let schema = validate_schema_identifier(schema)?;
        let rows = self
            .api
            .run_read_only_query(
                project_ref,
                TABLES_QUERY,
                vec![Value::String(schema.clone())],
            )
            .await?;
        let mut tables = rows
            .into_iter()
            .filter_map(|row| {
                let name = row.get("table_name").and_then(Value::as_str)?;
                let table_type = row.get("table_type").and_then(Value::as_str)?;
                validate_identifier(name, "테이블")
                    .ok()
                    .map(|name| DbEditorTable {
                        schema: schema.clone(),
                        name,
                        table_type: table_type.to_string(),
                    })
            })
            .collect::<Vec<_>>();

        tables.sort_by(|left, right| left.name.cmp(&right.name));
        tables.dedup_by(|left, right| left.name == right.name);
        Ok(tables)
    }

    pub async fn get_table_metadata(
        &self,
        project_ref: &str,
        schema: &str,
        table: &str,
    ) -> Result<DbEditorTableMetadata, DbEditorError> {
        let schema = validate_schema_identifier(schema)?;
        let table = validate_identifier(table, "테이블")?;
        let table_entry = self
            .list_tables(project_ref, &schema)
            .await?
            .into_iter()
            .find(|entry| entry.name == table)
            .ok_or_else(|| {
                DbEditorError::new(
                    DbEditorErrorCode::TableNotFound,
                    "선택한 테이블을 찾을 수 없습니다.",
                )
            })?;
        let rows = self
            .api
            .run_read_only_query(
                project_ref,
                COLUMNS_QUERY,
                vec![Value::String(schema.clone()), Value::String(table.clone())],
            )
            .await?;
        let columns = rows
            .into_iter()
            .map(parse_column)
            .collect::<Result<Vec<_>, _>>()?;

        if columns.is_empty() {
            return Err(DbEditorError::new(
                DbEditorErrorCode::InvalidResponse,
                "선택한 테이블의 컬럼 메타데이터가 비어 있습니다.",
            ));
        }

        let primary_key = parse_primary_key_columns(&columns);

        Ok(DbEditorTableMetadata {
            schema,
            name: table,
            table_type: table_entry.table_type,
            columns,
            primary_key,
        })
    }
}

fn parse_column(row: Value) -> Result<DbEditorColumn, DbEditorError> {
    let object = row.as_object().ok_or_else(|| {
        DbEditorError::new(
            DbEditorErrorCode::InvalidResponse,
            "컬럼 메타데이터 행 형식이 올바르지 않습니다.",
        )
    })?;
    let name = required_string(object.get("column_name"), "컬럼")?;
    let ordinal_position = required_u32(object.get("ordinal_position"), "컬럼 순서")?;
    let data_type = required_string(object.get("data_type"), "데이터 타입")?;
    let udt_name = required_string(object.get("udt_name"), "내부 데이터 타입")?;
    let is_nullable = object
        .get("is_nullable")
        .and_then(Value::as_str)
        .map(|value| value.eq_ignore_ascii_case("YES"))
        .unwrap_or(false);
    let default_expression = object
        .get("column_default")
        .and_then(Value::as_str)
        .map(str::to_string);
    let is_identity = object
        .get("is_identity")
        .and_then(Value::as_str)
        .map(|value| !value.eq_ignore_ascii_case("NO"))
        .unwrap_or(false);
    let is_generated = object
        .get("is_generated")
        .and_then(Value::as_str)
        .map(|value| value.eq_ignore_ascii_case("ALWAYS"))
        .unwrap_or(false);
    let primary_key_position = object.get("primary_key_position").and_then(value_as_u32);

    validate_identifier(&name, "컬럼")?;

    Ok(DbEditorColumn {
        name,
        ordinal_position,
        data_type,
        udt_name,
        is_nullable,
        default_expression,
        is_identity,
        is_generated,
        is_primary_key: primary_key_position.is_some(),
        primary_key_position,
    })
}

pub fn parse_primary_key_columns(columns: &[DbEditorColumn]) -> Vec<String> {
    let mut primary_key = columns
        .iter()
        .filter_map(|column| {
            column
                .primary_key_position
                .map(|position| (position, column.name.clone()))
        })
        .collect::<Vec<_>>();

    primary_key.sort_by_key(|(position, _)| *position);
    primary_key.into_iter().map(|(_, name)| name).collect()
}

fn required_string(value: Option<&Value>, label: &str) -> Result<String, DbEditorError> {
    value
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| {
            DbEditorError::new(
                DbEditorErrorCode::InvalidResponse,
                format!("{label} 메타데이터가 없습니다."),
            )
        })
}

fn required_u32(value: Option<&Value>, label: &str) -> Result<u32, DbEditorError> {
    value.and_then(value_as_u32).ok_or_else(|| {
        DbEditorError::new(
            DbEditorErrorCode::InvalidResponse,
            format!("{label} 메타데이터가 없습니다."),
        )
    })
}

fn value_as_u32(value: &Value) -> Option<u32> {
    value
        .as_u64()
        .and_then(|number| u32::try_from(number).ok())
        .or_else(|| value.as_i64().and_then(|number| u32::try_from(number).ok()))
}

#[cfg(test)]
mod tests {
    use super::{
        is_blocked_schema, parse_primary_key_columns, quote_identifier, validate_identifier,
        validate_schema_identifier,
    };
    use crate::db_editor::models::DbEditorColumn;

    fn column(name: &str, position: Option<u32>) -> DbEditorColumn {
        DbEditorColumn {
            name: name.to_string(),
            ordinal_position: 1,
            data_type: "text".to_string(),
            udt_name: "text".to_string(),
            is_nullable: false,
            default_expression: None,
            is_identity: false,
            is_generated: false,
            is_primary_key: position.is_some(),
            primary_key_position: position,
        }
    }

    #[test]
    fn blocks_system_schema_names_and_pg_prefixes() {
        for schema in [
            "pg_catalog",
            "information_schema",
            "auth",
            "storage",
            "realtime",
            "supabase_migrations",
            "pg_toast",
            "pg_temp_42",
        ] {
            assert!(is_blocked_schema(schema));
            assert!(validate_schema_identifier(schema).is_err());
        }

        assert!(!is_blocked_schema("public"));
        assert_eq!(
            validate_schema_identifier(" public ").expect("public"),
            "public"
        );
    }

    #[test]
    fn validates_and_quotes_identifiers() {
        assert_eq!(
            quote_identifier("daily_records", "테이블").expect("valid identifier"),
            "\"daily_records\""
        );
        for value in ["", "1table", "table-name", "table\"name", "table.name"] {
            assert!(validate_identifier(value, "테이블").is_err());
        }
    }

    #[test]
    fn parses_composite_primary_key_in_constraint_order() {
        let columns = vec![
            column("tenant_id", Some(2)),
            column("record_id", Some(1)),
            column("label", None),
        ];

        assert_eq!(
            parse_primary_key_columns(&columns),
            vec!["record_id".to_string(), "tenant_id".to_string()]
        );
    }
}
