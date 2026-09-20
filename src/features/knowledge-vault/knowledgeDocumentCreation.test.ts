import { describe, expect, it } from "vitest";

import type { Workstream, WorkstreamProject } from "../../types";
import { buildKnowledgeDocumentRelativePath, resolveKnowledgeDocumentRelativePath } from "./knowledgeVaultService";
import { getKnowledgeWorkstreamCandidates } from "./knowledgeDocumentCreation";

const audit = (id: string) => ({
  id,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
});

function workstream(id: string, name: string): Workstream {
  return { ...audit(id), name, status: "PLANNED" };
}

function link(workstreamId: string, projectId: string): WorkstreamProject {
  return { ...audit(`${workstreamId}:${projectId}`), workstreamId, projectId };
}

describe("Project Workspace Knowledge Document creation", () => {
  it("orders common, partial, and unrelated Workstreams by selected Project coverage", () => {
    const candidates = getKnowledgeWorkstreamCandidates(
      [workstream("other", "Other"), workstream("partial", "OCR V5"), workstream("common", "Shared")],
      [link("partial", "fitness"), link("common", "fitness"), link("common", "ocr")],
      ["fitness", "ocr"],
    );

    expect(candidates.map((candidate) => candidate.workstream.id)).toEqual([
      "common",
      "partial",
      "other",
    ]);
    expect(candidates[1]?.missingProjectIds).toEqual(["ocr"]);
  });

  it("keeps one selected Project project-owned and routes multiple Projects to Workstream paths", () => {
    expect(buildKnowledgeDocumentRelativePath({
      title: "OCR V5 계획",
      type: "PLAN",
      projectId: "fitness",
      projectName: "Fitness App",
    })).toBe("Projects/Fitness App/Plans/OCR V5 계획.md");
    expect(buildKnowledgeDocumentRelativePath({
      title: "OCR V5 계획",
      type: "PLAN",
      workstreamId: "ws-1",
      workstreamName: "OCR V5",
    })).toBe("Workstreams/OCR V5/Plans/OCR V5 계획.md");
  });

  it("does not make filename the identity when titles collide", () => {
    const base = buildKnowledgeDocumentRelativePath({
      title: "같은 제목",
      type: "NOTE",
      workstreamId: "ws-1",
      workstreamName: "Shared",
    });
    expect(resolveKnowledgeDocumentRelativePath({
      id: "stable-id-12345678",
      title: "같은 제목",
      type: "NOTE",
      workstreamId: "ws-1",
      workstreamName: "Shared",
    }, [base])).toBe("Workstreams/Shared/Notes/같은 제목 (stable-i).md");
  });
});
