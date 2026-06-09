// 필수 숫자 입력을 0 이상의 유효한 number로 변환합니다.
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
