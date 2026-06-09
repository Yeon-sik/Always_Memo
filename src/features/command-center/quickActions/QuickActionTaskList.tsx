import { FormEvent, useState } from "react";
import { CheckSquare, Plus } from "lucide-react";
import type { Task } from "../../../types";

interface QuickActionTaskListProps {
  selectedDate: string;
  tasks: Task[];
  onAddTask: (text: string, dueDate: string | null, dueTime: string | null) => void;
  onToggleTask: (taskId: string) => void;
}

export function QuickActionTaskList({
  selectedDate,
  tasks,
  onAddTask,
  onToggleTask,
}: QuickActionTaskListProps) {
  const [draft, setDraft] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = draft.trim();

    if (!text) {
      return;
    }

    onAddTask(text, selectedDate, null);
    setDraft("");
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
        <CheckSquare className="h-4 w-4 text-sky-500" aria-hidden="true" />
        <span>할 일</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          이 날짜에는 아직 기록이 없습니다.
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((task) => (
            <label
              key={task.id}
              className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-2 py-2 dark:border-neutral-800"
            >
              <input
                type="checkbox"
                checked={task.isDone}
                onChange={() => onToggleTask(task.id)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700"
              />
              <span
                className={
                  task.isDone
                    ? "min-w-0 flex-1 truncate text-sm text-slate-400 line-through dark:text-neutral-500"
                    : "min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-neutral-100"
                }
              >
                {task.text}
              </span>
            </label>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
          placeholder="이 날짜에 할 일 추가"
        />
        <button
          type="submit"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-700 text-white transition hover:bg-sky-800"
          title="할 일 추가"
          aria-label="할 일 추가"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
