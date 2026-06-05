import {
  CalendarDays,
  Cloud,
  CloudOff,
  Dumbbell,
  HardDrive,
  Monitor,
  NotebookTabs,
  RefreshCw,
  Settings,
} from "lucide-react";
import type { Device } from "../types";
import type { SyncStatus } from "../lib/sync/syncTypes";

export type SaveState = "idle" | "saving" | "saved" | "error";
export type HeaderView = "records" | "memo" | "fitness" | "settings";

interface HeaderBarProps {
  activeView: HeaderView;
  device: Device | null;
  syncStatus: SyncStatus;
  saveState: SaveState;
  onChangeView: (view: HeaderView) => void;
}

const viewItems: Array<{
  view: HeaderView;
  label: string;
  icon: typeof NotebookTabs;
}> = [
  { view: "records", label: "기록", icon: CalendarDays },
  { view: "memo", label: "메모", icon: NotebookTabs },
  { view: "fitness", label: "운동", icon: Dumbbell },
];

function getSaveLabel(saveState: SaveState): string {
  if (saveState === "saving") {
    return "저장 중";
  }

  if (saveState === "error") {
    return "저장 실패";
  }

  if (saveState === "saved") {
    return "자동 저장됨";
  }

  return "대기 중";
}

function getSyncClasses(mode: SyncStatus["mode"]): string {
  if (mode === "synced") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (mode === "syncing") {
    return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
  }

  if (mode === "error") {
    return "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-300";
}

export function HeaderBar({
  activeView,
  device,
  syncStatus,
  saveState,
  onChangeView,
}: HeaderBarProps) {
  const SyncIcon =
    syncStatus.mode === "offline" || syncStatus.mode === "local-only"
      ? CloudOff
      : syncStatus.mode === "syncing"
        ? RefreshCw
        : Cloud;

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 dark:border-neutral-900 dark:bg-black">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-normal text-slate-950 dark:text-neutral-50">
            Yeonsik's Note
          </h1>
          <p className="truncate text-[11px] text-slate-500 dark:text-neutral-400">
            로컬 우선 개인 기록 앱
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <nav
            className="grid h-9 shrink-0 grid-cols-3 rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs dark:border-neutral-800 dark:bg-neutral-950"
            aria-label="주요 화면"
          >
            {viewItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;

              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => onChangeView(item.view)}
                  className={
                    isActive
                      ? "inline-flex min-w-16 items-center justify-center gap-1.5 rounded bg-white px-2 font-semibold text-slate-950 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                      : "inline-flex min-w-16 items-center justify-center gap-1.5 rounded px-2 font-semibold text-slate-500 transition hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                  }
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => onChangeView("settings")}
            className={
              activeView === "settings"
                ? "inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-950 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
                : "inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 transition hover:text-slate-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100"
            }
            aria-current={activeView === "settings" ? "page" : undefined}
            aria-label="설정"
            title="설정"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-slate-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-300">
          <Monitor
            className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">
            {device?.name ?? "기기 확인 중"}
          </span>
        </div>

        <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-slate-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-300">
          <HardDrive
            className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">{getSaveLabel(saveState)}</span>
        </div>

        <div
          className={`flex h-8 min-w-0 items-center gap-1.5 rounded-md border px-2 ${getSyncClasses(
            syncStatus.mode,
          )}`}
          title={syncStatus.detail}
        >
          <SyncIcon
            className={
              syncStatus.mode === "syncing"
                ? "h-4 w-4 shrink-0 animate-spin"
                : "h-4 w-4 shrink-0"
            }
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">{syncStatus.label}</span>
          <span
            className={
              syncStatus.isOnline
                ? "h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                : "h-2 w-2 shrink-0 rounded-full bg-slate-400"
            }
            aria-label={syncStatus.isOnline ? "온라인" : "오프라인"}
          />
        </div>
      </div>
    </header>
  );
}
