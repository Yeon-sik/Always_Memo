import type {
  FitnessRecordContractVersion,
  WorkoutRecord,
} from "../../types";

export const FITNESS_RECORD_CONTRACT_VERSION: FitnessRecordContractVersion = 1;

export const strengthCategoryLabels = {
  chest: "가슴",
  back: "등",
  legs: "하체",
  shoulders: "어깨",
  abs: "복부",
  triceps: "삼두",
  biceps: "이두",
} as const;

export type StrengthCategoryCode = keyof typeof strengthCategoryLabels;
export type WorkoutCategoryCode = StrengthCategoryCode | "cardio" | "other";

const legacyStrengthCategoryCodes = new Map<string, StrengthCategoryCode>(
  Object.entries(strengthCategoryLabels).flatMap(([code, label]) => [
    [code, code as StrengthCategoryCode],
    [label, code as StrengthCategoryCode],
    [`${label}운동`, code as StrengthCategoryCode],
  ]),
);

export function normalizeCategoryCodes(
  values: unknown,
): WorkoutCategoryCode[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .map((value) => {
      if (value === "cardio" || value === "other") {
        return value;
      }
      return legacyStrengthCategoryCodes.get(value) ?? null;
    })
    .filter((value): value is WorkoutCategoryCode => value !== null);

  return [...new Set(normalized)];
}

export function workoutCategoryCodes(
  record: Pick<WorkoutRecord, "workoutType" | "category" | "metadata">,
): WorkoutCategoryCode[] {
  const metadataCodes = normalizeCategoryCodes(record.metadata?.category_codes);
  if (metadataCodes.length > 0) {
    return metadataCodes;
  }

  if (record.workoutType === "cardio") {
    return ["cardio"];
  }
  if (record.workoutType === "other") {
    return ["other"];
  }

  return normalizeCategoryCodes([record.category]);
}

export function categoryLabelsFromCodes(
  codes: WorkoutCategoryCode[],
): string[] {
  return codes.map((code) => {
    if (code === "cardio") {
      return "유산소";
    }
    if (code === "other") {
      return "기타";
    }
    return strengthCategoryLabels[code];
  });
}

export function withFitnessContractMetadata(
  metadata: Record<string, unknown> = {},
  categoryCodes: WorkoutCategoryCode[] = [],
): Record<string, unknown> {
  return {
    ...metadata,
    contract_version: FITNESS_RECORD_CONTRACT_VERSION,
    ...(categoryCodes.length > 0
      ? {
          category_codes: [...new Set(categoryCodes)],
          os_categories: categoryLabelsFromCodes(categoryCodes),
        }
      : {}),
  };
}
