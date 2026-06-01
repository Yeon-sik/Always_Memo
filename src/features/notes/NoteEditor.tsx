import { Clock3 } from "lucide-react";
import type { Note } from "../../types";
import { EmptyState } from "../../components/EmptyState";

interface NoteEditorProps {
  note: Note | null;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
}

// 편집기 상단에는 마지막 수정 시각을 조금 더 자세히 표시한다.
function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

// 선택된 메모의 제목과 본문을 직접 편집하는 중앙 작업 영역이다.
export function NoteEditor({
  note,
  onChangeTitle,
  onChangeContent,
}: NoteEditorProps) {
  if (!note) {
    return (
      <div className="min-h-0 flex-1 p-5">
        <EmptyState
          title="선택된 메모가 없습니다."
          description="왼쪽 목록에서 메모를 선택하거나 새 메모를 만들어 시작하세요."
        />
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="border-b border-slate-200 px-8 py-5">
        <input
          value={note.title}
          onChange={(event) => onChangeTitle(event.target.value)}
          className="w-full border-0 bg-transparent text-2xl font-semibold tracking-normal text-slate-950 placeholder:text-slate-400 focus:outline-none"
          placeholder="메모 제목"
          aria-label="메모 제목"
        />
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
          <span>마지막 수정 {formatUpdatedAt(note.updatedAt)}</span>
          <span className="text-slate-300">|</span>
          <span className="font-mono">device {note.deviceId.slice(0, 8)}</span>
        </div>
      </div>

      <textarea
        value={note.content}
        onChange={(event) => onChangeContent(event.target.value)}
        className="min-h-0 flex-1 resize-none border-0 bg-white px-8 py-6 text-base leading-7 text-slate-800 placeholder:text-slate-400 focus:outline-none"
        placeholder="메모 내용"
        aria-label="메모 내용"
      />
    </section>
  );
}
