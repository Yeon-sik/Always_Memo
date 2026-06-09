import { FormEvent, useEffect, useMemo, useState } from "react";
import { Save, Scale } from "lucide-react";
import type { WeightRecord } from "../../../types";
import { formatMetric } from "../../fitness/stats/fitnessStats";

interface QuickActionWeightEditorProps {
  records: WeightRecord[];
  selectedDate: string;
  onAddWeightRecord: (date: string, weightKg: number) => void;
  onUpdateWeightRecord: (recordId: string, weightKg: number) => void;
}

export function QuickActionWeightEditor({
  records,
  selectedDate,
  onAddWeightRecord,
  onUpdateWeightRecord,
}: QuickActionWeightEditorProps) {
  const latestRecord = useMemo(
    () => records[records.length - 1] ?? null,
    [records],
  );
  const [weightKg, setWeightKg] = useState(
    latestRecord ? String(latestRecord.weightKg) : "",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeightKg(latestRecord ? String(latestRecord.weightKg) : "");
    setError(null);
  }, [latestRecord]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedWeight = Number(weightKg);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setError("0보다 큰 kg 값이 필요합니다.");
      return;
    }

    if (latestRecord) {
      onUpdateWeightRecord(latestRecord.id, parsedWeight);
    } else {
      onAddWeightRecord(selectedDate, parsedWeight);
    }

    setError(null);
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
        <Scale className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <span>체중</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          {records.length}
        </span>
      </div>

      {latestRecord ? (
        <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          현재 {formatMetric(latestRecord.weightKg)} kg
        </div>
      ) : (
        <div className="mb-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          이 날짜에는 아직 기록이 없습니다.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="number"
          min="0"
          step="0.1"
          value={weightKg}
          onChange={(event) => setWeightKg(event.target.value)}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500"
          placeholder="체중 kg"
        />
        {error ? <div className="text-xs text-red-600 dark:text-red-300">{error}</div> : null}
        <button
          type="submit"
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {latestRecord ? "체중 수정" : "체중 추가"}
        </button>
      </form>
    </section>
  );
}
