import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { Dumbbell, Salad, X } from "lucide-react";
import type { DateRecords } from "../../records/recordAggregation";
import { formatKoreanDate } from "../../fitness/fitnessDate";
import {
  getWorkoutSubcategoryLabel,
  getWorkoutTypeLabel,
} from "../../fitness/fitnessService";
import { formatMetric } from "../../fitness/stats/fitnessStats";
import { QuickActionMemoEditor } from "./QuickActionMemoEditor";
import { QuickActionTaskList } from "./QuickActionTaskList";
import { QuickActionWeightEditor } from "./QuickActionWeightEditor";

interface QuickActionOverlayProps {
  records: DateRecords;
  selectedDate: string;
  onAddNote: (date: string, title: string, content: string) => void;
  onAddTask: (text: string, dueDate: string | null, dueTime: string | null) => void;
  onAddWeightRecord: (date: string, weightKg: number) => void;
  onClose: () => void;
  onToggleTask: (taskId: string) => void;
  onUpdateNote: (
    noteId: string,
    date: string,
    title: string,
    content: string,
  ) => void;
  onUpdateWeightRecord: (recordId: string, weightKg: number) => void;
}

const focusableSelector =
  "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

export function QuickActionOverlay({
  records,
  selectedDate,
  onAddNote,
  onAddTask,
  onAddWeightRecord,
  onClose,
  onToggleTask,
  onUpdateNote,
  onUpdateWeightRecord,
}: QuickActionOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hasAnyRecord =
    records.notes.length +
      records.tasks.length +
      records.workoutRecords.length +
      records.mealRecords.length +
      records.weightRecords.length >
    0;
  const mealSummary = useMemo(() => {
    if (records.mealRecords.length === 0) {
      return null;
    }

    const calories = records.mealRecords.reduce(
      (sum, record) => sum + record.calories,
      0,
    );
    const protein = records.mealRecords.reduce(
      (sum, record) => sum + record.proteinGrams,
      0,
    );

    return {
      calories,
      protein,
    };
  }, [records.mealRecords]);

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
              탭 이동 없이 바로 기록합니다.
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

        {!hasAnyRecord ? (
          <div className="mb-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            이 날짜에는 아직 기록이 없습니다.
          </div>
        ) : null}

        <div className="space-y-3">
          <QuickActionTaskList
            selectedDate={selectedDate}
            tasks={records.tasks}
            onAddTask={onAddTask}
            onToggleTask={onToggleTask}
          />

          <QuickActionMemoEditor
            notes={records.notes}
            selectedDate={selectedDate}
            onAddNote={onAddNote}
            onUpdateNote={onUpdateNote}
          />

          <QuickActionWeightEditor
            records={records.weightRecords}
            selectedDate={selectedDate}
            onAddWeightRecord={onAddWeightRecord}
            onUpdateWeightRecord={onUpdateWeightRecord}
          />

          <section className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
                <Dumbbell className="h-4 w-4 text-red-600" aria-hidden="true" />
                <span>운동 요약</span>
              </div>
              {records.workoutRecords.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-neutral-400">
                  이 날짜에는 아직 기록이 없습니다.
                </div>
              ) : (
                <div className="space-y-1 text-xs text-slate-600 dark:text-neutral-300">
                  {records.workoutRecords.map((record) => (
                    <div key={record.id} className="truncate">
                      {getWorkoutTypeLabel(record)} - {getWorkoutSubcategoryLabel(record)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
                <Salad className="h-4 w-4 text-yellow-600" aria-hidden="true" />
                <span>식사 요약</span>
              </div>
              {mealSummary ? (
                <div className="space-y-1 text-xs text-slate-600 dark:text-neutral-300">
                  <div>{records.mealRecords.length}개 기록</div>
                  <div>{mealSummary.calories.toLocaleString("ko-KR")} kcal</div>
                  <div>단백질 {formatMetric(mealSummary.protein)} g</div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 dark:text-neutral-400">
                  이 날짜에는 아직 기록이 없습니다.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
