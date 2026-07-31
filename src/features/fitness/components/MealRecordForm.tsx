import type { FormEventHandler } from "react";
import { Salad } from "lucide-react";
import { BACKFILL_LABEL } from "../../../lib/dataTrust/backfillMetadata";
import {
  FieldLabel,
  FormTitle,
  SubmitButton,
} from "./FitnessPanelPrimitives";

interface MealRecordFormProps {
  calories: string;
  carbsGrams: string;
  date: string;
  fatGrams: string;
  isBackfill: boolean;
  menu: string;
  proteinGrams: string;
  onCaloriesChange: (value: string) => void;
  onCarbsGramsChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onFatGramsChange: (value: string) => void;
  onMenuChange: (value: string) => void;
  onProteinGramsChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function MealRecordForm({
  calories,
  carbsGrams,
  date,
  fatGrams,
  isBackfill,
  menu,
  proteinGrams,
  onCaloriesChange,
  onCarbsGramsChange,
  onDateChange,
  onFatGramsChange,
  onMenuChange,
  onProteinGramsChange,
  onSubmit,
}: MealRecordFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black"
    >
      <FormTitle
        icon={<Salad className="h-4 w-4 text-yellow-600" aria-hidden="true" />}
        title="식사 기록 추가"
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
      <FieldLabel label="메뉴">
        <input
          value={menu}
          onChange={(event) => onMenuChange(event.target.value)}
          className="field-input"
          placeholder="닭가슴살 샐러드"
        />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        <FieldLabel label="칼로리">
          <input
            type="number"
            min="0"
            value={calories}
            onChange={(event) => onCaloriesChange(event.target.value)}
            className="field-input"
            placeholder="520"
          />
        </FieldLabel>
        <FieldLabel label="단백질 g">
          <input
            type="number"
            min="0"
            step="0.1"
            value={proteinGrams}
            onChange={(event) => onProteinGramsChange(event.target.value)}
            className="field-input"
            placeholder="42"
          />
        </FieldLabel>
        <FieldLabel label="탄수 g">
          <input
            type="number"
            min="0"
            step="0.1"
            value={carbsGrams}
            onChange={(event) => onCarbsGramsChange(event.target.value)}
            className="field-input"
            placeholder="선택"
          />
        </FieldLabel>
        <FieldLabel label="지방 g">
          <input
            type="number"
            min="0"
            step="0.1"
            value={fatGrams}
            onChange={(event) => onFatGramsChange(event.target.value)}
            className="field-input"
            placeholder="선택"
          />
        </FieldLabel>
      </div>
      <SubmitButton
        label={isBackfill ? `${BACKFILL_LABEL} 저장` : "식사 추가"}
      />
    </form>
  );
}
