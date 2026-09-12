import React from "react";
import ReactDOM, { type Root } from "react-dom/client";
import { isTauriRuntime } from "./lib/platform/capabilities";
import "./index.css";

function toError(caughtError: unknown): Error {
  if (caughtError instanceof Error) {
    return caughtError;
  }

  if (
    typeof caughtError === "object" &&
    caughtError !== null &&
    "message" in caughtError &&
    typeof caughtError.message === "string"
  ) {
    return new Error(caughtError.message);
  }

  if (typeof caughtError === "string" && caughtError.trim()) {
    return new Error(caughtError);
  }

  return new Error("알 수 없는 bootstrap 오류가 발생했습니다.");
}

export function getBootstrapErrorMessage(caughtError: unknown): string {
  return toError(caughtError).message;
}

export function BootstrapFallback({ error }: { error: unknown }) {
  return (
    <main
      role="alert"
      className="flex h-full min-h-64 items-center justify-center bg-slate-100 p-6 text-slate-900 dark:bg-black dark:text-neutral-100"
    >
      <section className="w-full max-w-xl rounded-lg border border-red-200 bg-white p-5 shadow-sm dark:border-red-900 dark:bg-neutral-950">
        <h1 className="text-base font-semibold">화면을 시작하지 못했습니다.</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-neutral-300">
          앱 초기화 중 오류가 발생했습니다. 앱을 다시 실행해 주세요.
        </p>
        <p className="mt-3 break-words rounded bg-red-50 px-3 py-2 font-mono text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {getBootstrapErrorMessage(error)}
        </p>
      </section>
    </main>
  );
}

function BootstrapLoading() {
  return (
    <main
      role="status"
      className="flex h-full min-h-64 items-center justify-center bg-slate-100 p-6 text-sm text-slate-600 dark:bg-black dark:text-neutral-300"
    >
      앱을 시작하는 중입니다…
    </main>
  );
}

interface RootErrorBoundaryState {
  error: Error | null;
}

export class RootErrorBoundary extends React.Component<
  React.PropsWithChildren,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(caughtError: unknown): RootErrorBoundaryState {
    return { error: toError(caughtError) };
  }

  componentDidCatch(caughtError: unknown, errorInfo: React.ErrorInfo) {
    console.error("Application render failed", caughtError, errorInfo);
  }

  render() {
    if (this.state.error) {
      return <BootstrapFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

function renderDomFallback(caughtError: unknown): void {
  if (typeof document === "undefined") {
    return;
  }

  const container = document.getElementById("root") ?? document.body;
  if (!container) {
    return;
  }

  const fallback = document.createElement("main");
  fallback.setAttribute("role", "alert");
  fallback.style.boxSizing = "border-box";
  fallback.style.height = "100%";
  fallback.style.padding = "24px";
  fallback.style.fontFamily = "sans-serif";
  fallback.style.color = "#991b1b";
  fallback.textContent =
    "화면을 시작하지 못했습니다. " + getBootstrapErrorMessage(caughtError);
  container.replaceChildren(fallback);
}

export async function resolveRoot() {
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

export async function bootstrap(): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.getElementById("root");
  if (!root) {
    renderDomFallback(new Error("#root 요소를 찾을 수 없습니다."));
    return;
  }

  let reactRoot: Root | null = null;

  try {
    reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(
      <React.StrictMode>
        <BootstrapLoading />
      </React.StrictMode>,
    );

    const application = await resolveRoot();

    // Main and DB Editor windows use separate React roots. DB Editor never mounts
    // the local-first memo/sync runtime.
    reactRoot.render(
      <React.StrictMode>
        <RootErrorBoundary>{application}</RootErrorBoundary>
      </React.StrictMode>,
    );
  } catch (caughtError) {
    try {
      if (reactRoot) {
        reactRoot.render(
          <React.StrictMode>
            <BootstrapFallback error={caughtError} />
          </React.StrictMode>,
        );
        return;
      }
    } catch {
      // React itself failed before a fallback could be mounted.
    }

    renderDomFallback(caughtError);
  }
}

if (typeof document !== "undefined") {
  void bootstrap();
}
