import type { BackfillInput, Note } from "../../types";
import { createEntityAuditFields } from "../../lib/dataTrust/backfillMetadata";
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

function normalizeNoteContent(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function serializeInlineNodes(nodes: NodeListOf<ChildNode> | ChildNode[]): string {
  return Array.from(nodes)
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? "";
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      const inner = serializeInlineNodes(Array.from(element.childNodes));

      if (tagName === "br") {
        return "\n";
      }

      if (tagName === "strong" || tagName === "b") {
        return `**${inner}**`;
      }

      if (tagName === "em" || tagName === "i") {
        return `*${inner}*`;
      }

      return inner;
    })
    .join("");
}

export function createNote(
  deviceId: string,
  changes: Pick<Partial<Note>, "title" | "content"> = {},
  recordDate?: string,
  backfillInput?: BackfillInput,
): Note {
  const createdAt = new Date().toISOString();
  const auditFields = createEntityAuditFields(backfillInput, createdAt);

  return {
    ...auditFields,
    id: createId(),
    title: changes.title ?? "새 메모",
    content: changes.content ?? "",
    updatedAt: createTimestampForDate(recordDate),
    deletedAt: null,
    deviceId,
  };
}

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

export function softDeleteNote(note: Note, deviceId: string): Note {
  const now = new Date().toISOString();

  return {
    ...note,
    updatedAt: now,
    deletedAt: now,
    deviceId,
  };
}

export function getVisibleNotes(notes: Note[]): Note[] {
  return notes
    .filter((note) => note.deletedAt === null)
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

export function getPlainTextFromNoteContent(content: string): string {
  return normalizeNoteContent(content)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}

export function renderNoteContentHtml(content: string): string {
  const normalized = normalizeNoteContent(content);

  if (!normalized) {
    return "";
  }

  const withInlineFormatting = escapeHtml(normalized)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return withInlineFormatting
    .split("\n")
    .map((line) => (line ? `<div>${line}</div>` : "<div><br /></div>"))
    .join("");
}

export function serializeNoteEditorHtmlToMarkdown(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;

  const lines: string[] = [];

  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      lines.push(child.textContent ?? "");
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const element = child as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    if (tagName === "div" || tagName === "p") {
      lines.push(serializeInlineNodes(Array.from(element.childNodes)));
      continue;
    }

    if (tagName === "br") {
      lines.push("");
      continue;
    }

    lines.push(serializeInlineNodes([element]));
  }

  return lines
    .join("\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getNoteDisplayTitle(note: Note): string {
  const trimmedTitle = note.title.trim();

  if (trimmedTitle) {
    return trimmedTitle;
  }

  const contentPreview = getPlainTextFromNoteContent(note.content)
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");

  return contentPreview || "제목 없는 메모";
}
