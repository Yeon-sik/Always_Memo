import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatLocalDate, parseDateInput } from "../fitness/fitnessDate";

export interface RecordMarkerSet {
  note?: boolean;
  task?: boolean;
  workout?: boolean;
  meal?: boolean;
  weight?: boolean;
}

interface RecordCalendarProps {
  markerByDate: Map<string, RecordMarkerSet>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

function getMonthCells(monthDate: Date): Array<string | null> {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells: Array<string | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(formatLocalDate(new Date(year, month, day)));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getMonthTitle(monthDate: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(monthDate);
}

function isSameMonth(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth()
  );
}

const markerStyles: Array<{
  key: keyof RecordMarkerSet;
  className: string;
  label: string;
}> = [
  {
    key: "note",
    label: "메모",
    className: "border-slate-400 bg-white dark:border-neutral-200 dark:bg-neutral-100",
  },
  {
    key: "task",
    label: "할 일",
    className: "border-transparent bg-sky-400",
  },
  {
    key: "workout",
    label: "운동",
    className: "border-transparent bg-red-500",
  },
  {
    key: "meal",
    label: "식사",
    className: "border-transparent bg-yellow-400",
  },
  {
    key: "weight",
    label: "체중",
    className: "border-transparent bg-emerald-500",
  },
];

export function RecordCalendar({
  markerByDate,
  selectedDate,
  onSelectDate,
}: RecordCalendarProps) {
  const today = formatLocalDate();
  const [visibleMonth, setVisibleMonth] = useState(parseDateInput(selectedDate));
  const monthCells = useMemo(() => getMonthCells(visibleMonth), [visibleMonth]);

  useEffect(() => {
    const selectedMonth = parseDateInput(selectedDate);

    setVisibleMonth((current) =>
      isSameMonth(selectedMonth, current)
        ? current
        : new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1),
    );
  }, [selectedDate]);

  function moveMonth(offset: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function handleTodayClick() {
    const nextToday = formatLocalDate();
    onSelectDate(nextToday);
    setVisibleMonth(parseDateInput(nextToday));
  }

  return (
    <div className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold text-slate-950 dark:text-neutral-50">
            {getMonthTitle(visibleMonth)}
          </div>
          <button
            type="button"
            onClick={handleTodayClick}
            className="mt-1 text-xs font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-200"
          >
            오늘로 이동
          </button>
        </div>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 dark:text-neutral-400">
        {weekDays.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {monthCells.map((date, index) => {
          const markers = date ? markerByDate.get(date) : null;
          const isSelected = date === selectedDate;
          const isToday = date === today;

          return date ? (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={
                isSelected
                  ? "flex aspect-square min-h-16 flex-col items-center justify-between rounded-md border border-teal-600 bg-teal-50 p-1 text-sm font-semibold text-teal-950 dark:border-teal-400 dark:bg-teal-950/50 dark:text-teal-100"
                  : "flex aspect-square min-h-16 flex-col items-center justify-between rounded-md border border-slate-200 bg-white p-1 text-sm text-slate-800 transition hover:border-teal-300 hover:bg-teal-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:border-teal-800 dark:hover:bg-teal-950/30"
              }
            >
              <span
                className={
                  isToday
                    ? "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-black"
                    : "inline-flex h-6 min-w-6 items-center justify-center px-1.5 text-xs font-semibold"
                }
              >
                {Number(date.slice(-2))}
              </span>
              <span className="flex h-3 items-center justify-center gap-0.5">
                {markerStyles.map((marker) =>
                  markers?.[marker.key] ? (
                    <span
                      key={marker.key}
                      title={marker.label}
                      className="inline-flex h-2 w-2 shrink-0 items-center justify-center leading-none"
                    >
                      <span className={`block box-border h-1.5 w-1.5 rounded-full border ${marker.className}`} />
                    </span>
                  ) : null,
                )}
              </span>
            </button>
          ) : (
            <div
              key={`blank-${index}`}
              className="aspect-square min-h-16 rounded-md border border-transparent"
            />
          );
        })}
      </div>
    </div>
  );
}
