use super::error::{DbEditorError, DbEditorErrorCode};
use super::management_api_adapter::{HttpTransport, ManagementApiAdapter};
use super::metadata_adapter::{
    parse_primary_key_columns, quote_identifier, validate_schema_identifier,
};
use super::models::{DbEditorRowsPage, DbEditorTableMetadata};
use serde_json::{Map, Value};

pub const DEFAULT_PAGE_SIZE: u32 = 50;
pub const MAX_PAGE_SIZE: u32 = 200;

pub struct DatabaseCrudAdapter<T> {
    api: ManagementApiAdapter<T>,
}

impl<T> DatabaseCrudAdapter<T>
where
    T: HttpTransport,
{
    pub fn new(api: ManagementApiAdapter<T>) -> Self {
        Self { api }
    }

    /// Phase 1 exposes only SELECT. The identifier is accepted only from a
    /// fresh metadata DTO and is quoted after validation; values use API
    /// parameter binding.
    pub async fn select_page(
        &self,
        project_ref: &str,
        metadata: &DbEditorTableMetadata,
        page: u32,
        page_size: u32,
    ) -> Result<DbEditorRowsPage, DbEditorError> {
        validate_metadata_allowlist(metadata)?;
        let (query, parameters) = build_select_page_query(metadata, page, page_size)?;
        let values = self
            .api
            .run_read_only_query(project_ref, &query, parameters)
            .await?;
        let mut rows = values
            .into_iter()
            .map(extract_row_object)
            .collect::<Result<Vec<_>, _>>()?;
        let has_next = rows.len() > page_size as usize;

        if has_next {
            rows.truncate(page_size as usize);
        }

        Ok(DbEditorRowsPage {
            rows,
            page,
            page_size,
            has_next,
        })
    }
}

pub fn validate_metadata_allowlist(metadata: &DbEditorTableMetadata) -> Result<(), DbEditorError> {
    validate_schema_identifier(&metadata.schema)?;
    quote_identifier(&metadata.name, "테이블")?;

    if metadata.columns.is_empty() {
        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidResponse,
            "테이블 컬럼 allowlist가 비어 있습니다.",
        ));
    }

    for column in &metadata.columns {
        quote_identifier(&column.name, "컬럼")?;
    }

    let primary_key = parse_primary_key_columns(&metadata.columns);
    if primary_key != metadata.primary_key {
        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidResponse,
            "테이블 기본 키 메타데이터가 일치하지 않습니다.",
        ));
    }

    Ok(())
}

pub fn validate_page(page: u32, page_size: u32) -> Result<(), DbEditorError> {
    if page_size == 0 || page_size > MAX_PAGE_SIZE {
        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidPage,
            format!("페이지 크기는 1에서 {MAX_PAGE_SIZE} 사이여야 합니다."),
        ));
    }

    let _ = (page as u64).checked_mul(page_size as u64).ok_or_else(|| {
        DbEditorError::new(
            DbEditorErrorCode::InvalidPage,
            "페이지 offset이 허용 범위를 초과했습니다.",
        )
    })?;

    Ok(())
}

pub fn build_select_page_query(
    metadata: &DbEditorTableMetadata,
    page: u32,
    page_size: u32,
) -> Result<(String, Vec<Value>), DbEditorError> {
    validate_page(page, page_size)?;
    validate_metadata_allowlist(metadata)?;

    let schema = quote_identifier(&metadata.schema, "스키마")?;
    let table = quote_identifier(&metadata.name, "테이블")?;
    let limit = page_size + 1;
    let offset = (page as u64)
        .checked_mul(page_size as u64)
        .and_then(|value| i64::try_from(value).ok())
        .ok_or_else(|| {
            DbEditorError::new(
                DbEditorErrorCode::InvalidPage,
                "페이지 offset이 허용 범위를 초과했습니다.",
            )
        })?;
    let order_by = match pagination_ordering(metadata)? {
        RowPaginationOrdering::PrimaryKey(primary_key) => {
            let quoted_columns = primary_key
                .iter()
                .map(|column| quote_identifier(column, "컬럼"))
                .collect::<Result<Vec<_>, _>>()?;
            format!(" ORDER BY {}", quoted_columns.join(", "))
        }
        RowPaginationOrdering::Unordered => String::new(),
    };
    let query = format!(
        "SELECT to_jsonb(t) AS row FROM {schema}.{table} AS t \
         {order_by}LIMIT $1 OFFSET $2"
    );

    Ok((query, vec![Value::from(limit), Value::from(offset)]))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RowPaginationOrdering {
    PrimaryKey(Vec<String>),
    Unordered,
}

/// Tables without a primary key remain readable, but their page order is not
/// deterministic because no safe, allowlisted ordering key exists.
pub fn pagination_ordering(
    metadata: &DbEditorTableMetadata,
) -> Result<RowPaginationOrdering, DbEditorError> {
    validate_metadata_allowlist(metadata)?;

    if metadata.primary_key.is_empty() {
        Ok(RowPaginationOrdering::Unordered)
    } else {
        Ok(RowPaginationOrdering::PrimaryKey(
            metadata.primary_key.clone(),
        ))
    }
}

#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub struct RowIdentity {
    pub values: Vec<(String, Value)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum RowMutationPolicy {
    NoPrimaryKey,
    PrimaryKeyScoped,
}

#[allow(dead_code)]
pub fn row_mutation_policy(metadata: &DbEditorTableMetadata) -> RowMutationPolicy {
    if metadata.primary_key.is_empty() {
        RowMutationPolicy::NoPrimaryKey
    } else {
        RowMutationPolicy::PrimaryKeyScoped
    }
}

/// Parses an exact PK identity for future PK-scoped UPDATE/DELETE commands.
/// Phase 1 does not register mutation commands.
#[allow(dead_code)]
pub fn parse_row_identity(
    metadata: &DbEditorTableMetadata,
    row: &Map<String, Value>,
) -> Result<Option<RowIdentity>, DbEditorError> {
    if metadata.primary_key.is_empty() {
        return Ok(None);
    }

    let mut values = Vec::with_capacity(metadata.primary_key.len());
    for column in &metadata.primary_key {
        let value = row.get(column).ok_or_else(|| {
            DbEditorError::new(
                DbEditorErrorCode::InvalidResponse,
                "선택한 행에 기본 키 값이 없습니다.",
            )
        })?;

        if value.is_null() {
            return Err(DbEditorError::new(
                DbEditorErrorCode::InvalidResponse,
                "선택한 행의 기본 키 값이 null입니다.",
            ));
        }

        values.push((column.clone(), value.clone()));
    }

    Ok(Some(RowIdentity { values }))
}

fn extract_row_object(value: Value) -> Result<Map<String, Value>, DbEditorError> {
    let value = match value {
        Value::Object(mut object) if object.len() == 1 && object.contains_key("row") => {
            object.remove("row").unwrap_or(Value::Null)
        }
        value => value,
    };

    value.as_object().cloned().ok_or_else(|| {
        DbEditorError::new(
            DbEditorErrorCode::InvalidResponse,
            "행 응답 형식이 올바르지 않습니다.",
        )
    })
}

#[cfg(test)]
mod tests {
    use super::{
        build_select_page_query, pagination_ordering, parse_row_identity, row_mutation_policy,
        RowMutationPolicy, RowPaginationOrdering,
    };
    use crate::db_editor::models::{DbEditorColumn, DbEditorTableMetadata};
    use serde_json::json;

    fn metadata(primary_key: Vec<String>) -> DbEditorTableMetadata {
        let columns = vec![
            DbEditorColumn {
                name: "tenant_id".to_string(),
                ordinal_position: 1,
                data_type: "uuid".to_string(),
                udt_name: "uuid".to_string(),
                is_nullable: false,
                default_expression: None,
                is_identity: false,
                is_generated: false,
                is_primary_key: primary_key.iter().any(|name| name == "tenant_id"),
                primary_key_position: primary_key
                    .iter()
                    .position(|name| name == "tenant_id")
                    .map(|position| position as u32 + 1),
            },
            DbEditorColumn {
                name: "record_id".to_string(),
                ordinal_position: 2,
                data_type: "integer".to_string(),
                udt_name: "int4".to_string(),
                is_nullable: false,
                default_expression: None,
                is_identity: true,
                is_generated: false,
                is_primary_key: primary_key.iter().any(|name| name == "record_id"),
                primary_key_position: primary_key
                    .iter()
                    .position(|name| name == "record_id")
                    .map(|position| position as u32 + 1),
            },
        ];

        DbEditorTableMetadata {
            schema: "public".to_string(),
            name: "records".to_string(),
            table_type: "BASE TABLE".to_string(),
            columns,
            primary_key,
        }
    }

    #[test]
    fn builds_bound_pagination_query_from_allowlisted_identifiers() {
        let (query, parameters) =
            build_select_page_query(&metadata(vec!["tenant_id".to_string()]), 2, 25)
                .expect("query");

        assert!(query.contains("\"public\".\"records\""));
        assert!(query.contains("ORDER BY \"tenant_id\""));
        assert!(!query.contains("to_jsonb(t)::text"));
        assert!(query.contains("LIMIT $1 OFFSET $2"));
        assert_eq!(parameters, vec![json!(26), json!(50)]);
    }

    #[test]
    fn orders_composite_primary_keys_in_metadata_order() {
        let (query, _) = build_select_page_query(
            &metadata(vec!["tenant_id".to_string(), "record_id".to_string()]),
            0,
            50,
        )
        .expect("query");

        assert!(query.contains("ORDER BY \"tenant_id\", \"record_id\""));
    }

    #[test]
    fn keeps_pkless_pagination_readable_without_claiming_deterministic_order() {
        let metadata = metadata(Vec::new());
        let (query, _) = build_select_page_query(&metadata, 1, 50).expect("query");

        assert!(!query.contains("ORDER BY"));
        assert!(!query.contains("to_jsonb(t)::text"));
        assert_eq!(
            pagination_ordering(&metadata).expect("ordering"),
            RowPaginationOrdering::Unordered
        );
    }

    #[test]
    fn parses_composite_row_identity_in_pk_order() {
        let metadata = metadata(vec!["tenant_id".to_string(), "record_id".to_string()]);
        let row = [("record_id", json!(42)), ("tenant_id", json!("tenant-a"))]
            .into_iter()
            .map(|(key, value)| (key.to_string(), value))
            .collect();

        let identity = parse_row_identity(&metadata, &row)
            .expect("identity")
            .expect("composite PK");

        assert_eq!(
            identity.values,
            vec![
                ("tenant_id".to_string(), json!("tenant-a")),
                ("record_id".to_string(), json!(42)),
            ]
        );
    }

    #[test]
    fn marks_pkless_tables_as_non_mutable() {
        assert_eq!(
            row_mutation_policy(&metadata(Vec::new())),
            RowMutationPolicy::NoPrimaryKey
        );
        assert_eq!(
            row_mutation_policy(&metadata(vec!["record_id".to_string()])),
            RowMutationPolicy::PrimaryKeyScoped
        );
    }
}
