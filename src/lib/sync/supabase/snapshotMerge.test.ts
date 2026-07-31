import { describe, expect, it } from "vitest";
import { mergeSnapshot } from "./snapshotMerge";
import { makeDevice, makeNote, makeSnapshot } from "./testFixtures";

describe("Supabase snapshot merge", () => {
  it("uses the canonical LWW rule for each snapshot collection", () => {
    const local = makeSnapshot({
      notes: [
        makeNote({
          content: "new local",
          updatedAt: "2026-08-01T00:00:02.000Z",
        }),
      ],
    });
    const incoming = makeSnapshot({
      notes: [
        makeNote({
          content: "old remote",
          updatedAt: "2026-08-01T00:00:01.000Z",
        }),
      ],
    });

    expect(mergeSnapshot(local, incoming).notes[0].content).toBe("new local");
  });

  it("prefers an equal-timestamp tombstone", () => {
    const updatedAt = "2026-08-01T00:00:02.000Z";
    const local = makeSnapshot({
      notes: [makeNote({ updatedAt, deletedAt: null })],
    });
    const incoming = makeSnapshot({
      notes: [makeNote({ updatedAt, deletedAt: updatedAt })],
    });

    expect(mergeSnapshot(local, incoming).notes[0].deletedAt).toBe(updatedAt);
  });

  it("keeps the latest device heartbeat and sorts devices newest first", () => {
    const local = makeSnapshot({
      devices: [
        makeDevice({ id: "device-a", lastSeenAt: "2026-08-01T00:00:01.000Z" }),
      ],
    });
    const incoming = makeSnapshot({
      devices: [
        makeDevice({ id: "device-a", lastSeenAt: "2026-08-01T00:00:03.000Z" }),
        makeDevice({ id: "device-b", lastSeenAt: "2026-08-01T00:00:02.000Z" }),
      ],
    });

    expect(mergeSnapshot(local, incoming).devices.map((device) => device.id)).toEqual(
      ["device-a", "device-b"],
    );
  });
});
