// 필수 숫자 입력을 0 이상의 유효한 number로 변환합니다.
export const DEFAULT_DURATION_INPUT = "00:00:00";
export const MAX_DURATION_SECONDS = 23 * 60 * 60 + 59 * 60 + 59;

export function parseRequiredNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

// 빈 값은 null로 두고, 값이 있으면 필수 숫자와 같은 규칙으로 검증합니다.
export function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  return parseRequiredNumber(value);
}

export function parseOptionalPositiveNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseDurationSeconds(value: string): number | null {
  const match = /^(\d{2}):([0-5]\d):([0-5]\d)$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, hours, minutes, seconds] = match;

  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function formatDurationInput(durationSeconds: number): string {
  const clampedSeconds = Math.min(
    Math.max(Math.trunc(durationSeconds), 0),
    MAX_DURATION_SECONDS,
  );
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const seconds = clampedSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

export function stepDurationInput(
  value: string,
  direction: 1 | -1,
  stepSeconds: number,
): string {
  const currentSeconds = parseDurationSeconds(value) ?? 0;

  return formatDurationInput(currentSeconds + direction * stepSeconds);
}
