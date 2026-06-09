import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Plus, Save, StickyNote } from "lucide-react";
import type { Note } from "../../../types";

interface QuickActionMemoEditorProps {
  notes: Note[];
  selectedDate: string;
  onAddNote: (date: string, title: string, content: string) => void;
  onUpdateNote: (
    noteId: string,
    date: string,
    title: string,
    content: string,
  ) => void;
}

function getNoteTitle(note: Note): string {
  return note.title.trim() || "제목 없는 메모";
}

export function QuickActionMemoEditor({
  notes,
  selectedDate,
  onAddNote,
  onUpdateNote,
}: QuickActionMemoEditorProps) {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(
    notes[0]?.id ?? null,
  );
  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId) ?? null,
    [activeNoteId, notes],
  );
  const [editTitle, setEditTitle] = useState(activeNote?.title ?? "");
  const [editContent, setEditContent] = useState(activeNote?.content ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  useEffect(() => {
    if (!activeNoteId || !notes.some((note) => note.id === activeNoteId)) {
      setActiveNoteId(notes[0]?.id ?? null);
    }
  }, [activeNoteId, notes]);

  useEffect(() => {
    setEditTitle(activeNote?.title ?? "");
    setEditContent(activeNote?.content ?? "");
  }, [activeNote]);

  function handleTextareaSave(
    event: KeyboardEvent<HTMLTextAreaElement>,
    save: () => void,
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
    }
  }

  function handleUpdateSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!activeNote) {
      return;
    }

    onUpdateNote(activeNote.id, selectedDate, editTitle, editContent);
  }

  function handleCreateSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!newTitle.trim() && !newContent.trim()) {
      return;
    }

    onAddNote(selectedDate, newTitle, newContent);
    setNewTitle("");
    setNewContent("");
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
        <StickyNote className="h-4 w-4 text-slate-500 dark:text-neutral-200" aria-hidden="true" />
        <span>메모</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          {notes.length}
        </span>
      </div>

      {notes.length > 0 ? (
        <form onSubmit={handleUpdateSubmit} className="space-y-2">
          {notes.length > 1 ? (
            <select
              value={activeNoteId ?? ""}
              onChange={(event) => setActiveNoteId(event.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-neutral-800 dark:bg-black dark:text-neutral-100"
              aria-label="편집할 메모 선택"
            >
              {notes.map((note) => (
                <option key={note.id} value={note.id}>
                  {getNoteTitle(note)}
                </option>
              ))}
            </select>
          ) : null}
          <input
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
            placeholder="메모 제목"
          />
          <textarea
            value={editContent}
            onChange={(event) => setEditContent(event.target.value)}
            onKeyDown={(event) =>
              handleTextareaSave(event, () => handleUpdateSubmit())
            }
            className="h-24 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900 placeholder:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
            placeholder="메모 내용"
          />
          <button
            type="submit"
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-neutral-100 dark:text-black dark:hover:bg-white"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            메모 저장
          </button>
        </form>
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          이 날짜에는 아직 기록이 없습니다.
        </div>
      )}

      <form onSubmit={handleCreateSubmit} className="mt-3 space-y-2">
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
          placeholder="새 메모 제목"
        />
        <textarea
          value={newContent}
          onChange={(event) => setNewContent(event.target.value)}
          onKeyDown={(event) =>
            handleTextareaSave(event, () => handleCreateSubmit())
          }
          className="h-20 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900 placeholder:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
          placeholder="새 메모 내용"
        />
        <button
          type="submit"
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          새 메모 추가
        </button>
      </form>
    </section>
  );
}
