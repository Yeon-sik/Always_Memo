import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../types";
import { reorderTasksForDrop } from "./taskReorder";

function createTask(
  id: string,
  orderIndex: number,
  deletedAt: string | null = null,
): Task {
  return {
    id,
    text: id,
    isDone: false,
    orderIndex,
    dueDate: null,
    dueTime: null,
    plannedDate: null,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    deletedAt,
    deviceId: "device-a",
    isBackfilled: false,
    backfilledAt: null,
    backfillReason: null,
  };
}

describe("reorderTasksForDrop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T03:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves a visible task after the target and keeps raw array placement", () => {
    const first = createTask("first", 0);
    const second = createTask("second", 1);
    const third = createTask("third", 2);
    const tasks = [third, first, second];

    const reordered = reorderTasksForDrop(
      tasks,
      "first",
      "third",
      "after",
      "device-b",
    );

    expect(reordered.map((task) => task.id)).toEqual([
      "third",
      "first",
      "second",
    ]);
    expect(
      Object.fromEntries(reordered.map((task) => [task.id, task.orderIndex])),
    ).toEqual({ third: 1, first: 2, second: 0 });
    expect(reordered[0].deviceId).toBe("device-b");
    expect(reordered[0].updatedAt).toBe("2026-08-01T03:00:00.000Z");
  });

  it("preserves tombstones while ordering only visible tasks", () => {
    const deleted = createTask(
      "deleted",
      99,
      "2026-07-31T01:00:00.000Z",
    );
    const first = createTask("first", 0);
    const second = createTask("second", 1);
    const tasks = [deleted, first, second];

    const reordered = reorderTasksForDrop(
      tasks,
      "second",
      "first",
      "before",
      "device-b",
    );

    expect(reordered[0]).toBe(deleted);
    expect(reordered[0]).toEqual(deleted);
    expect(reordered[1].orderIndex).toBe(1);
    expect(reordered[2].orderIndex).toBe(0);
  });

  it("returns the original array when the drop cannot change order", () => {
    const tasks = [createTask("first", 0), createTask("second", 1)];

    expect(
      reorderTasksForDrop(
        tasks,
        "first",
        "first",
        "before",
        "device-b",
      ),
    ).toBe(tasks);
    expect(
      reorderTasksForDrop(
        tasks,
        "missing",
        "second",
        "before",
        "device-b",
      ),
    ).toBe(tasks);
    expect(
      reorderTasksForDrop(
        tasks,
        "first",
        "missing",
        "after",
        "device-b",
      ),
    ).toBe(tasks);
  });
});
