import {
  type FocusEvent as ReactFocusEvent,
  FormEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CalendarCheck,
  CalendarDays,
  Check,
  CheckSquare,
  Clock3,
  GripVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Task } from "../../types";
import { formatLocalDate } from "../fitness/fitnessDate";

type DropPlacement = "before" | "after";
type DraftMode = "today" | "deadline";

interface ChecklistPanelProps {
  tasks: Task[];
  onAdd: (
    text: string,
    dueDate: string | null,
    dueTime: string | null,
    plannedDate?: string | null,
  ) => void;
  onDelete: (taskId: string) => void;
  onReorder: (
    draggedTaskId: string,
    targetTaskId: string,
    placement: DropPlacement,
  ) => void;
  onToggle: (taskId: string) => void;
  onUpdatePlannedDate: (taskId: string, plannedDate: string | null) => void;
  onUpdateSchedule: (
    taskId: string,
    dueDate: string | null,
    dueTime: string | null,
  ) => void;
  onUpdateText: (taskId: string, text: string) => void;
}

export function ChecklistPanel({
  tasks,
  onAdd,
  onDelete,
  onReorder,
  onToggle,
  onUpdatePlannedDate,
  onUpdateSchedule,
  onUpdateText,
}: ChecklistPanelProps) {
  const today = formatLocalDate();
  const todayTasks = tasks.filter((task) => task.plannedDate === today);
  const deadlineTasks = tasks.filter((task) => task.plannedDate !== today);
  const [draftMode, setDraftMode] = useState<DraftMode>("today");
  const [draft, setDraft] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftDueTime, setDraftDueTime] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverPlacement, setDragOverPlacement] =
    useState<DropPlacement>("before");
  const draggedTaskIdRef = useRef<string | null>(null);
  const dragOverTaskIdRef = useRef<string | null>(null);
  const dragOverPlacementRef = useRef<DropPlacement>("before");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isDraftFormVisible =
    isAdding || Boolean(draft) || Boolean(draftDueDate) || Boolean(draftDueTime);
  const canSubmitDraft = draft.trim().length > 0;

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding, draftMode]);

  useEffect(() => {
    if (!draggedTaskId) {
      return;
    }

    function handleWindowPointerMove(event: PointerEvent) {
      event.preventDefault();
      updateDropTarget(event.clientX, event.clientY);
    }

    function handleWindowPointerUp() {
      const sourceTaskId = draggedTaskIdRef.current;
      const targetTaskId = dragOverTaskIdRef.current;

      if (sourceTaskId && targetTaskId && sourceTaskId !== targetTaskId) {
        onReorder(sourceTaskId, targetTaskId, dragOverPlacementRef.current);
      }

      clearDragState();
    }

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleWindowPointerMove, {
      capture: true,
      passive: false,
    });
    window.addEventListener("pointerup", handleWindowPointerUp, {
      capture: true,
    });
    window.addEventListener("pointercancel", handleWindowPointerUp, {
      capture: true,
    });

    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handleWindowPointerMove, {
        capture: true,
      });
      window.removeEventListener("pointerup", handleWindowPointerUp, {
        capture: true,
      });
      window.removeEventListener("pointercancel", handleWindowPointerUp, {
        capture: true,
      });
    };
  }, [draggedTaskId, onReorder]);

  function submitDraft() {
    const nextText = draft.trim();

    if (!nextText) {
      setIsAdding(true);
      return;
    }

    if (draftMode === "today") {
      onAdd(nextText, null, null, today);
    } else {
      const nextDueDate = draftDueDate || null;
      const nextDueTime = nextDueDate ? draftDueTime || null : null;
      onAdd(nextText, nextDueDate, nextDueTime, null);
    }

    setDraft("");
    setDraftDueDate("");
    setDraftDueTime("");
    setIsAdding(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function openDraft(mode: DraftMode) {
    setDraftMode(mode);
    setIsAdding(true);
  }

  function handleHeaderAction() {
    if (!isDraftFormVisible) {
      openDraft("today");
      return;
    }

    submitDraft();
  }

  function handleDraftFormBlur(event: ReactFocusEvent<HTMLFormElement>) {
    const nextFocusedElement = event.relatedTarget;

    if (
      nextFocusedElement instanceof Node &&
      event.currentTarget.contains(nextFocusedElement)
    ) {
      return;
    }

    if (!draft.trim() && !draftDueDate && !draftDueTime) {
      setIsAdding(false);
    }
  }

  function handleDraftDueDateChange(value: string) {
    setDraftDueDate(value);

    if (!value) {
      setDraftDueTime("");
    }
  }

  function updateDropTarget(clientX: number, clientY: number) {
    const sourceTaskId = draggedTaskIdRef.current;
    const target = document.elementFromPoint(clientX, clientY);
    const row = target?.closest<HTMLElement>("[data-task-row-id]");

    if (!sourceTaskId || !row) {
      dragOverTaskIdRef.current = null;
      setDragOverTaskId(null);
      return;
    }

    const targetTaskId = row.dataset.taskRowId ?? null;

    if (!targetTaskId || sourceTaskId === targetTaskId) {
      dragOverTaskIdRef.current = null;
      setDragOverTaskId(null);
      return;
    }

    const bounds = row.getBoundingClientRect();
    const placement =
      clientY < bounds.top + bounds.height / 2 ? "before" : "after";

    dragOverTaskIdRef.current = targetTaskId;
    dragOverPlacementRef.current = placement;
    setDragOverTaskId(targetTaskId);
    setDragOverPlacement(placement);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    taskId: string,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    draggedTaskIdRef.current = taskId;
    dragOverTaskIdRef.current = null;
    dragOverPlacementRef.current = "before";
    setDraggedTaskId(taskId);
    setDragOverTaskId(null);
    setDragOverPlacement("before");
  }

  function clearDragState() {
    draggedTaskIdRef.current = null;
    dragOverTaskIdRef.current = null;
    dragOverPlacementRef.current = "before";
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverPlacement("before");
  }

  function handleDueDateChange(task: Task, value: string) {
    const nextDueDate = value || null;
    onUpdateSchedule(task.id, nextDueDate, nextDueDate ? task.dueTime : null);
  }

  function handleDueTimeChange(task: Task, value: string) {
    onUpdateSchedule(task.id, task.dueDate, value || null);
  }

  function renderTaskList(items: Task[], emptyText: string) {
    if (items.length === 0) {
      return (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          {emptyText}
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {items.map((task) => {
          const isDragging = draggedTaskId === task.id;
          const isDropTarget =
            dragOverTaskId === task.id && draggedTaskId !== task.id;
          const dropTargetClass = isDropTarget
            ? dragOverPlacement === "before"
              ? "border-t-indigo-500 bg-indigo-50 dark:bg-indigo-950/50"
              : "border-b-indigo-500 bg-indigo-50 dark:bg-indigo-950/50"
            : "";

          return (
            <div
              key={task.id}
              data-task-row-id={task.id}
              className={
                isDropTarget
                  ? `flex min-h-[7rem] flex-col gap-2 rounded-md border border-slate-200 px-1.5 py-1.5 shadow-sm dark:border-neutral-800 ${dropTargetClass}`
                  : isDragging
                    ? "flex min-h-[7rem] flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1.5 opacity-60 dark:border-neutral-800 dark:bg-neutral-950"
                    : "flex min-h-[7rem] flex-col gap-2 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 transition hover:border-slate-300 dark:border-neutral-800 dark:bg-black dark:hover:border-neutral-700"
              }
            >
              <div className="flex min-h-8 items-center gap-1.5">
                <button
                  type="button"
                  onPointerDown={(event) => handlePointerDown(event, task.id)}
                  className="inline-flex h-7 w-6 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
                  title="순서 변경"
                  aria-label={`${task.text || "할 일"} 순서 변경`}
                >
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                </button>

                <input
                  type="checkbox"
                  checked={task.isDone}
                  onChange={() => onToggle(task.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700"
                  aria-label="완료 여부"
                />
                <input
                  value={task.text}
                  onChange={(event) => onUpdateText(task.id, event.target.value)}
                  className={
                    task.isDone
                      ? "min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-400 line-through focus:outline-none dark:text-neutral-500"
                      : "min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 focus:outline-none dark:text-neutral-100"
                  }
                  aria-label="할 일 내용"
                />
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePlannedDate(
                      task.id,
                      task.plannedDate === today ? null : today,
                    )
                  }
                  className={
                    task.plannedDate === today
                      ? "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-fuchsia-100 text-fuchsia-700 transition hover:bg-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-200"
                      : "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:text-neutral-500 dark:hover:bg-fuchsia-950/40 dark:hover:text-fuchsia-200"
                  }
                  title={task.plannedDate === today ? "오늘 할 일에서 제거" : "오늘 할 일로 지정"}
                  aria-label={task.plannedDate === today ? "오늘 할 일에서 제거" : "오늘 할 일로 지정"}
                >
                  {task.plannedDate === today ? (
                    <X className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-700 dark:text-neutral-500 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                  title="할 일 삭제"
                  aria-label="할 일 삭제"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-1.5 pl-8">
                <label className="flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                  <CalendarDays
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="sr-only">마감일</span>
                  <input
                    type="date"
                    value={task.dueDate ?? ""}
                    onChange={(event) =>
                      handleDueDateChange(task, event.target.value)
                    }
                    className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-700 focus:outline-none dark:text-neutral-200"
                    aria-label={`${task.text || "할 일"} 마감일`}
                  />
                </label>

                <label className="flex min-w-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                  <Clock3
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="sr-only">마감 시간</span>
                  <input
                    type="time"
                    value={task.dueTime ?? ""}
                    disabled={!task.dueDate}
                    onChange={(event) =>
                      handleDueTimeChange(task, event.target.value)
                    }
                    className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-700 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 dark:text-neutral-200 dark:disabled:text-neutral-600"
                    aria-label={`${task.text || "할 일"} 마감 시간`}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white dark:border-neutral-800 dark:bg-black">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-3 dark:border-neutral-800">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
          <CheckSquare
            className="h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-300"
            aria-hidden="true"
          />
          <span className="truncate">할 일</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-300">
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={handleHeaderAction}
          disabled={isDraftFormVisible && !canSubmitDraft}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-700 text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
          title={isDraftFormVisible ? "할 일 생성" : "오늘 할 일 입력 열기"}
          aria-label={isDraftFormVisible ? "할 일 생성" : "오늘 할 일 입력 열기"}
        >
          {isDraftFormVisible ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        onBlur={handleDraftFormBlur}
        className={
          isDraftFormVisible
            ? "shrink-0 border-b border-slate-200 bg-slate-50 p-2 dark:border-neutral-800 dark:bg-neutral-950"
            : "sr-only"
        }
      >
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-white p-1 dark:border-neutral-800 dark:bg-black">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setDraftMode("today")}
            className={
              draftMode === "today"
                ? "h-8 rounded-md bg-fuchsia-600 text-xs font-semibold text-white"
                : "h-8 rounded-md text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            }
          >
            오늘 할 일
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setDraftMode("deadline")}
            className={
              draftMode === "deadline"
                ? "h-8 rounded-md bg-sky-700 text-xs font-semibold text-white"
                : "h-8 rounded-md text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            }
          >
            기한 내 할 일
          </button>
        </div>
        <label htmlFor="task-draft" className="sr-only">
          할 일
        </label>
        <input
          ref={inputRef}
          id="task-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
          placeholder={
            draftMode === "today" ? "오늘 실제로 할 일" : "마감일이 있는 할 일"
          }
        />
        {draftMode === "deadline" ? (
          <div className="mt-2 grid grid-cols-1 gap-1.5">
            <label className="flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-500 dark:border-neutral-800 dark:bg-black dark:text-neutral-400">
              <CalendarDays
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span className="sr-only">마감일</span>
              <input
                type="date"
                value={draftDueDate}
                onInput={(event) =>
                  handleDraftDueDateChange(event.currentTarget.value)
                }
                onChange={(event) =>
                  handleDraftDueDateChange(event.target.value)
                }
                className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-700 focus:outline-none dark:text-neutral-200"
                aria-label="추가할 할 일 마감일"
              />
            </label>

            <label className="flex min-w-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-500 dark:border-neutral-800 dark:bg-black dark:text-neutral-400">
              <Clock3
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span className="sr-only">마감 시간</span>
              <input
                type="time"
                value={draftDueTime}
                disabled={!draftDueDate}
                onInput={(event) => setDraftDueTime(event.currentTarget.value)}
                onChange={(event) => setDraftDueTime(event.target.value)}
                className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[11px] text-slate-700 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 dark:text-neutral-200 dark:disabled:text-neutral-600"
                aria-label="추가할 할 일 마감 시간"
              />
            </label>
          </div>
        ) : null}
      </form>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">
              오늘 할 일
            </h3>
            <button
              type="button"
              onClick={() => openDraft("today")}
              className="inline-flex h-7 items-center justify-center rounded-md border border-fuchsia-200 px-2 text-[11px] font-semibold text-fuchsia-700 transition hover:bg-fuchsia-50 dark:border-fuchsia-900 dark:text-fuchsia-200 dark:hover:bg-fuchsia-950/50"
            >
              추가
            </button>
          </div>
          {renderTaskList(todayTasks, "오늘 실제로 수행할 일을 추가하세요.")}
        </section>

        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-sky-700 dark:text-sky-300">
              기한 내 할 일
            </h3>
            <button
              type="button"
              onClick={() => openDraft("deadline")}
              className="inline-flex h-7 items-center justify-center rounded-md border border-sky-200 px-2 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-sky-900 dark:text-sky-200 dark:hover:bg-sky-950/50"
            >
              추가
            </button>
          </div>
          {renderTaskList(deadlineTasks, "기한이나 날짜 기준으로 관리할 일을 추가하세요.")}
        </section>
      </div>
    </section>
  );
}
