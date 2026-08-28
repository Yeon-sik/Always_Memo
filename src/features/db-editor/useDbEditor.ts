import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { dbEditorApi } from "./api";
import {
  createRequestGenerationGuard,
  initialDbEditorModel,
  resetForPatChange,
  selectProject as selectProjectModel,
  selectSchema as selectSchemaModel,
  selectTable as selectTableModel,
  setResourceError,
  setResourceLoading,
  setResourceReady,
  setRowsPage,
  type DbEditorModelState,
  type DbEditorResource,
} from "./model";
import type {
  DbEditorError,
  DbEditorProject,
  DbEditorRowsPage,
  DbEditorSchema,
  DbEditorTable,
  DbEditorTableMetadata,
} from "./types";
import { normalizeDbEditorError } from "./model";

type Action =
  | { type: "patLoading" }
  | { type: "patStatus"; configured: boolean; verified: boolean }
  | { type: "patChanged"; configured: boolean }
  | { type: "patVerificationFailed"; error: DbEditorError }
  | { type: "projectsLoaded"; projects: DbEditorProject[] }
  | { type: "schemasLoaded"; schemas: DbEditorSchema[] }
  | { type: "tablesLoaded"; tables: DbEditorTable[] }
  | { type: "metadataLoaded"; metadata: DbEditorTableMetadata }
  | { type: "rowsLoaded"; rows: DbEditorRowsPage }
  | { type: "resourceLoading"; resource: DbEditorResource }
  | { type: "resourceError"; resource: DbEditorResource; error: DbEditorError }
  | { type: "projectSelected"; projectRef: string | null }
  | { type: "schemaSelected"; schema: string | null }
  | { type: "tableSelected"; tableName: string | null };

const EXPLORER_RESOURCES: readonly DbEditorResource[] = [
  "projects",
  "schemas",
  "tables",
  "metadata",
  "rows",
];

function resetResource(
  state: DbEditorModelState,
  resource: DbEditorResource,
): DbEditorModelState {
  return {
    ...state,
    resources: {
      ...state.resources,
      [resource]: { status: "idle", error: null },
    },
  };
}

function reduceDbEditorModel(
  state: DbEditorModelState,
  action: Action,
): DbEditorModelState {
  switch (action.type) {
    case "patLoading":
      return setResourceLoading(state, "pat");
    case "patStatus":
      return {
        ...setResourceReady(
          { ...state, patConfigured: action.configured },
          "pat",
        ),
        patConfigured: action.configured,
        patVerified: action.verified,
      };
    case "patChanged":
      return resetForPatChange(action.configured);
    case "patVerificationFailed":
      return resetForPatChange(state.patConfigured, action.error);
    case "projectsLoaded":
      return {
        ...setResourceReady(state, "projects"),
        projects: action.projects,
      };
    case "schemasLoaded":
      return {
        ...setResourceReady(state, "schemas"),
        schemas: action.schemas,
      };
    case "tablesLoaded":
      return {
        ...setResourceReady(state, "tables"),
        tables: action.tables,
      };
    case "metadataLoaded":
      return {
        ...setResourceReady(state, "metadata"),
        metadata: action.metadata,
      };
    case "rowsLoaded":
      return setRowsPage(state, action.rows);
    case "resourceLoading":
      return setResourceLoading(state, action.resource);
    case "resourceError":
      return setResourceError(state, action.resource, action.error);
    case "projectSelected": {
      let next = selectProjectModel(state, action.projectRef);
      for (const resource of ["schemas", "tables", "metadata", "rows"] as const) {
        next = resetResource(next, resource);
      }
      return next;
    }
    case "schemaSelected": {
      let next = selectSchemaModel(state, action.schema);
      for (const resource of ["tables", "metadata", "rows"] as const) {
        next = resetResource(next, resource);
      }
      return next;
    }
    case "tableSelected": {
      let next = selectTableModel(state, action.tableName);
      for (const resource of ["metadata", "rows"] as const) {
        next = resetResource(next, resource);
      }
      return next;
    }
  }
}

export function useDbEditor() {
  const [state, dispatch] = useReducer(
    reduceDbEditorModel,
    initialDbEditorModel,
  );
  const [patInput, setPatInput] = useState("");
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const requestGuard = useRef(createRequestGenerationGuard());

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  const runResource = useCallback(
    async function runResource<T>(
      resource: DbEditorResource,
      operation: () => Promise<T>,
      onSuccess: (value: T) => void,
    ): Promise<T | null> {
      const request = requestGuard.current.begin(resource);
      dispatch({ type: "resourceLoading", resource });

      try {
        const value = await operation();
        if (!requestGuard.current.isCurrent(request)) {
          return null;
        }
        onSuccess(value);
        return value;
      } catch (caughtError) {
        if (!requestGuard.current.isCurrent(request)) {
          return null;
        }
        dispatch({
          type: "resourceError",
          resource,
          error: normalizeDbEditorError(caughtError),
        });
        return null;
      }
    },
    [],
  );

  const invalidateResources = useCallback(
    (resources: readonly DbEditorResource[]) => {
      requestGuard.current.invalidate(resources);
    },
    [],
  );

  const refreshPatStatus = useCallback(async () => {
    const request = requestGuard.current.begin("pat");
    dispatch({ type: "patLoading" });

    try {
      const status = await dbEditorApi.getPatStatus();
      if (!requestGuard.current.isCurrent(request)) {
        return;
      }
      dispatch({
        type: "patStatus",
        configured: status.configured,
        verified: false,
      });
    } catch (caughtError) {
      if (!requestGuard.current.isCurrent(request)) {
        return;
      }
      dispatch({
        type: "resourceError",
        resource: "pat",
        error: normalizeDbEditorError(caughtError),
      });
    }
  }, []);

  useEffect(() => {
    void refreshPatStatus();
  }, [refreshPatStatus]);

  const savePat = useCallback(async () => {
    const value = patInput.trim();
    if (!value) {
      dispatch({
        type: "resourceError",
        resource: "pat",
        error: {
          code: "invalidPat",
          message: "Supabase PAT를 입력하세요.",
          status: null,
          retryAfterSeconds: null,
        },
      });
      return false;
    }

    const request = requestGuard.current.begin("pat");
    dispatch({ type: "patLoading" });

    try {
      const status = await dbEditorApi.savePat(value);
      if (!requestGuard.current.isCurrent(request)) {
        return false;
      }
      requestGuard.current.invalidate(EXPLORER_RESOURCES);
      dispatch({ type: "patChanged", configured: status.configured });
      setPatInput("");
      return true;
    } catch (caughtError) {
      if (!requestGuard.current.isCurrent(request)) {
        return false;
      }
      dispatch({
        type: "resourceError",
        resource: "pat",
        error: normalizeDbEditorError(caughtError),
      });
      return false;
    }
  }, [patInput]);

  const verifyPat = useCallback(async () => {
    const request = requestGuard.current.begin("pat");
    dispatch({ type: "patLoading" });

    try {
      await dbEditorApi.verifyPat();
      if (!requestGuard.current.isCurrent(request)) {
        return false;
      }
      dispatch({ type: "patStatus", configured: true, verified: true });
      return true;
    } catch (caughtError) {
      if (!requestGuard.current.isCurrent(request)) {
        return false;
      }
      const error = normalizeDbEditorError(caughtError);
      requestGuard.current.invalidate(EXPLORER_RESOURCES);
      dispatch({ type: "patVerificationFailed", error });
      return false;
    }
  }, []);

  const deletePat = useCallback(async () => {
    const request = requestGuard.current.begin("pat");
    dispatch({ type: "patLoading" });

    try {
      const status = await dbEditorApi.deletePat();
      if (!requestGuard.current.isCurrent(request)) {
        return false;
      }
      requestGuard.current.invalidate(EXPLORER_RESOURCES);
      dispatch({ type: "patChanged", configured: status.configured });
      setPatInput("");
      return true;
    } catch (caughtError) {
      if (!requestGuard.current.isCurrent(request)) {
        return false;
      }
      dispatch({
        type: "resourceError",
        resource: "pat",
        error: normalizeDbEditorError(caughtError),
      });
      return false;
    }
  }, []);

  const loadProjects = useCallback(
    () =>
      runResource("projects", dbEditorApi.listProjects, (projects) =>
        dispatch({ type: "projectsLoaded", projects }),
      ),
    [runResource],
  );

  const loadSchemas = useCallback(
    (projectRef: string) =>
      runResource("schemas", () => dbEditorApi.listSchemas(projectRef), (schemas) =>
        dispatch({ type: "schemasLoaded", schemas }),
      ),
    [runResource],
  );

  const loadTables = useCallback(
    (projectRef: string, schema: string) =>
      runResource(
        "tables",
        () => dbEditorApi.listTables(projectRef, schema),
        (tables) => dispatch({ type: "tablesLoaded", tables }),
      ),
    [runResource],
  );

  const loadMetadata = useCallback(
    (projectRef: string, schema: string, table: string) =>
      runResource(
        "metadata",
        () => dbEditorApi.getTableMetadata(projectRef, schema, table),
        (metadata) => dispatch({ type: "metadataLoaded", metadata }),
      ),
    [runResource],
  );

  const loadRows = useCallback(
    (
      projectRef: string,
      schema: string,
      table: string,
      page: number,
      pageSize: number,
    ) =>
      runResource(
        "rows",
        () => dbEditorApi.listRows(projectRef, schema, table, page, pageSize),
        (rows) => dispatch({ type: "rowsLoaded", rows }),
      ),
    [runResource],
  );

  const selectProject = useCallback(
    async (projectRef: string | null) => {
      invalidateResources(["schemas", "tables", "metadata", "rows"]);
      dispatch({ type: "projectSelected", projectRef });
      if (projectRef) {
        await loadSchemas(projectRef);
      }
    },
    [invalidateResources, loadSchemas],
  );

  const selectSchema = useCallback(
    async (schema: string | null) => {
      invalidateResources(["tables", "metadata", "rows"]);
      dispatch({ type: "schemaSelected", schema });
      const projectRef = state.navigator.selectedProjectRef;
      if (projectRef && schema) {
        await loadTables(projectRef, schema);
      }
    },
    [invalidateResources, loadTables, state.navigator.selectedProjectRef],
  );

  const selectTable = useCallback(
    async (tableName: string | null) => {
      invalidateResources(["metadata", "rows"]);
      dispatch({ type: "tableSelected", tableName });
      const { selectedProjectRef, selectedSchema } = state.navigator;
      if (!selectedProjectRef || !selectedSchema || !tableName) {
        return;
      }

      const metadata = await loadMetadata(
        selectedProjectRef,
        selectedSchema,
        tableName,
      );
      if (metadata) {
        await loadRows(
          selectedProjectRef,
          selectedSchema,
          tableName,
          0,
          state.pagination.pageSize,
        );
      }
    },
    [
      invalidateResources,
      loadMetadata,
      loadRows,
      state.navigator,
      state.pagination.pageSize,
    ],
  );

  const refreshRows = useCallback(
    (page = state.pagination.page) => {
      const { selectedProjectRef, selectedSchema, selectedTableName } =
        state.navigator;
      if (!selectedProjectRef || !selectedSchema || !selectedTableName) {
        return Promise.resolve(null);
      }

      return loadRows(
        selectedProjectRef,
        selectedSchema,
        selectedTableName,
        page,
        state.pagination.pageSize,
      );
    },
    [loadRows, state.navigator, state.pagination.page, state.pagination.pageSize],
  );

  return {
    ...state,
    isOnline,
    patInput,
    setPatInput,
    refreshPatStatus,
    savePat,
    verifyPat,
    deletePat,
    loadProjects,
    selectProject,
    selectSchema,
    selectTable,
    refreshRows,
  };
}
