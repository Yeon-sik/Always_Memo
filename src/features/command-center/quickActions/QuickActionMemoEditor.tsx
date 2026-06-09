import { type FormEvent, type KeyboardEvent, useState } from "react";
import { Plus, StickyNote } from "lucide-react";

interface QuickActionMemoEditorProps {
  selectedDate: string;
  onAddNote: (date: string, title: string, content: string) => void;
}

export function QuickActionMemoEditor({
  selectedDate,
  onAddNote,
}: QuickActionMemoEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  function handleTextareaSave(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!title.trim() && !content.trim()) {
      return;
    }

    onAddNote(selectedDate, title, content);
    setTitle("");
    setContent("");
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
        <StickyNote className="h-4 w-4 text-slate-500 dark:text-neutral-200" aria-hidden="true" />
        <span>메모 추가</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
          placeholder="메모 제목"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleTextareaSave}
          className="h-20 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900 placeholder:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
          placeholder="메모 내용"
        />
        <button
          type="submit"
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          메모 추가
        </button>
      </form>
    </section>
  );
}
