import type { Task } from "../../types";
import { formatKoreanDate } from "../fitness/fitnessDate";
import { formatMetric } from "../fitness/stats/fitnessStats";

// 기록 수정 시각을 일별 목록에 맞는 짧은 시간 형식으로 바꿉니다.
export function formatRecordTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// 할 일의 마감 날짜와 시간을 사람이 읽기 쉬운 한국어 라벨로 만듭니다.
export function formatTaskDueLabel(task: Task): string {
  if (!task.dueDate) {
    return "기한 없음";
  }

  return task.dueTime
    ? `${formatKoreanDate(task.dueDate)} ${task.dueTime} 마감`
    : `${formatKoreanDate(task.dueDate)} 마감`;
}

// 값이 없을 수 있는 수치를 대시 또는 단위가 붙은 문자열로 표시합니다.
export function formatNullableMetric(
  value: number | null,
  suffix: string,
  fractionDigits = 0,
): string {
  if (value === null) {
    return "-";
  }

  return `${formatMetric(value, fractionDigits)} ${suffix}`;
}

// 체중 증감 값에 양수 부호와 kg 단위를 붙여 KPI 라벨로 만듭니다.
export function getWeightDeltaLabel(value: number | null): string {
  if (value === null) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMetric(value)} kg`;
}
