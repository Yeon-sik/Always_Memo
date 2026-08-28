import { getPlatformCapabilities } from "../../lib/platform/capabilities";
import { normalizeDbEditorError } from "./model";

export const DB_EDITOR_WINDOW_LABEL = "db-editor";

export async function openDbEditorWindow(): Promise<void> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    throw {
      code: "unsupported",
      message: "DB Editor는 데스크톱 Tauri 앱에서만 사용할 수 있습니다.",
      status: null,
      retryAfterSeconds: null,
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("open_db_editor_window");
  } catch (caughtError) {
    throw normalizeDbEditorError(caughtError);
  }
}
