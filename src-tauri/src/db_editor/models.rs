use serde::Serialize;
use serde_json::{Map, Value};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEditorProject {
    pub id: Option<String>,
    pub project_ref: String,
    pub name: String,
    pub organization_id: Option<String>,
    pub organization_slug: Option<String>,
    pub region: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEditorSchema {
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEditorTable {
    pub schema: String,
    pub name: String,
    pub table_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEditorColumn {
    pub name: String,
    pub ordinal_position: u32,
    pub data_type: String,
    pub udt_name: String,
    pub is_nullable: bool,
    pub default_expression: Option<String>,
    pub is_identity: bool,
    pub is_generated: bool,
    pub is_primary_key: bool,
    pub primary_key_position: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEditorTableMetadata {
    pub schema: String,
    pub name: String,
    pub table_type: String,
    pub columns: Vec<DbEditorColumn>,
    pub primary_key: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEditorRowsPage {
    pub rows: Vec<Map<String, Value>>,
    pub page: u32,
    pub page_size: u32,
    pub has_next: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEditorPatStatus {
    pub configured: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEditorPatVerification {
    pub valid: bool,
    pub project_count: usize,
}
