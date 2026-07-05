import { Plus, StickyNote, Trash2 } from "lucide-react";
import type { Note } from "../../types";
import {
  getNoteDisplayTitle,
  getPlainTextFromNoteContent,
} from "./noteService";

interface NoteListProps {
  notes: Note[];
  selectedNoteId: string | null;
  isLoading: boolean;
  onCreate: () => void;
  onDelete: (noteId: string) => void;
  onSelect: (noteId: string) => void;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NoteList({
  notes,
  selectedNoteId,
  isLoading,
  onCreate,
  onDelete,
  onSelect,
}: NoteListProps) {
  return (
    <aside className="flex min-h-0 w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <StickyNote className="h-4 w-4 text-teal-700" aria-hidden="true" />
          <span>메모</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {notes.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-700 text-white transition hover:bg-teal-800"
          title="새 메모"
          aria-label="새 메모"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            로컬 데이터를 불러오는 중입니다.
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            아직 메모가 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => {
              const isSelected = note.id === selectedNoteId;

              return (
                <div
                  key={note.id}
                  className={
                    isSelected
                      ? "group flex items-start gap-3 rounded-md border border-teal-200 bg-teal-50 px-3 py-3 shadow-sm"
                      : "group flex items-start gap-3 rounded-md border border-transparent bg-white px-3 py-3 transition hover:border-slate-200 hover:bg-slate-50"
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSelect(note.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {getNoteDisplayTitle(note)}
                    </div>
                    <div className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">
                      {getPlainTextFromNoteContent(note.content) || "내용 없음"}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {formatDate(note.updatedAt)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(note.id);
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-700 group-hover:opacity-100"
                    title="메모 삭제"
                    aria-label="메모 삭제"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
