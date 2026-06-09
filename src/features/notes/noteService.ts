import type { Note } from "../../types";
import { createId } from "../../lib/storage/id";

function createTimestampForDate(date?: string): string {
  if (!date) {
    return new Date().toISOString();
  }

  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date().toISOString();
  }

  const now = new Date();
  return new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  ).toISOString();
}

// 새 메모는 로컬에서 즉시 생성하고, 생성 기기를 deviceId로 남긴다.
export function createNote(
  deviceId: string,
  changes: Pick<Partial<Note>, "title" | "content"> = {},
  recordDate?: string,
): Note {
  const now = createTimestampForDate(recordDate);

  return {
    id: createId(),
    title: changes.title ?? "새 메모",
    content: changes.content ?? "",
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

// 제목/본문 변경 시 updatedAt과 deviceId를 갱신해 LWW 동기화 기준을 만든다.
export function updateNote(
  note: Note,
  changes: Pick<Partial<Note>, "title" | "content">,
  deviceId: string,
  recordDate?: string,
): Note {
  return {
    ...note,
    ...changes,
    updatedAt: createTimestampForDate(recordDate),
    deviceId,
  };
}

// 삭제는 hard delete 대신 deletedAt을 남겨 다른 기기에도 삭제를 전파한다.
export function softDeleteNote(note: Note, deviceId: string): Note {
  const now = new Date().toISOString();

  return {
    ...note,
    updatedAt: now,
    deletedAt: now,
    deviceId,
  };
}

// UI에는 삭제되지 않은 메모만 최신 수정 순서로 보여준다.
export function getVisibleNotes(notes: Note[]): Note[] {
  return notes
    .filter((note) => note.deletedAt === null)
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

// 제목이 비어 있으면 본문 앞부분을 목록 표시 제목으로 대체한다.
export function getNoteDisplayTitle(note: Note): string {
  const trimmedTitle = note.title.trim();

  if (trimmedTitle) {
    return trimmedTitle;
  }

  const contentPreview = note.content.trim().split(/\s+/).slice(0, 5).join(" ");
  return contentPreview || "제목 없는 메모";
}
