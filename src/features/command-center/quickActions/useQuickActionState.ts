import { useCallback, useState } from "react";

interface QuickActionState {
  isOpen: boolean;
  selectedDate: string | null;
}

export function useQuickActionState() {
  const [state, setState] = useState<QuickActionState>({
    isOpen: false,
    selectedDate: null,
  });
  const [returnFocusElement, setReturnFocusElement] =
    useState<HTMLElement | null>(null);

  const openQuickAction = useCallback(
    (date: string, sourceElement: HTMLElement | null = null) => {
      setReturnFocusElement(sourceElement);
      setState({
        isOpen: true,
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
  };
}
