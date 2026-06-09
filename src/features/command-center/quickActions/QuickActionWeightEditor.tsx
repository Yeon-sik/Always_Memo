import { type FormEvent, useState } from "react";
import { Plus, Scale } from "lucide-react";
import type { BackfillInput } from "../../../types";

interface QuickActionWeightEditorProps {
  backfillInput?: BackfillInput;
  disabled?: boolean;
  selectedDate: string;
  onAddWeightRecord: (
    date: string,
    weightKg: number,
    backfillInput?: BackfillInput,
  ) => void;
}

export function QuickActionWeightEditor({
  backfillInput,
  disabled = false,
  selectedDate,
  onAddWeightRecord,
}: QuickActionWeightEditorProps) {
  const [weightKg, setWeightKg] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      setError("미래 날짜에는 실제 체중 기록을 추가할 수 없습니다.");
      return;
    }

    const parsedWeight = Number(weightKg);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setError("0보다 큰 kg 값이 필요합니다.");
      return;
    }

    onAddWeightRecord(selectedDate, parsedWeight, backfillInput);
    setWeightKg("");
    setError(null);
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
        <Scale className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <span>체중 추가</span>
      </div>

      {disabled ? (
        <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-neutral-400">
          미래 날짜에는 실제 수행 기록을 추가하지 않습니다.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="number"
          min="0"
          step="0.1"
          value={weightKg}
          onChange={(event) => setWeightKg(event.target.value)}
          disabled={disabled}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:disabled:bg-neutral-950 dark:disabled:text-neutral-600"
          placeholder="체중 kg"
        />
        {error ? <div className="text-xs text-red-600 dark:text-red-300">{error}</div> : null}
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          체중 추가
        </button>
      </form>
    </section>
  );
}
