import { getPlatformCapabilities } from "../../../lib/platform/capabilities";
import { normalizeDbEditorError } from "../../db-editor/model";

export const PROJECT_WORKSPACE_WINDOW_LABEL = "project-workspace";

export async function openProjectWorkspaceWindow(): Promise<void> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    throw {
      code: "unsupported",
      message: "Project Workspace는 데스크톱 Tauri 앱에서만 사용할 수 있습니다.",
      status: null,
      retryAfterSeconds: null,
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("open_project_workspace_window");
  } catch (caughtError) {
    throw normalizeDbEditorError(caughtError);
  }
}
