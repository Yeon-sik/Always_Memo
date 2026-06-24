import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatLocalDate, parseDateInput } from "../fitness/fitnessDate";
import type { CalendarMarkerSet, CalendarMarkers } from "./recordAggregation";

interface RecordCalendarProps {
  markerByDate: CalendarMarkers;
  selectedDate: string;
  visibleMonth: string;
  onSelectDate: (date: string) => void;
  onVisibleMonthChange: (date: string) => void;
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

const markerStyles: Array<{
  key: keyof CalendarMarkerSet;
  className: string;
  label: string;
}> = [
  {
    key: "notes",
    label: "메모",
    className: "border-slate-400 bg-white dark:border-neutral-200 dark:bg-neutral-100",
  },
  {
    key: "tasks",
    label: "할 일",
    className: "border-transparent bg-sky-400",
  },
  {
    key: "workouts",
    label: "운동",
    className: "border-transparent bg-red-500",
  },
  {
    key: "meals",
    label: "식사",
    className: "border-transparent bg-yellow-400",
  },
  {
    key: "weights",
    label: "체중",
    className: "border-transparent bg-emerald-500",
  },
];

const calendarCellSize = "h-[clamp(4.25rem,13vw,5.25rem)] min-w-0";
const calendarCellBase =
  `${calendarCellSize} flex flex-col justify-between gap-1 ` +
  "rounded-md border-2 px-1 py-1 text-xs";

export function RecordCalendar({
  markerByDate,
  selectedDate,
  visibleMonth,
  onSelectDate,
  onVisibleMonthChange,
}: RecordCalendarProps) {
  const today = formatLocalDate();
  const visibleMonthDate = useMemo(
    () => parseDateInput(visibleMonth),
    [visibleMonth],
  );
  const monthCells = useMemo(() => getMonthCells(visibleMonthDate), [visibleMonthDate]);

  function moveMonth(offset: number) {
    onVisibleMonthChange(
      formatLocalDate(
        new Date(
          visibleMonthDate.getFullYear(),
          visibleMonthDate.getMonth() + offset,
          1,
        ),
      ),
    );
  }

  function handleTodayClick() {
    const nextToday = formatLocalDate();
    onSelectDate(nextToday);
    onVisibleMonthChange(nextToday);
  }

  return (
    <div className="rounded-md border border-slate-300 bg-white p-2 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold text-slate-950 dark:text-neutral-50">
            {getMonthTitle(visibleMonthDate)}
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
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-slate-500 dark:text-neutral-400">
        {weekDays.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
        {monthCells.map((date, index) => {
          const markers = date ? markerByDate[date] : null;
          const isSelected = date === selectedDate;
          const isToday = date === today;

          return date ? (
            <button
              key={date}
              type="button"
              onClick={() => {
                onSelectDate(date);
              }}
              className={
                isSelected
                  ? `${calendarCellBase} border-teal-600 bg-teal-50 font-semibold text-teal-950 dark:border-teal-400 dark:bg-teal-950/50 dark:text-teal-100`
                  : `${calendarCellBase} border-slate-200 bg-white text-slate-800 transition hover:border-teal-300 hover:bg-teal-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:border-teal-800 dark:hover:bg-teal-950/30`
              }
            >
              <span
                className={
                  isToday
                    ? "inline-flex h-5 min-w-5 items-center justify-center self-center rounded-full bg-slate-900 px-1 text-[11px] font-semibold text-white dark:bg-neutral-100 dark:text-black"
                    : "inline-flex h-5 min-w-5 items-center justify-center self-center px-1 text-[11px] font-semibold"
                }
              >
                {Number(date.slice(-2))}
              </span>
              <span className="flex min-h-0 flex-1 w-full flex-col-reverse justify-start gap-0.5 overflow-hidden">
                {markerStyles.map((marker) => (
                  <span
                    key={marker.key}
                    title={markers?.[marker.key] ? marker.label : undefined}
                    className={
                      markers?.[marker.key]
                        ? `block h-4 w-full rounded-sm border-2 ${marker.className}`
                        : "block h-4 w-full rounded-sm border-2 border-slate-200 bg-transparent dark:border-neutral-700"
                    }
                    aria-hidden={!markers?.[marker.key]}
                  />
                ))}
              </span>
            </button>
          ) : (
            <div
              key={`blank-${index}`}
              className={`${calendarCellSize} rounded-md border-2 border-transparent`}
            />
          );
        })}
      </div>
    </div>
  );
}
