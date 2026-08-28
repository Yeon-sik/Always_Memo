use super::error::{DbEditorError, DbEditorErrorCode};
use super::management_api_adapter::{HttpTransport, ManagementApiAdapter};
use super::metadata_adapter::{
    parse_primary_key_columns, quote_identifier, validate_schema_identifier,
};
use super::models::{DbEditorRowsPage, DbEditorTableMetadata};
use serde::Deserialize;
use serde_json::{Map, Value};
use std::collections::HashSet;

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

    /// The identifier is accepted only from a fresh metadata DTO and is
    /// quoted after validation; values use API parameter binding.
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

    pub async fn update_row(
        &self,
        project_ref: &str,
        metadata: &DbEditorTableMetadata,
        identity: &RowIdentity,
        changes: &[ColumnChange],
    ) -> Result<Map<String, Value>, DbEditorError> {
        let (query, parameters) = build_update_row_query(metadata, identity, changes)?;
        let values = self
            .api
            .run_mutation_query(project_ref, &query, parameters)
            .await?;

        validate_affected_rows(values.len())?;
        let row = values.into_iter().next().ok_or_else(|| {
            DbEditorError::new(
                DbEditorErrorCode::InvalidResponse,
                "UPDATE 결과 행을 읽지 못했습니다.",
            )
        })?;

        extract_row_object(row)
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

    let mut column_names = HashSet::new();
    for column in &metadata.columns {
        quote_identifier(&column.name, "컬럼")?;
        if !column_names.insert(column.name.as_str()) {
            return Err(DbEditorError::new(
                DbEditorErrorCode::InvalidResponse,
                "테이블 컬럼 allowlist에 중복된 컬럼이 있습니다.",
            ));
        }
    }

    let primary_key = parse_primary_key_columns(&metadata.columns);
    if primary_key != metadata.primary_key {
        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidResponse,
            "테이블 기본 키 메타데이터가 일치하지 않습니다.",
        ));
    }
    if primary_key.iter().collect::<HashSet<_>>().len() != primary_key.len() {
        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidResponse,
            "테이블 기본 키 메타데이터에 중복된 컬럼이 있습니다.",
        ));
    }

    Ok(())
}

pub fn validate_mutation_metadata(metadata: &DbEditorTableMetadata) -> Result<(), DbEditorError> {
    validate_metadata_allowlist(metadata)?;

    if !metadata
        .table_type
        .trim()
        .eq_ignore_ascii_case("BASE TABLE")
    {
        return Err(DbEditorError::new(
            DbEditorErrorCode::ReadOnlyTable,
            "VIEW에는 행 수정을 적용할 수 없습니다.",
        ));
    }

    if metadata.primary_key.is_empty() {
        return Err(DbEditorError::new(
            DbEditorErrorCode::PrimaryKeyRequired,
            "기본 키가 있는 테이블만 행을 수정할 수 있습니다.",
        ));
    }

    Ok(())
}

pub fn validate_update_request(
    metadata: &DbEditorTableMetadata,
    identity: &RowIdentity,
    changes: &[ColumnChange],
) -> Result<(), DbEditorError> {
    validate_mutation_metadata(metadata)?;
    validate_row_identity(metadata, identity)?;

    if changes.is_empty() {
        return Err(DbEditorError::new(
            DbEditorErrorCode::NoChanges,
            "변경된 컬럼이 없습니다.",
        ));
    }

    let mut changed_columns = HashSet::new();
    for change in changes {
        let column = metadata
            .columns
            .iter()
            .find(|column| column.name == change.name)
            .ok_or_else(|| {
                DbEditorError::new(
                    DbEditorErrorCode::UnknownColumn,
                    "변경 요청에 허용되지 않은 컬럼이 있습니다.",
                )
            })?;

        if !changed_columns.insert(change.name.as_str()) {
            return Err(DbEditorError::new(
                DbEditorErrorCode::InvalidValue,
                "같은 컬럼을 여러 번 변경할 수 없습니다.",
            ));
        }

        if metadata.primary_key.iter().any(|name| name == &change.name)
            || column.is_identity
            || column.is_generated
            || column.default_expression.is_some()
        {
            return Err(DbEditorError::new(
                DbEditorErrorCode::ProtectedColumn,
                "기본 키, identity, generated 또는 서버 기본값 컬럼은 수정할 수 없습니다.",
            ));
        }

        validate_column_value(column, &change.value)?;
    }

    Ok(())
}

fn validate_row_identity(
    metadata: &DbEditorTableMetadata,
    identity: &RowIdentity,
) -> Result<(), DbEditorError> {
    if identity.values.is_empty() {
        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidIdentity,
            "선택 행의 기본 키 identity가 없습니다.",
        ));
    }

    let mut identity_columns = HashSet::new();
    for (name, value) in &identity.values {
        quote_identifier(name, "기본 키 컬럼")?;

        if !metadata.primary_key.iter().any(|column| column == name) {
            return Err(DbEditorError::new(
                DbEditorErrorCode::InvalidIdentity,
                "선택 행의 identity가 현재 기본 키와 일치하지 않습니다.",
            ));
        }

        if !identity_columns.insert(name.as_str()) || value.is_null() {
            return Err(DbEditorError::new(
                DbEditorErrorCode::InvalidIdentity,
                "선택 행의 기본 키 identity가 중복되었거나 null입니다.",
            ));
        }

        let column = metadata
            .columns
            .iter()
            .find(|column| column.name == *name)
            .ok_or_else(|| {
                DbEditorError::new(
                    DbEditorErrorCode::InvalidIdentity,
                    "선택 행의 기본 키 컬럼을 찾을 수 없습니다.",
                )
            })?;
        validate_column_value(column, value)?;
    }

    if metadata
        .primary_key
        .iter()
        .any(|column| !identity_columns.contains(column.as_str()))
    {
        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidIdentity,
            "선택 행의 기본 키 identity가 완전하지 않습니다.",
        ));
    }

    Ok(())
}

fn validate_column_value(
    column: &super::models::DbEditorColumn,
    value: &Value,
) -> Result<(), DbEditorError> {
    if value.is_null() {
        if column.is_nullable {
            return Ok(());
        }

        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidValue,
            "NULL을 허용하지 않는 컬럼입니다.",
        ));
    }

    let data_type = column.data_type.trim().to_ascii_lowercase();
    let udt_name = column.udt_name.trim().to_ascii_lowercase();

    if is_json_type(&data_type, &udt_name) {
        return Ok(());
    }

    if is_boolean_type(&data_type, &udt_name) {
        return expect_value(value.is_boolean(), "boolean 값을 입력하세요.");
    }

    if is_number_type(&data_type, &udt_name) {
        let number = value.as_number();
        if number.is_none() {
            return Err(invalid_value("number 값을 입력하세요."));
        }

        if is_integer_type(&data_type, &udt_name)
            && !number
                .map(|number| number.is_i64() || number.is_u64())
                .unwrap_or(false)
        {
            return Err(invalid_value("정수 값을 입력하세요."));
        }

        return Ok(());
    }

    if is_uuid_type(&data_type, &udt_name) {
        return expect_value(
            value.as_str().map(is_uuid).unwrap_or(false),
            "UUID 값을 입력하세요.",
        );
    }

    if data_type == "date" {
        return expect_value(
            value.as_str().map(is_iso_date).unwrap_or(false),
            "YYYY-MM-DD 형식의 날짜를 입력하세요.",
        );
    }

    if data_type.starts_with("timestamp") {
        return expect_value(
            value.as_str().map(is_timestamp).unwrap_or(false),
            "유효한 timestamp 값을 입력하세요.",
        );
    }

    if is_text_type(&data_type, &udt_name) {
        return expect_value(value.is_string(), "text 값을 입력하세요.");
    }

    Err(DbEditorError::new(
        DbEditorErrorCode::UnsupportedColumnType,
        "이 컬럼 타입은 Phase 2에서 수정할 수 없습니다.",
    ))
}

fn expect_value(condition: bool, message: &str) -> Result<(), DbEditorError> {
    if condition {
        Ok(())
    } else {
        Err(invalid_value(message))
    }
}

fn invalid_value(message: &str) -> DbEditorError {
    DbEditorError::new(DbEditorErrorCode::InvalidValue, message)
}

fn is_text_type(data_type: &str, udt_name: &str) -> bool {
    matches!(
        data_type,
        "text" | "character varying" | "character" | "varchar" | "char" | "bpchar" | "name"
    ) || udt_name == "citext"
}

fn is_number_type(data_type: &str, udt_name: &str) -> bool {
    matches!(
        data_type,
        "smallint" | "integer" | "bigint" | "real" | "double precision" | "numeric" | "decimal"
    ) || matches!(udt_name, "int2" | "int4" | "int8" | "float4" | "float8")
}

fn is_integer_type(data_type: &str, udt_name: &str) -> bool {
    matches!(data_type, "smallint" | "integer" | "bigint")
        || matches!(udt_name, "int2" | "int4" | "int8")
}

fn is_boolean_type(data_type: &str, udt_name: &str) -> bool {
    data_type == "boolean" || udt_name == "bool"
}

fn is_uuid_type(data_type: &str, udt_name: &str) -> bool {
    data_type == "uuid" || udt_name == "uuid"
}

fn is_json_type(data_type: &str, udt_name: &str) -> bool {
    matches!(data_type, "json" | "jsonb") || matches!(udt_name, "json" | "jsonb")
}

fn is_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    let compact = if bytes.len() == 36 {
        bytes
            .iter()
            .enumerate()
            .filter(|(index, _)| matches!(*index, 8 | 13 | 18 | 23))
            .count()
            == 4
            && [8, 13, 18, 23]
                .into_iter()
                .all(|index| bytes.get(index) == Some(&b'-'))
    } else {
        bytes.len() == 32
    };

    if !compact {
        return false;
    }

    bytes
        .iter()
        .filter(|byte| **byte != b'-')
        .all(|byte| byte.is_ascii_hexdigit())
}

fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    let valid_shape = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit());

    if !valid_shape {
        return false;
    }

    let year = value[0..4].parse::<u16>().unwrap_or_default();
    let month = value[5..7].parse::<u8>().unwrap_or_default();
    let day = value[8..10].parse::<u8>().unwrap_or_default();
    let days_in_month = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) => 29,
        2 => 28,
        _ => 0,
    };

    day > 0 && day <= days_in_month
}

fn is_timestamp(value: &str) -> bool {
    if value.len() <= 10 {
        return false;
    }

    let Some(date) = value.get(..10) else {
        return false;
    };

    is_iso_date(date)
        && value[10..]
            .chars()
            .any(|character| character == 'T' || character == ' ')
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

pub fn build_update_row_query(
    metadata: &DbEditorTableMetadata,
    identity: &RowIdentity,
    changes: &[ColumnChange],
) -> Result<(String, Vec<Value>), DbEditorError> {
    validate_update_request(metadata, identity, changes)?;

    let schema = quote_identifier(&metadata.schema, "스키마")?;
    let table = quote_identifier(&metadata.name, "테이블")?;
    let assignments = changes
        .iter()
        .enumerate()
        .map(|(index, change)| {
            quote_identifier(&change.name, "컬럼")
                .map(|column| format!("{column} = ${}", index + 1))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let (predicate, identity_parameters) =
        build_pk_predicate(metadata, identity, changes.len() + 1)?;
    let query = format!(
        "UPDATE {schema}.{table} AS t SET {} WHERE {predicate} RETURNING to_jsonb(t) AS row",
        assignments.join(", ")
    );
    let mut parameters = changes
        .iter()
        .map(|change| change.value.clone())
        .collect::<Vec<_>>();
    parameters.extend(identity_parameters);

    Ok((query, parameters))
}

pub fn build_pk_predicate(
    metadata: &DbEditorTableMetadata,
    identity: &RowIdentity,
    first_parameter: usize,
) -> Result<(String, Vec<Value>), DbEditorError> {
    validate_mutation_metadata(metadata)?;
    validate_row_identity(metadata, identity)?;

    if first_parameter == 0 {
        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidValue,
            "UPDATE parameter 번호가 올바르지 않습니다.",
        ));
    }

    let mut parameters = Vec::with_capacity(metadata.primary_key.len());
    let mut predicates = Vec::with_capacity(metadata.primary_key.len());
    for (offset, column_name) in metadata.primary_key.iter().enumerate() {
        let parameter_index = first_parameter.checked_add(offset).ok_or_else(|| {
            DbEditorError::new(
                DbEditorErrorCode::InvalidValue,
                "UPDATE parameter 수가 허용 범위를 초과했습니다.",
            )
        })?;
        let value = identity
            .values
            .iter()
            .find(|(name, _)| name == column_name)
            .map(|(_, value)| value.clone())
            .ok_or_else(|| {
                DbEditorError::new(
                    DbEditorErrorCode::InvalidIdentity,
                    "선택 행의 기본 키 identity가 완전하지 않습니다.",
                )
            })?;
        let column = quote_identifier(column_name, "기본 키 컬럼")?;
        predicates.push(format!("{column} = ${parameter_index}"));
        parameters.push(value);
    }

    Ok((predicates.join(" AND "), parameters))
}

pub fn validate_affected_rows(affected_rows: usize) -> Result<(), DbEditorError> {
    if affected_rows == 1 {
        return Ok(());
    }

    Err(DbEditorError::new(
        DbEditorErrorCode::AffectedRows,
        "UPDATE 대상 행이 정확히 1개가 아니어서 변경을 적용하지 않았습니다.",
    ))
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

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowIdentity {
    pub values: Vec<(String, Value)>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnChange {
    pub name: String,
    pub value: Value,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRowRequest {
    pub project_ref: String,
    pub schema: String,
    pub table: String,
    pub identity: RowIdentity,
    pub changes: Vec<ColumnChange>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RowMutationPolicy {
    NoPrimaryKey,
    PrimaryKeyScoped,
}

pub fn row_mutation_policy(metadata: &DbEditorTableMetadata) -> RowMutationPolicy {
    if metadata.primary_key.is_empty() {
        RowMutationPolicy::NoPrimaryKey
    } else {
        RowMutationPolicy::PrimaryKeyScoped
    }
}

/// Parses an exact PK identity from a row in metadata primary-key order.
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
        build_pk_predicate, build_select_page_query, build_update_row_query, pagination_ordering,
        parse_row_identity, row_mutation_policy, validate_affected_rows, validate_update_request,
        ColumnChange, RowIdentity, RowMutationPolicy, RowPaginationOrdering,
    };
    use crate::db_editor::{
        error::DbEditorErrorCode,
        models::{DbEditorColumn, DbEditorTableMetadata},
    };
    use serde_json::{json, Value};

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
            DbEditorColumn {
                name: "label".to_string(),
                ordinal_position: 3,
                data_type: "text".to_string(),
                udt_name: "text".to_string(),
                is_nullable: false,
                default_expression: None,
                is_identity: false,
                is_generated: false,
                is_primary_key: false,
                primary_key_position: None,
            },
            DbEditorColumn {
                name: "payload".to_string(),
                ordinal_position: 4,
                data_type: "jsonb".to_string(),
                udt_name: "jsonb".to_string(),
                is_nullable: true,
                default_expression: None,
                is_identity: false,
                is_generated: false,
                is_primary_key: false,
                primary_key_position: None,
            },
            DbEditorColumn {
                name: "computed_value".to_string(),
                ordinal_position: 5,
                data_type: "integer".to_string(),
                udt_name: "int4".to_string(),
                is_nullable: true,
                default_expression: None,
                is_identity: false,
                is_generated: true,
                is_primary_key: false,
                primary_key_position: None,
            },
            DbEditorColumn {
                name: "server_default".to_string(),
                ordinal_position: 6,
                data_type: "text".to_string(),
                udt_name: "text".to_string(),
                is_nullable: false,
                default_expression: Some("'server'::text".to_string()),
                is_identity: false,
                is_generated: false,
                is_primary_key: false,
                primary_key_position: None,
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

    fn identity(values: Vec<(&str, serde_json::Value)>) -> RowIdentity {
        RowIdentity {
            values: values
                .into_iter()
                .map(|(name, value)| (name.to_string(), value))
                .collect(),
        }
    }

    fn label_change(value: serde_json::Value) -> Vec<ColumnChange> {
        vec![ColumnChange {
            name: "label".to_string(),
            value,
        }]
    }

    #[test]
    fn builds_single_pk_update_with_bound_value_and_identity() {
        let metadata = metadata(vec!["tenant_id".to_string()]);
        let row_identity = identity(vec![(
            "tenant_id",
            json!("11111111-1111-1111-1111-111111111111"),
        )]);

        let (query, parameters) =
            build_update_row_query(&metadata, &row_identity, &label_change(json!("updated")))
                .expect("single PK update");

        assert!(query.contains("UPDATE \"public\".\"records\" AS t"));
        assert!(query.contains("SET \"label\" = $1"));
        assert!(query.contains("WHERE \"tenant_id\" = $2"));
        assert!(query.contains("RETURNING to_jsonb(t) AS row"));
        assert_eq!(
            parameters,
            vec![
                json!("updated"),
                json!("11111111-1111-1111-1111-111111111111")
            ]
        );
        assert!(!query.contains("updated"));
    }

    #[test]
    fn builds_composite_pk_predicate_in_metadata_order() {
        let metadata = metadata(vec!["tenant_id".to_string(), "record_id".to_string()]);
        let row_identity = identity(vec![
            ("record_id", json!(42)),
            ("tenant_id", json!("11111111-1111-1111-1111-111111111111")),
        ]);

        let (predicate, parameters) =
            build_pk_predicate(&metadata, &row_identity, 3).expect("composite predicate");

        assert_eq!(predicate, "\"tenant_id\" = $3 AND \"record_id\" = $4");
        assert_eq!(
            parameters,
            vec![json!("11111111-1111-1111-1111-111111111111"), json!(42)]
        );
    }

    #[test]
    fn blocks_pkless_tables_and_views() {
        let pkless = metadata(Vec::new());
        let error = validate_update_request(
            &pkless,
            &identity(vec![(
                "tenant_id",
                json!("11111111-1111-1111-1111-111111111111"),
            )]),
            &label_change(json!("updated")),
        )
        .expect_err("PK-less table must be read-only");
        assert_eq!(error.code, DbEditorErrorCode::PrimaryKeyRequired);

        let mut view = metadata(vec!["tenant_id".to_string()]);
        view.table_type = "VIEW".to_string();
        let error = validate_update_request(
            &view,
            &identity(vec![(
                "tenant_id",
                json!("11111111-1111-1111-1111-111111111111"),
            )]),
            &label_change(json!("updated")),
        )
        .expect_err("VIEW must be read-only");
        assert_eq!(error.code, DbEditorErrorCode::ReadOnlyTable);
    }

    #[test]
    fn blocks_protected_and_unknown_columns_and_empty_changes() {
        let metadata = metadata(vec!["tenant_id".to_string()]);
        let row_identity = identity(vec![(
            "tenant_id",
            json!("11111111-1111-1111-1111-111111111111"),
        )]);

        for column_name in ["tenant_id", "record_id", "computed_value", "server_default"] {
            let error = validate_update_request(
                &metadata,
                &row_identity,
                &[ColumnChange {
                    name: column_name.to_string(),
                    value: json!(1),
                }],
            )
            .expect_err("protected column must be rejected");
            assert_eq!(error.code, DbEditorErrorCode::ProtectedColumn);
        }

        let error = validate_update_request(
            &metadata,
            &row_identity,
            &[ColumnChange {
                name: "not_allowlisted".to_string(),
                value: json!("updated"),
            }],
        )
        .expect_err("unknown column must be rejected");
        assert_eq!(error.code, DbEditorErrorCode::UnknownColumn);

        let error = validate_update_request(&metadata, &row_identity, &[])
            .expect_err("empty changes must be rejected");
        assert_eq!(error.code, DbEditorErrorCode::NoChanges);
    }

    #[test]
    fn validates_nullable_null_and_json_values_without_confusing_empty_text() {
        let metadata = metadata(vec!["tenant_id".to_string()]);
        let row_identity = identity(vec![(
            "tenant_id",
            json!("11111111-1111-1111-1111-111111111111"),
        )]);

        validate_update_request(
            &metadata,
            &row_identity,
            &[
                ColumnChange {
                    name: "label".to_string(),
                    value: json!(""),
                },
                ColumnChange {
                    name: "payload".to_string(),
                    value: json!({"valid": true}),
                },
            ],
        )
        .expect("empty text and JSON object are valid values");

        let error = validate_update_request(
            &metadata,
            &row_identity,
            &[ColumnChange {
                name: "label".to_string(),
                value: Value::Null,
            }],
        )
        .expect_err("non-nullable text must reject SQL NULL");
        assert_eq!(error.code, DbEditorErrorCode::InvalidValue);

        validate_update_request(
            &metadata,
            &row_identity,
            &[ColumnChange {
                name: "payload".to_string(),
                value: Value::Null,
            }],
        )
        .expect("nullable JSON can be SQL NULL");
    }

    #[test]
    fn requires_exactly_one_affected_row() {
        assert!(validate_affected_rows(0).is_err());
        assert!(validate_affected_rows(1).is_ok());
        assert!(validate_affected_rows(2).is_err());
    }
}
