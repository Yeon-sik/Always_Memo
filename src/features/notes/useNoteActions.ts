import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { SnapshotUpdater } from "../../app/sync/useSnapshotStore";
import type { BackfillInput, Device, Note } from "../../types";
import {
  createNote,
  softDeleteNote,
  updateNote,
} from "./noteService";

interface UseNoteActionsOptions {
  commitSnapshot: (updater: SnapshotUpdater) => void;
  device: Device | null;
  selectedNoteId: string | null;
  setSelectedNoteId: Dispatch<SetStateAction<string | null>>;
  visibleNotes: Note[];
}

export interface NoteActions {
  addNote: () => void;
  addNoteForDate: (
    date: string,
    title: string,
    content: string,
    backfillInput?: BackfillInput,
  ) => void;
  deleteNote: (noteId: string) => void;
  selectNote: (noteId: string) => void;
  updateNoteForDate: (
    noteId: string,
    date: string,
    title: string,
    content: string,
  ) => void;
  updateSelectedNoteContent: (content: string) => void;
  updateSelectedNoteTitle: (title: string) => void;
}

export function useNoteActions({
  commitSnapshot,
  device,
  selectedNoteId,
  setSelectedNoteId,
  visibleNotes,
}: UseNoteActionsOptions): NoteActions {
  const addNote = useCallback(() => {
    if (!device) {
      return;
    }

    const note = createNote(device.id);
    commitSnapshot((snapshot) => ({
      ...snapshot,
      notes: [note, ...snapshot.notes],
    }));
    setSelectedNoteId(note.id);
  }, [commitSnapshot, device, setSelectedNoteId]);

  const addNoteForDate = useCallback(
    (
      date: string,
      title: string,
      content: string,
      backfillInput?: BackfillInput,
    ) => {
      if (!device) {
        return;
      }

      const note = createNote(
        device.id,
        {
          content,
          title: title.trim() || "빠른 메모",
        },
        date,
        backfillInput,
      );

      commitSnapshot((snapshot) => ({
        ...snapshot,
        notes: [note, ...snapshot.notes],
      }));
      setSelectedNoteId(note.id);
    },
    [commitSnapshot, device, setSelectedNoteId],
  );

  const selectNote = useCallback(
    (noteId: string) => {
      setSelectedNoteId(noteId);
    },
    [setSelectedNoteId],
  );

  const deleteNote = useCallback(
    (noteId: string) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        notes: snapshot.notes.map((note) =>
          note.id === noteId ? softDeleteNote(note, device.id) : note,
        ),
      }));

      if (selectedNoteId === noteId) {
        const nextNote = visibleNotes.find((note) => note.id !== noteId);
        setSelectedNoteId(nextNote?.id ?? null);
      }
    },
    [
      commitSnapshot,
      device,
      selectedNoteId,
      setSelectedNoteId,
      visibleNotes,
    ],
  );

  const updateSelectedNoteTitle = useCallback(
    (title: string) => {
      if (!device || !selectedNoteId) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        notes: snapshot.notes.map((note) =>
          note.id === selectedNoteId
            ? updateNote(note, { title }, device.id)
            : note,
        ),
      }));
    },
    [commitSnapshot, device, selectedNoteId],
  );

  const updateSelectedNoteContent = useCallback(
    (content: string) => {
      if (!device || !selectedNoteId) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        notes: snapshot.notes.map((note) =>
          note.id === selectedNoteId
            ? updateNote(note, { content }, device.id)
            : note,
        ),
      }));
    },
    [commitSnapshot, device, selectedNoteId],
  );

  const updateNoteForDate = useCallback(
    (noteId: string, date: string, title: string, content: string) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        notes: snapshot.notes.map((note) =>
          note.id === noteId
            ? updateNote(note, { content, title }, device.id, date)
            : note,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  return {
    addNote,
    addNoteForDate,
    deleteNote,
    selectNote,
    updateNoteForDate,
    updateSelectedNoteContent,
    updateSelectedNoteTitle,
  };
}
