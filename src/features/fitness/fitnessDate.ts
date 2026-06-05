export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getCurrentMonthRange(today = new Date()): {
  startDate: string;
  endDate: string;
} {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
}

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

export function isWithinDateRange(
  date: string,
  startDate: string,
  endDate: string,
): boolean {
  return date >= startDate && date <= endDate;
}

export function formatKoreanDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parseDateInput(value));
}
