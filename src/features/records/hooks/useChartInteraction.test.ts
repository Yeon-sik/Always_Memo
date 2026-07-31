import { describe, expect, it } from "vitest";
import { clampChartIndex } from "./useChartInteraction";

describe("clampChartIndex", () => {
  it("returns the empty-series sentinel when no points exist", () => {
    expect(clampChartIndex(0, 0)).toBe(-1);
  });

  it("keeps an index inside the available chart range", () => {
    expect(clampChartIndex(2, 5)).toBe(2);
  });

  it("clamps indexes to the first and last chart points", () => {
    expect(clampChartIndex(-3, 5)).toBe(0);
    expect(clampChartIndex(8, 5)).toBe(4);
  });
});
