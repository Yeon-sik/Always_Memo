import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { ThemeMode } from "../../app/useThemeMode";

interface AppearanceSettingsSectionProps {
  themeMode: ThemeMode;
  onChangeThemeMode: (themeMode: ThemeMode) => void;
}

const THEME_OPTIONS = [
  { value: "system", label: "시스템", Icon: Monitor },
  { value: "light", label: "화이트", Icon: Sun },
  { value: "dark", label: "다크", Icon: Moon },
] satisfies Array<{
  value: ThemeMode;
  label: string;
  Icon: LucideIcon;
}>;

export function AppearanceSettingsSection({
  themeMode,
  onChangeThemeMode,
}: AppearanceSettingsSectionProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
        <Sun
          className="h-4 w-4 text-amber-600 dark:text-amber-300"
          aria-hidden="true"
        />
        <span>화면 모드</span>
      </div>

      <div className="mt-3 grid grid-cols-3 rounded-md border border-slate-200 bg-slate-100 p-1 dark:border-neutral-800 dark:bg-neutral-950">
        {THEME_OPTIONS.map(({ value, label, Icon }) => {
          const isSelected = themeMode === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => onChangeThemeMode(value)}
              className={
                isSelected
                  ? "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-white px-2 text-xs font-semibold text-slate-950 shadow-sm transition dark:bg-neutral-800 dark:text-white"
                  : "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-slate-600 transition hover:bg-white/70 hover:text-slate-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              }
              aria-pressed={isSelected}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
