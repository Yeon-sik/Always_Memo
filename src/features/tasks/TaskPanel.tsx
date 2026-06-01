import { FormEvent, useState } from "react";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import type { Task } from "../../types";

interface TaskPanelProps {
  tasks: Task[];
  onAdd: (text: string) => void;
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string) => void;
  onUpdateText: (taskId: string, text: string) => void;
}

// 체크리스트 목록과 새 항목 입력 폼을 함께 제공하는 하단 패널이다.
export function TaskPanel({
  tasks,
  onAdd,
  onDelete,
  onToggle,
  onUpdateText,
}: TaskPanelProps) {
  const [draft, setDraft] = useState("");

  // 빈 문자열은 항목으로 만들지 않고, 추가 후 입력값을 비운다.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextText = draft.trim();

    if (!nextText) {
      return;
    }

    onAdd(nextText);
    setDraft("");
  }

  return (
    <section className="h-64 shrink-0 border-t border-slate-200 bg-slate-50">
      <div className="flex h-full flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CheckSquare className="h-4 w-4 text-indigo-700" aria-hidden="true" />
            <span>체크리스트</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
              {tasks.length}
            </span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px]">
          <div className="min-h-0 overflow-y-auto px-6 py-3">
            {tasks.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-sm text-slate-500">
                아직 체크리스트가 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex h-11 items-center gap-3 rounded-md border border-slate-200 bg-white px-3"
                  >
                    <input
                      type="checkbox"
                      checked={task.isDone}
                      onChange={() => onToggle(task.id)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700"
                      aria-label="완료 여부"
                    />
                    <input
                      value={task.text}
                      onChange={(event) =>
                        onUpdateText(task.id, event.target.value)
                      }
                      className={
                        task.isDone
                          ? "min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-400 line-through focus:outline-none"
                          : "min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 focus:outline-none"
                      }
                      aria-label="체크리스트 내용"
                    />
                    <button
                      type="button"
                      onClick={() => onDelete(task.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-700"
                      title="할 일 삭제"
                      aria-label="할 일 삭제"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-l border-slate-200 bg-white p-4"
          >
            <label
              htmlFor="task-draft"
              className="text-xs font-semibold text-slate-500"
            >
              새 항목
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="task-draft"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm text-slate-800 placeholder:text-slate-400"
                placeholder="할 일을 입력"
              />
              <button
                type="submit"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-700 text-white transition hover:bg-indigo-800"
                title="체크리스트 추가"
                aria-label="체크리스트 추가"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
