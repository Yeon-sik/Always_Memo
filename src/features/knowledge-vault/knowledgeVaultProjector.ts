import type { LocalDataSnapshot, KnowledgeDocument } from "../../types";
import {
  buildKnowledgeDocumentRelativePath,
  buildProjectHomeMarkdown,
  buildProjectHomeRelativePath,
  buildWorkstreamHomeMarkdown,
  buildWorkstreamHomeRelativePath,
  moveKnowledgeVaultFile,
  resolveKnowledgeDocumentRelativePath,
  updateKnowledgeDocumentFile,
  writeGeneratedKnowledgeFile,
  type KnowledgeVaultConfig,
} from "./knowledgeVaultService";

export interface KnowledgeVaultProjectionStatus {
  missingDocumentIds: string[];
  error: string | null;
}

function visible<T extends { deletedAt: string | null }>(items: T[]): T[] {
  return items.filter((item) => item.deletedAt === null);
}

function getProjectName(snapshot: LocalDataSnapshot, projectId: string | null): string | null {
  if (!projectId) return null;
  return snapshot.projects.find((project) => project.id === projectId)?.name ?? null;
}

function getWorkstreamName(
  snapshot: LocalDataSnapshot,
  workstreamId: string | null,
): string | null {
  if (!workstreamId) return null;
  return (
    snapshot.workstreams.find((workstream) => workstream.id === workstreamId)?.name ??
    null
  );
}

export async function reconcileKnowledgeVaultProjection({
  snapshot,
  previousSnapshot,
  config,
  onDocumentPathChange,
}: {
  snapshot: LocalDataSnapshot;
  previousSnapshot?: LocalDataSnapshot | null;
  config: KnowledgeVaultConfig;
  onDocumentPathChange?: (previous: KnowledgeDocument, next: KnowledgeDocument) => void;
}): Promise<KnowledgeVaultProjectionStatus> {
  if (!config.supported || !config.vaultPath) {
    return { missingDocumentIds: [], error: null };
  }

  const missingDocumentIds: string[] = [];

  try {
    for (const project of visible(snapshot.projects)) {
      const previousProject = previousSnapshot?.projects.find((item) => item.id === project.id);
      if (previousProject && previousProject.name !== project.name) {
        await moveKnowledgeVaultFile(
          buildProjectHomeRelativePath(previousProject.name),
          buildProjectHomeRelativePath(project.name),
        ).catch(() => undefined);
      }

      await writeGeneratedKnowledgeFile(
        buildProjectHomeRelativePath(project.name),
        buildProjectHomeMarkdown({
          project,
          milestones: snapshot.projectMilestones.filter(
            (item) => item.projectId === project.id,
          ),
          actions: snapshot.projectActions.filter(
            (item) => item.projectId === project.id,
          ),
          history: snapshot.projectHistory.filter(
            (item) => item.projectId === project.id,
          ),
          workstreams: snapshot.workstreams,
          workstreamProjects: snapshot.workstreamProjects,
          knowledgeDocuments: snapshot.knowledgeDocuments,
        }),
      );
    }

    for (const workstream of visible(snapshot.workstreams)) {
      const previousWorkstream = previousSnapshot?.workstreams.find(
        (item) => item.id === workstream.id,
      );
      if (previousWorkstream && previousWorkstream.name !== workstream.name) {
        await moveKnowledgeVaultFile(
          buildWorkstreamHomeRelativePath(previousWorkstream.name),
          buildWorkstreamHomeRelativePath(workstream.name),
        ).catch(() => undefined);
      }

      await writeGeneratedKnowledgeFile(
        buildWorkstreamHomeRelativePath(workstream.name),
        buildWorkstreamHomeMarkdown({
          workstream,
          projects: snapshot.projects,
          workstreamProjects: snapshot.workstreamProjects,
          milestones: snapshot.workstreamMilestones.filter(
            (item) => item.workstreamId === workstream.id,
          ),
          actions: snapshot.workstreamActions.filter(
            (item) => item.workstreamId === workstream.id,
          ),
          knowledgeDocuments: snapshot.knowledgeDocuments,
        }),
      );
    }

    const currentDocuments = visible(snapshot.knowledgeDocuments);
    const existingPaths = currentDocuments.map((document) => document.relativePath);
    for (const document of currentDocuments) {
      const expectedPath = buildKnowledgeDocumentRelativePath({
        title: document.title,
        type: document.type,
        projectName: getProjectName(snapshot, document.projectId),
        workstreamName: getWorkstreamName(snapshot, document.workstreamId),
        projectId: document.projectId,
        workstreamId: document.workstreamId,
      });
      const nextRelativePath =
        document.relativePath === expectedPath
          ? expectedPath
          : resolveKnowledgeDocumentRelativePath(
              { ...document, id: document.id },
              existingPaths.filter((path) => path !== document.relativePath),
            );

      if (nextRelativePath === document.relativePath) continue;

      const nextDocument: KnowledgeDocument = {
        ...document,
        relativePath: nextRelativePath,
        updatedAt: new Date().toISOString(),
      };
      const result = await updateKnowledgeDocumentFile({
        document: nextDocument,
        currentRelativePath: document.relativePath,
        projectName: getProjectName(snapshot, nextDocument.projectId),
        workstreamName: getWorkstreamName(snapshot, nextDocument.workstreamId),
      });
      if (result.status === "missing") {
        missingDocumentIds.push(document.id);
      }
      if (result.status !== "conflict") {
        onDocumentPathChange?.(document, nextDocument);
      }
    }
  } catch (caughtError) {
    return {
      missingDocumentIds,
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "Knowledge Vault projection을 갱신하지 못했습니다.",
    };
  }

  return { missingDocumentIds, error: null };
}
