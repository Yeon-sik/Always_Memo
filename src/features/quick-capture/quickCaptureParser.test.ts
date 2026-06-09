import { describe, expect, it } from "vitest";
import { parseQuickCaptureDraft } from "./quickCaptureParser";

describe("parseQuickCaptureDraft", () => {
  it("keeps task mode as the default save target", () => {
    expect(parseQuickCaptureDraft("운동 예약", "task")).toEqual({
      content: "운동 예약",
      mode: "task",
      title: "",
    });
  });

  it("uses #memo prefix to save a memo from task mode", () => {
    expect(parseQuickCaptureDraft("#memo 회의 메모\n다음 액션", "task")).toEqual({
      content: "회의 메모\n다음 액션",
      mode: "memo",
      title: "회의 메모",
    });
  });

  it("rejects empty drafts", () => {
    expect(parseQuickCaptureDraft("   ", "task")).toBeNull();
    expect(parseQuickCaptureDraft("#memo   ", "task")).toBeNull();
  });
});
