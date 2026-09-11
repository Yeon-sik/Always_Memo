import type { ReactElement } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveRoot, RootErrorBoundary, getBootstrapErrorMessage } from "./main";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ label: "db-editor" }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("application bootstrap fallback", () => {
  it("resolves the DB Editor component for the db-editor window", async () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { __TAURI_INTERNALS__: {} },
      writable: true,
    });

    try {
      const { DbEditorApp } = await import("./features/db-editor/DbEditorApp");
      const application = await resolveRoot();

      expect((application as ReactElement).type).toBe(DbEditorApp);
    } finally {
      if (previousWindow === undefined) {
        Reflect.deleteProperty(globalThis, "window");
      } else {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: previousWindow,
          writable: true,
        });
      }
    }
  });

  it("exposes useful messages for import and native bootstrap failures", () => {
    expect(getBootstrapErrorMessage(new Error("Tauri window metadata missing"))).toBe(
      "Tauri window metadata missing",
    );
    expect(getBootstrapErrorMessage({ message: "module load failed" })).toBe(
      "module load failed",
    );
  });

  it("turns a render exception into a visible alert", () => {
    function ThrowingComponent(): ReactElement {
      throw new Error("DbEditorApp render failed");
    }

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let renderer: ReactTestRenderer;

    expect(() => {
      renderer = create(
        <RootErrorBoundary>
          <ThrowingComponent />
        </RootErrorBoundary>,
      );
    }).not.toThrow();

    expect(
      renderer!.root
        .findAllByType("p")
        .some((node) => node.children.join(" ").includes("DbEditorApp render failed")),
    ).toBe(true);
  });
});
