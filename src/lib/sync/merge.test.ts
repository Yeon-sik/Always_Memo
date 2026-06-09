import { describe, expect, it } from "vitest";
import { mergeEntities, shouldUseIncomingEntity } from "./merge";

interface TestEntity {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  value: string;
}

const live: TestEntity = {
  id: "record-1",
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  value: "live",
};

const tombstone: TestEntity = {
  id: "record-1",
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: "2026-06-09T00:00:00.000Z",
  value: "deleted",
};

describe("sync merge", () => {
  it("uses newer incoming rows", () => {
    expect(
      shouldUseIncomingEntity(live, {
        ...live,
        updatedAt: "2026-06-09T00:00:01.000Z",
      }),
    ).toBe(true);
  });

  it("prefers tombstones when updatedAt is equal", () => {
    expect(shouldUseIncomingEntity(live, tombstone)).toBe(true);
    expect(shouldUseIncomingEntity(tombstone, live)).toBe(false);
  });

  it("keeps tombstones during entity merge", () => {
    const incomingTombstone = mergeEntities([live], [tombstone]);
    const existingTombstone = mergeEntities([tombstone], [live]);

    expect(incomingTombstone[0].deletedAt).not.toBeNull();
    expect(existingTombstone[0].deletedAt).not.toBeNull();
  });
});
