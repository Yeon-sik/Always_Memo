import {
  Laptop,
  Monitor,
  Moon,
  Power,
  RefreshCw,
  Server,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { Device } from "../types";
import type { SyncStatus } from "../lib/sync/syncTypes";
import type { ThemeMode } from "../app/useThemeMode";

interface SettingsPanelProps {
  activeDevices: Device[];
  autostartEnabled: boolean;
  autostartSupported: boolean;
  currentDeviceId: string | null;
  isManualSyncing: boolean;
  isSupabaseConfigured: boolean;
  syncStatus: SyncStatus;
  themeMode: ThemeMode;
  userId: string;
  onChangeThemeMode: (themeMode: ThemeMode) => void;
  onManualSync: () => Promise<void>;
  onToggleAutostart: (enabled: boolean) => Promise<void>;
}

function formatLastSeenAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

export function SettingsPanel({
  activeDevices,
  autostartEnabled,
  autostartSupported,
  currentDeviceId,
  isManualSyncing,
  isSupabaseConfigured,
  syncStatus,
  themeMode,
  userId,
  onChangeThemeMode,
  onManualSync,
  onToggleAutostart,
}: SettingsPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white dark:border-neutral-800 dark:bg-black">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 px-3 text-sm font-semibold text-slate-900 dark:border-neutral-800 dark:text-neutral-100">
        <Settings className="h-4 w-4 text-slate-600 dark:text-neutral-300" aria-hidden="true" />
        <span>설정</span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
            <Sun className="h-4 w-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />
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

        <section className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
            <Server className="h-4 w-4 text-indigo-700 dark:text-indigo-300" aria-hidden="true" />
            <span>연결 상태</span>
          </div>

          <dl className="mt-3 space-y-2 text-xs text-slate-600 dark:text-neutral-400">
            <div className="flex items-center justify-between gap-3">
              <dt>Supabase</dt>
              <dd className="font-medium text-slate-800 dark:text-neutral-200">
                {isSupabaseConfigured ? "configured" : "local-only"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>동기화</dt>
              <dd className="min-w-0 truncate font-medium text-slate-800 dark:text-neutral-200">
                {syncStatus.label}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>사용자</dt>
              <dd className="max-w-48 truncate font-mono text-slate-800 dark:text-neutral-200">
                {userId}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => void onManualSync()}
            disabled={isManualSyncing}
            className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-neutral-100 dark:text-black dark:hover:bg-white dark:disabled:bg-neutral-800 dark:disabled:text-neutral-400"
          >
            <RefreshCw
              className={isManualSyncing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              aria-hidden="true"
            />
            <span>{isManualSyncing ? "동기화 중" : "수동 동기화"}</span>
          </button>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
              <Power className="h-4 w-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />
              <span>자동 실행</span>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={autostartEnabled}
                disabled={!autostartSupported}
                onChange={(event) =>
                  void onToggleAutostart(event.target.checked)
                }
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-teal-700 peer-disabled:bg-slate-200 dark:bg-neutral-800 dark:peer-checked:bg-teal-500 dark:peer-disabled:bg-neutral-900" />
              <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
            {autostartSupported
              ? autostartEnabled
                ? "Windows 시작 시 자동 실행됩니다."
                : "Windows 시작 시 자동 실행하지 않습니다."
              : "현재 실행 환경에서는 자동 실행 설정을 사용할 수 없습니다."}
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
            <Laptop className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            <span>활성 기기</span>
          </div>

          {activeDevices.length === 0 ? (
            <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-xs text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
              표시할 활성 기기가 없습니다.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {activeDevices.map((device) => {
                const isCurrent = device.id === currentDeviceId;

                return (
                  <div
                    key={device.id}
                    className={
                      isCurrent
                        ? "rounded-md border border-teal-200 bg-teal-50 p-3 dark:border-teal-800 dark:bg-teal-950/50"
                        : "rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-neutral-800 dark:bg-neutral-950"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-neutral-100">
                        {device.name}
                      </div>
                      <span
                        className={
                          isCurrent
                            ? "rounded-full bg-teal-700 px-2 py-0.5 text-xs text-white"
                            : "rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"
                        }
                      >
                        {isCurrent ? "현재" : "활성"}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
                      {formatLastSeenAt(device.lastSeenAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
