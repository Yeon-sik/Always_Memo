export function MarkerLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400"
      aria-label="달력 표시 범례"
    >
      <MarkerLegendItem
        label="메모"
        className="border border-slate-400 bg-white dark:border-neutral-200 dark:bg-neutral-100"
      />
      <MarkerLegendItem label="할 일" className="bg-sky-400" />
      <MarkerLegendItem label="오늘 완료" className="bg-[#FF00FF]" />
      <MarkerLegendItem label="운동" className="bg-red-500" />
      <MarkerLegendItem label="식사" className="bg-yellow-400" />
      <MarkerLegendItem label="체중" className="bg-emerald-500" />
    </div>
  );
}

function MarkerLegendItem({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="inline-flex h-2 w-4 shrink-0 items-center justify-center">
        <span className={`block h-1.5 w-4 rounded-sm ${className}`} />
      </span>
      <span>{label}</span>
    </span>
  );
}
