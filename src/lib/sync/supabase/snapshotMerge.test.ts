import { describe, expect, it } from "vitest";
import { mergeSnapshot } from "./snapshotMerge";
import {
  makeDevice,
  makeNote,
  makeProject,
  makeProjectHistory,
  makeSnapshot,
} from "./testFixtures";

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

  it("merges all Dev Control collections with the same LWW rule", () => {
    const localProject = makeProject({
      updatedAt: "2026-08-01T00:00:02.000Z",
      currentSummary: "local",
    });
    const incomingHistory = makeProjectHistory({
      updatedAt: "2026-08-01T00:00:02.000Z",
      summary: "remote history",
    });
    const local = makeSnapshot({
      projects: [localProject],
      projectHistory: [
        makeProjectHistory({ summary: "local history" }),
      ],
    });
    const incoming = makeSnapshot({
      projects: [
        makeProject({
          updatedAt: "2026-08-01T00:00:01.000Z",
          currentSummary: "stale",
        }),
      ],
      projectHistory: [incomingHistory],
    });

    const merged = mergeSnapshot(local, incoming);
    expect(merged.projects[0].currentSummary).toBe("local");
    expect(merged.projectHistory[0].summary).toBe("remote history");
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
