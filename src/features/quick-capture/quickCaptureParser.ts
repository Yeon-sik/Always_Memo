export type QuickCaptureMode = "task" | "memo";

export interface ParsedQuickCaptureDraft {
  content: string;
  mode: QuickCaptureMode;
  title: string;
}

function stripMemoPrefix(value: string): string {
  return value.replace(/^#memo\b/i, "").trim();
}

function getMemoTitle(content: string): string {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine?.slice(0, 40) || "Quick Memo";
}

// 입력값과 선택 모드를 실제 저장 대상(task/memo)으로 해석한다.
export function parseQuickCaptureDraft(
  draft: string,
  selectedMode: QuickCaptureMode,
): ParsedQuickCaptureDraft | null {
  const trimmedDraft = draft.trim();

  if (!trimmedDraft) {
    return null;
  }

  const isMemoPrefix = /^#memo\b/i.test(trimmedDraft);
  const mode: QuickCaptureMode =
    selectedMode === "memo" || isMemoPrefix ? "memo" : "task";
  const content = mode === "memo" ? stripMemoPrefix(trimmedDraft) : trimmedDraft;

  if (!content) {
    return null;
  }

  return {
    content,
    mode,
    title: mode === "memo" ? getMemoTitle(content) : "",
  };
}
