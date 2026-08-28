import type {
  DbEditorPatStatus,
  DbEditorPatVerification,
  DbEditorProject,
  DbEditorRow,
  DbEditorRowsPage,
  DbEditorSchema,
  DbEditorTable,
  DbEditorTableMetadata,
  DbEditorUpdateRowRequest,
} from "./types";

type TauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

async function getInvoke(): Promise<TauriInvoke> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke as TauriInvoke;
}

export const dbEditorApi = {
  async getPatStatus(): Promise<DbEditorPatStatus> {
    return (await getInvoke())<DbEditorPatStatus>("db_editor_pat_status");
  },

  async savePat(pat: string): Promise<DbEditorPatStatus> {
    return (await getInvoke())<DbEditorPatStatus>("db_editor_save_pat", {
      pat,
    });
  },

  async verifyPat(): Promise<DbEditorPatVerification> {
    return (await getInvoke())<DbEditorPatVerification>(
      "db_editor_verify_pat",
    );
  },

  async deletePat(): Promise<DbEditorPatStatus> {
    return (await getInvoke())<DbEditorPatStatus>("db_editor_delete_pat");
  },

  async listProjects(): Promise<DbEditorProject[]> {
    return (await getInvoke())<DbEditorProject[]>("db_editor_list_projects");
  },

  async listSchemas(projectRef: string): Promise<DbEditorSchema[]> {
    return (await getInvoke())<DbEditorSchema[]>("db_editor_list_schemas", {
      projectRef,
    });
  },

  async listTables(
    projectRef: string,
    schema: string,
  ): Promise<DbEditorTable[]> {
    return (await getInvoke())<DbEditorTable[]>("db_editor_list_tables", {
      projectRef,
      schema,
    });
  },

  async getTableMetadata(
    projectRef: string,
    schema: string,
    table: string,
  ): Promise<DbEditorTableMetadata> {
    return (await getInvoke())<DbEditorTableMetadata>(
      "db_editor_get_table_metadata",
      {
        projectRef,
        schema,
        table,
      },
    );
  },

  async listRows(
    projectRef: string,
    schema: string,
    table: string,
    page: number,
    pageSize: number,
  ): Promise<DbEditorRowsPage> {
    return (await getInvoke())<DbEditorRowsPage>("db_editor_list_rows", {
      projectRef,
      schema,
      table,
      page,
      pageSize,
    });
  },

  async updateRow(request: DbEditorUpdateRowRequest): Promise<DbEditorRow> {
    return (await getInvoke())<DbEditorRow>("update_db_row", { request });
  },
};
