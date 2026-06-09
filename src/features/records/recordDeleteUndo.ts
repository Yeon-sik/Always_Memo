import type { MealRecord, WeightRecord, WorkoutRecord } from "../../types";

// 운동/식사/체중 삭제 후 5초 되돌리기에 필요한 원본 기록을 보관합니다.
export type PendingFitnessDelete =
  | { type: "workout"; record: WorkoutRecord }
  | { type: "meal"; record: MealRecord }
  | { type: "weight"; record: WeightRecord }
  | null;

// 삭제 직후 토스트에 보여줄 기록 종류별 안내 문구를 만듭니다.
export function getPendingFitnessDeleteMessage(
  pendingDelete: PendingFitnessDelete,
): string {
  if (!pendingDelete) {
    return "";
  }

  if (pendingDelete.type === "workout") {
    return "운동 기록을 삭제했습니다.";
  }

  if (pendingDelete.type === "meal") {
    return "식사 기록을 삭제했습니다.";
  }

  return "체중 기록을 삭제했습니다.";
}
