import type { ReactElement } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RootErrorBoundary, getBootstrapErrorMessage } from "./main";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("application bootstrap fallback", () => {
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
