import {
  CheckSquare,
  Dumbbell,
  Salad,
  Scale,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

export type QuickActionSection = "task" | "memo" | "weight" | "workout" | "meal";

const quickActionSections: Array<{
  id: QuickActionSection;
  label: string;
  Icon: LucideIcon;
}> = [
  { id: "task", label: "할 일", Icon: CheckSquare },
  { id: "memo", label: "메모", Icon: StickyNote },
  { id: "weight", label: "체중", Icon: Scale },
  { id: "workout", label: "운동", Icon: Dumbbell },
  { id: "meal", label: "식단", Icon: Salad },
];

interface QuickActionModeTabsProps {
  activeSection: QuickActionSection;
  onChange: (section: QuickActionSection) => void;
}

// 빠른 작업은 한 화면에 폼을 모두 펼치지 않고, 추가 목적별 섹션만 전환합니다.
export function QuickActionModeTabs({
  activeSection,
  onChange,
}: QuickActionModeTabsProps) {
  return (
    <div
      className="mb-3 grid grid-cols-5 gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-neutral-800 dark:bg-neutral-950"
      role="tablist"
      aria-label="빠른 작업 종류"
    >
      {quickActionSections.map(({ id, label, Icon }) => {
        const isActive = id === activeSection;

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={
              isActive
                ? "inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-md bg-slate-950 px-1 text-xs font-semibold text-white shadow-sm dark:bg-neutral-100 dark:text-black"
                : "inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-950 dark:text-neutral-400 dark:hover:bg-black dark:hover:text-neutral-50"
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
