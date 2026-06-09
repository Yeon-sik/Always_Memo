import { useCallback, useEffect, useState } from "react";
import { formatLocalDate } from "../fitness/fitnessDate";
import {
  DEFAULT_QUICK_CAPTURE_SHORTCUT,
  getGlobalShortcutRegistrationState,
} from "../../lib/desktop/shortcuts";
import {
  getDesktopQuickCaptureShortcutStatus,
  listenForDesktopQuickCaptureOpen,
  type DesktopQuickCaptureShortcutStatus,
} from "../../lib/desktop/quickCapture";
import {
  parseQuickCaptureDraft,
  type QuickCaptureMode,
} from "./quickCaptureParser";

const SHORTCUT_STORAGE_KEY = "yeonsik-note:quick-capture-shortcut";

interface UseQuickCaptureOptions {
  onAddMemo: (date: string, title: string, content: string) => void;
  onAddTask: (
    text: string,
    dueDate: string | null,
    dueTime: string | null,
  ) => void;
}

function loadShortcutPreference(): string {
  if (typeof localStorage === "undefined") {
    return DEFAULT_QUICK_CAPTURE_SHORTCUT;
  }

  return (
    localStorage.getItem(SHORTCUT_STORAGE_KEY) ??
    DEFAULT_QUICK_CAPTURE_SHORTCUT
  );
}

function persistShortcutPreference(shortcut: string): string {
  const normalizedShortcut = shortcut.trim() || DEFAULT_QUICK_CAPTURE_SHORTCUT;

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SHORTCUT_STORAGE_KEY, normalizedShortcut);
  }

  return normalizedShortcut;
}

// Quick Capture의 열림 상태, desktop 이벤트, fallback 단축키, 저장 액션을 묶는다.
export function useQuickCapture({
  onAddMemo,
  onAddTask,
}: UseQuickCaptureOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<QuickCaptureMode>("task");
  const [shortcutPreference, setShortcutPreferenceState] = useState(
    loadShortcutPreference,
  );
  const [shortcutStatus, setShortcutStatus] =
    useState<DesktopQuickCaptureShortcutStatus>({
      registered: false,
      shortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT,
      supported: false,
      error: null,
    });

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const refreshShortcutStatus = useCallback(async () => {
    const desktopStatus = await getDesktopQuickCaptureShortcutStatus();
    const preferredStatus = await getGlobalShortcutRegistrationState(
      shortcutPreference,
    );

    setShortcutStatus({
      ...desktopStatus,
      error: desktopStatus.error ?? preferredStatus.error,
      registered:
        desktopStatus.registered ||
        (desktopStatus.shortcut === shortcutPreference &&
          preferredStatus.registered),
    });
  }, [shortcutPreference]);

  const setShortcutPreference = useCallback((shortcut: string) => {
    setShortcutPreferenceState(persistShortcutPreference(shortcut));
  }, []);

  const saveDraft = useCallback(
    (draft: string, selectedMode: QuickCaptureMode) => {
      const parsedDraft = parseQuickCaptureDraft(draft, selectedMode);

      if (!parsedDraft) {
        return false;
      }

      const today = formatLocalDate();

      if (parsedDraft.mode === "memo") {
        onAddMemo(today, parsedDraft.title, parsedDraft.content);
      } else {
        onAddTask(parsedDraft.content, today, null);
      }

      setIsOpen(false);
      setMode("task");
      return true;
    },
    [onAddMemo, onAddTask],
  );

  useEffect(() => {
    void refreshShortcutStatus();
  }, [refreshShortcutStatus]);

  useEffect(() => {
    let cleanup: () => void = () => undefined;
    let isMounted = true;

    void listenForDesktopQuickCaptureOpen(() => {
      open();
    }).then((unlisten) => {
      if (isMounted) {
        cleanup = unlisten;
      } else {
        unlisten();
      }
    });

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return {
    close,
    isOpen,
    mode,
    open,
    refreshShortcutStatus,
    saveDraft,
    setMode,
    setShortcutPreference,
    shortcutPreference,
    shortcutStatus,
  };
}
