import { type FormEvent, useState } from "react";
import { Plus, Salad } from "lucide-react";
import type { BackfillInput } from "../../../types";
import {
  parseOptionalNumber,
  parseRequiredNumber,
} from "../../fitness/fitnessInputParsing";

interface QuickActionMealEditorProps {
  backfillInput?: BackfillInput;
  disabled?: boolean;
  selectedDate: string;
  onAddMealRecord: (
    date: string,
    menu: string,
    calories: number,
    proteinGrams: number,
    carbsGrams?: number | null,
    fatGrams?: number | null,
    backfillInput?: BackfillInput,
  ) => void;
}

const inputClassName =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:disabled:bg-neutral-950 dark:disabled:text-neutral-600";

export function QuickActionMealEditor({
  backfillInput,
  disabled = false,
  selectedDate,
  onAddMealRecord,
}: QuickActionMealEditorProps) {
  const [menu, setMenu] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinGrams, setProteinGrams] = useState("");
  const [carbsGrams, setCarbsGrams] = useState("");
  const [fatGrams, setFatGrams] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function clearFeedback() {
    setError(null);
    setSavedMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      setError("미래 날짜에는 실제 식사 기록을 추가할 수 없습니다.");
      return;
    }

    const parsedCalories = parseRequiredNumber(calories);
    const parsedProteinGrams = parseRequiredNumber(proteinGrams);
    const parsedCarbsGrams = parseOptionalNumber(carbsGrams);
    const parsedFatGrams = parseOptionalNumber(fatGrams);

    if (
      !menu.trim() ||
      parsedCalories === null ||
      parsedProteinGrams === null ||
      (carbsGrams.trim() && parsedCarbsGrams === null) ||
      (fatGrams.trim() && parsedFatGrams === null)
    ) {
      setError("메뉴와 0 이상의 영양 값을 입력해야 합니다.");
      return;
    }

    onAddMealRecord(
      selectedDate,
      menu.trim(),
      parsedCalories,
      parsedProteinGrams,
      parsedCarbsGrams,
      parsedFatGrams,
      backfillInput,
    );

    setMenu("");
    setCalories("");
    setProteinGrams("");
    setCarbsGrams("");
    setFatGrams("");
    setError(null);
    setSavedMessage("식사 기록을 추가했습니다.");
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
        <Salad className="h-4 w-4 text-yellow-600" aria-hidden="true" />
        <span>식단 추가</span>
      </div>

      {disabled ? (
        <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-neutral-400">
          미래 날짜에는 실제 수행 기록을 추가하지 않습니다.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={menu}
          onChange={(event) => {
            setMenu(event.target.value);
            clearFeedback();
          }}
          className={inputClassName}
          placeholder="메뉴"
          disabled={disabled}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            value={calories}
            onChange={(event) => {
              setCalories(event.target.value);
              clearFeedback();
            }}
            className={inputClassName}
            placeholder="칼로리"
            disabled={disabled}
          />
          <input
            type="number"
            min="0"
            step="0.1"
            value={proteinGrams}
            onChange={(event) => {
              setProteinGrams(event.target.value);
              clearFeedback();
            }}
            className={inputClassName}
            placeholder="단백질 g"
            disabled={disabled}
          />
          <input
            type="number"
            min="0"
            step="0.1"
            value={carbsGrams}
            onChange={(event) => {
              setCarbsGrams(event.target.value);
              clearFeedback();
            }}
            className={inputClassName}
            placeholder="탄수 g 선택"
            disabled={disabled}
          />
          <input
            type="number"
            min="0"
            step="0.1"
            value={fatGrams}
            onChange={(event) => {
              setFatGrams(event.target.value);
              clearFeedback();
            }}
            className={inputClassName}
            placeholder="지방 g 선택"
            disabled={disabled}
          />
        </div>
        {error ? (
          <div className="text-xs text-red-600 dark:text-red-300">{error}</div>
        ) : null}
        {savedMessage ? (
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {savedMessage}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-amber-600 px-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {backfillInput ? "누락 보강 저장" : "식단 추가"}
        </button>
      </form>
    </section>
  );
}
