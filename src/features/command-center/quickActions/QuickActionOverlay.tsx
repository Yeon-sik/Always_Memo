import { useEffect, useRef, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { formatKoreanDate } from "../../fitness/fitnessDate";
import { QuickActionMemoEditor } from "./QuickActionMemoEditor";
import { QuickActionTaskList } from "./QuickActionTaskList";
import { QuickActionWeightEditor } from "./QuickActionWeightEditor";

interface QuickActionOverlayProps {
  selectedDate: string;
  onAddNote: (date: string, title: string, content: string) => void;
  onAddTask: (text: string, dueDate: string | null, dueTime: string | null) => void;
  onAddWeightRecord: (date: string, weightKg: number) => void;
  onClose: () => void;
}

const focusableSelector =
  "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

export function QuickActionOverlay({
  selectedDate,
  onAddNote,
  onAddTask,
  onAddWeightRecord,
  onClose,
}: QuickActionOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      focusableSelector,
    );

    focusable?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !panelRef.current) {
      return;
    }

    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => !element.hasAttribute("disabled"));

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${formatKoreanDate(selectedDate)} 빠른 작업`}
        onKeyDown={handleKeyDown}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-neutral-800 bg-white p-3 shadow-2xl dark:bg-black sm:max-w-xl sm:rounded-lg"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-normal text-cyan-700 dark:text-cyan-300">
              Quick Action
            </div>
            <h2 className="mt-1 truncate text-base font-semibold text-slate-950 dark:text-neutral-50">
              {formatKoreanDate(selectedDate)}
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-neutral-400">
              선택한 날짜에 새 기록만 추가합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            aria-label="닫기"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3">
          <QuickActionTaskList
            selectedDate={selectedDate}
            onAddTask={onAddTask}
          />
          <QuickActionMemoEditor
            selectedDate={selectedDate}
            onAddNote={onAddNote}
          />
          <QuickActionWeightEditor
            selectedDate={selectedDate}
            onAddWeightRecord={onAddWeightRecord}
          />
        </div>
      </div>
    </div>
  );
}
