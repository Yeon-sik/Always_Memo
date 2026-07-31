import type { FormEventHandler } from "react";
import { Scale } from "lucide-react";
import { BACKFILL_LABEL } from "../../../lib/dataTrust/backfillMetadata";
import {
  FieldLabel,
  FormTitle,
  SubmitButton,
} from "./FitnessPanelPrimitives";

interface WeightRecordFormProps {
  date: string;
  isBackfill: boolean;
  weightKg: string;
  onDateChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onWeightKgChange: (value: string) => void;
}

export function WeightRecordForm({
  date,
  isBackfill,
  weightKg,
  onDateChange,
  onSubmit,
  onWeightKgChange,
}: WeightRecordFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black"
    >
      <FormTitle
        icon={<Scale className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
        title="체중 기록 추가"
      />
      <FieldLabel label="날짜">
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="field-input"
        />
      </FieldLabel>
      {isBackfill ? (
        <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          {BACKFILL_LABEL}으로 저장됩니다.
        </p>
      ) : null}
      <FieldLabel label="체중 kg">
        <input
          type="number"
          min="0"
          step="0.1"
          value={weightKg}
          onChange={(event) => onWeightKgChange(event.target.value)}
          className="field-input"
          placeholder="72.1"
        />
      </FieldLabel>
      <SubmitButton
        label={isBackfill ? `${BACKFILL_LABEL} 저장` : "체중 추가"}
      />
    </form>
  );
}
