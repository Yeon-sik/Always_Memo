import { useEffect, useState } from "react";
import type { ChartInteractionHandlers } from "../components/InteractiveRecordsMetrics";

export function clampChartIndex(index: number, length: number): number {
  if (length <= 0) {
    return -1;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

export function useChartInteraction(length: number): ChartInteractionHandlers {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (length === 0) {
      setActiveIndex(null);
      setIsLocked(false);
      setIsDragging(false);
      return;
    }

    setActiveIndex((current) => {
      if (current === null) {
        return current;
      }

      return clampChartIndex(current, length);
    });
  }, [length]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function stopDragging() {
      setIsDragging(false);
    }

    window.addEventListener("pointerup", stopDragging);
    return () => window.removeEventListener("pointerup", stopDragging);
  }, [isDragging]);

  function showIndex(index: number) {
    if (length === 0) {
      return;
    }

    setActiveIndex(clampChartIndex(index, length));
  }

  return {
    activeIndex,
    onBlur: () => {
      if (!isLocked && !isDragging) {
        setActiveIndex(null);
      }
    },
    onHover: (index) => {
      showIndex(index);
    },
    onLeave: () => {
      if (!isLocked && !isDragging) {
        setActiveIndex(null);
      }
    },
    onPointerDown: (index) => {
      showIndex(index);
      setIsLocked(true);
      setIsDragging(true);
    },
    onPointerMove: (index) => {
      if (isLocked || isDragging) {
        showIndex(index);
      }
    },
    onToggleLock: (index) => {
      if (isLocked && activeIndex === index) {
        setActiveIndex(null);
        setIsLocked(false);
        setIsDragging(false);
        return;
      }

      showIndex(index);
      setIsLocked(true);
      setIsDragging(false);
    },
  };
}
