import { useCallback, useState } from "react";

interface QuickActionState {
  isOpen: boolean;
  mode: "quick" | "backfill";
  selectedDate: string | null;
}

export function useQuickActionState() {
  const [state, setState] = useState<QuickActionState>({
    isOpen: false,
    mode: "quick",
    selectedDate: null,
  });
  const [returnFocusElement, setReturnFocusElement] =
    useState<HTMLElement | null>(null);

  const openQuickAction = useCallback(
    (
      date: string,
      sourceElement: HTMLElement | null = null,
      mode: QuickActionState["mode"] = "quick",
    ) => {
      setReturnFocusElement(sourceElement);
      setState({
        isOpen: true,
        mode,
        selectedDate: date,
      });
    },
    [],
  );

  const closeQuickAction = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      isOpen: false,
    }));

    window.setTimeout(() => {
      returnFocusElement?.focus();
    }, 0);
  }, [returnFocusElement]);

  return {
    closeQuickAction,
    isQuickActionOpen: state.isOpen,
    openQuickAction,
    quickActionDate: state.selectedDate,
    quickActionMode: state.mode,
  };
}
