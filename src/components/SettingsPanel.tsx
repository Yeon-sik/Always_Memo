import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  KeyRound,
  Keyboard,
  Laptop,
  Link as LinkIcon,
  Monitor,
  Moon,
  Power,
  RefreshCw,
  Save,
  Server,
  Settings,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
import type { Device } from "../types";
import type { SyncStatus } from "../lib/sync/syncTypes";
import type {
  RuntimeConfig,
  SupabaseConfigInput,
} from "../lib/config/runtimeConfig";
import type { ThemeMode } from "../app/useThemeMode";
import type { DesktopQuickCaptureShortcutStatus } from "../lib/desktop/quickCapture";

interface SettingsPanelProps {
  activeDevices: Device[];
  autostartEnabled: boolean;
  autostartSupported: boolean;
  currentDeviceId: string | null;
  isManualSyncing: boolean;
  isSupabaseConfigured: boolean;
  supabaseConfig: RuntimeConfig;
  syncStatus: SyncStatus;
  themeMode: ThemeMode;
  userId: string;
  quickCaptureShortcutPreference: string;
  quickCaptureShortcutStatus: DesktopQuickCaptureShortcutStatus;
  onChangeThemeMode: (themeMode: ThemeMode) => void;
  onManualSync: () => Promise<void>;
  onRefreshQuickCaptureShortcutStatus: () => Promise<void>;
  onSaveSupabaseConfig: (config: SupabaseConfigInput) => Promise<void>;
  onSaveQuickCaptureShortcutPreference: (shortcut: string) => void;
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
  supabaseConfig,
  syncStatus,
  themeMode,
  userId,
  quickCaptureShortcutPreference,
  quickCaptureShortcutStatus,
  onChangeThemeMode,
  onManualSync,
  onRefreshQuickCaptureShortcutStatus,
  onSaveSupabaseConfig,
  onSaveQuickCaptureShortcutPreference,
  onToggleAutostart,
}: SettingsPanelProps) {
  const [supabaseUrl, setSupabaseUrl] = useState(supabaseConfig.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    supabaseConfig.supabaseAnonKey,
  );
  const [configuredUserId, setConfiguredUserId] = useState(
    supabaseConfig.userId,
  );
  const [supabaseSaveStatus, setSupabaseSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [quickCaptureShortcutDraft, setQuickCaptureShortcutDraft] = useState(
    quickCaptureShortcutPreference,
  );
  const [quickCaptureShortcutSaveStatus, setQuickCaptureShortcutSaveStatus] =
    useState<"idle" | "saved">("idle");
  const configSourceLabel = supabaseConfig.loaded
    ? supabaseConfig.sourcePath ?? "runtime"
    : "not set";

  useEffect(() => {
    setSupabaseUrl(supabaseConfig.supabaseUrl);
    setSupabaseAnonKey(supabaseConfig.supabaseAnonKey);
    setConfiguredUserId(supabaseConfig.userId);
  }, [
    supabaseConfig.supabaseAnonKey,
    supabaseConfig.supabaseUrl,
    supabaseConfig.userId,
  ]);

  useEffect(() => {
    setQuickCaptureShortcutDraft(quickCaptureShortcutPreference);
  }, [quickCaptureShortcutPreference]);

  async function handleSupabaseConfigSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSupabaseSaveStatus("saving");

    try {
      await onSaveSupabaseConfig({
        supabaseUrl,
        supabaseAnonKey,
        userId: configuredUserId,
      });
      setSupabaseSaveStatus("saved");
    } catch {
      setSupabaseSaveStatus("error");
    }
  }

  function handleQuickCaptureShortcutSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    onSaveQuickCaptureShortcutPreference(quickCaptureShortcutDraft);
    setQuickCaptureShortcutSaveStatus("saved");
  }

  const quickCaptureStatusLabel = !quickCaptureShortcutStatus.supported
    ? "fallback"
    : quickCaptureShortcutStatus.registered
      ? "registered"
      : "사용 불가";

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
          <form onSubmit={handleSupabaseConfigSubmit} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
                <KeyRound className="h-4 w-4 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
                <span>Supabase config</span>
              </div>
              <span className="max-w-36 truncate text-xs font-medium text-slate-500 dark:text-neutral-400">
                {configSourceLabel}
              </span>
            </div>

            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-neutral-400">
                <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Supabase URL
              </span>
              <input
                type="url"
                value={supabaseUrl}
                onChange={(event) => {
                  setSupabaseUrl(event.target.value);
                  setSupabaseSaveStatus("idle");
                }}
                autoComplete="off"
                spellCheck={false}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-950"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-neutral-400">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Anon key
              </span>
              <input
                type="password"
                value={supabaseAnonKey}
                onChange={(event) => {
                  setSupabaseAnonKey(event.target.value);
                  setSupabaseSaveStatus("idle");
                }}
                autoComplete="off"
                spellCheck={false}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-950"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-neutral-400">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                User ID
              </span>
              <input
                type="text"
                value={configuredUserId}
                onChange={(event) => {
                  setConfiguredUserId(event.target.value);
                  setSupabaseSaveStatus("idle");
                }}
                autoComplete="off"
                spellCheck={false}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-950"
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={supabaseSaveStatus === "saving"}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-cyan-500 dark:text-black dark:hover:bg-cyan-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-400"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>
                  {supabaseSaveStatus === "saving" ? "Saving" : "Save config"}
                </span>
              </button>
              {supabaseSaveStatus === "saved" ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-200 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  saved
                </span>
              ) : null}
              {supabaseSaveStatus === "error" ? (
                <span className="inline-flex h-9 items-center rounded-md border border-red-200 px-2 text-xs font-medium text-red-700 dark:border-red-900 dark:text-red-300">
                  failed
                </span>
              ) : null}
            </div>
          </form>
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
              <Keyboard className="h-4 w-4 text-violet-700 dark:text-violet-300" aria-hidden="true" />
              <span>Quick Capture</span>
            </div>
            <span
              className={
                quickCaptureShortcutStatus.registered
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-neutral-900 dark:text-neutral-300"
              }
            >
              {quickCaptureStatusLabel}
            </span>
          </div>

          <dl className="mt-3 space-y-2 text-xs text-slate-600 dark:text-neutral-400">
            <div className="flex items-center justify-between gap-3">
              <dt>현재 등록</dt>
              <dd className="font-medium text-slate-800 dark:text-neutral-200">
                {quickCaptureShortcutStatus.shortcut}
              </dd>
            </div>
            {quickCaptureShortcutStatus.error ? (
              <div className="flex items-start justify-between gap-3">
                <dt>상태</dt>
                <dd className="min-w-0 text-right text-red-700 dark:text-red-300">
                  {quickCaptureShortcutStatus.error}
                </dd>
              </div>
            ) : null}
          </dl>

          <form
            onSubmit={handleQuickCaptureShortcutSubmit}
            className="mt-3 space-y-2"
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-neutral-400">
                대체 단축키
              </span>
              <input
                type="text"
                value={quickCaptureShortcutDraft}
                onChange={(event) => {
                  setQuickCaptureShortcutDraft(event.target.value);
                  setQuickCaptureShortcutSaveStatus("idle");
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-600 focus:ring-2 focus:ring-violet-100 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:focus:border-violet-400 dark:focus:ring-violet-950"
                placeholder="Ctrl+Alt+Space"
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-violet-700 px-3 text-sm font-medium text-white transition hover:bg-violet-600 dark:bg-violet-500 dark:text-black dark:hover:bg-violet-400"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>저장</span>
              </button>
              <button
                type="button"
                onClick={() => void onRefreshQuickCaptureShortcutStatus()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                aria-label="Quick Capture 단축키 상태 새로고침"
                title="새로고침"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </button>
              {quickCaptureShortcutSaveStatus === "saved" ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-200 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  saved
                </span>
              ) : null}
            </div>
          </form>
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
