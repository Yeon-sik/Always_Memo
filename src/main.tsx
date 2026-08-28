import React from "react";
import ReactDOM from "react-dom/client";
import { isTauriRuntime } from "./lib/platform/capabilities";
import "./index.css";

async function resolveRoot() {
  if (isTauriRuntime()) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    if (getCurrentWindow().label === "db-editor") {
      const { DbEditorApp } = await import("./features/db-editor/DbEditorApp");
      return <DbEditorApp />;
    }
  }

  const { App } = await import("./app/App");
  return <App />;
}

async function bootstrap() {
  const root = document.getElementById("root") as HTMLElement;
  const application = await resolveRoot();

  // Main and DB Editor windows use separate React roots. DB Editor never mounts
  // the local-first memo/sync runtime.
  ReactDOM.createRoot(root).render(
    <React.StrictMode>{application}</React.StrictMode>,
  );
}

void bootstrap();
