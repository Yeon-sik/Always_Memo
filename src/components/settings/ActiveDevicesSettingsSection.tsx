import { Laptop } from "lucide-react";
import type { Device } from "../../types";

interface ActiveDevicesSettingsSectionProps {
  activeDevices: Device[];
  currentDeviceId: string | null;
}

function formatLastSeenAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ActiveDevicesSettingsSection({
  activeDevices,
  currentDeviceId,
}: ActiveDevicesSettingsSectionProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
        <Laptop
          className="h-4 w-4 text-emerald-700 dark:text-emerald-300"
          aria-hidden="true"
        />
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
  );
}
