import type {
  Project,
  Workstream,
  WorkstreamProject,
} from "../../types";

export interface KnowledgeWorkstreamCandidate {
  workstream: Workstream;
  participatingProjectIds: string[];
  missingProjectIds: string[];
  rank: 0 | 1 | 2;
}

/**
 * Sort Workstream choices by how well they already cover the selected Projects.
 * The returned missing ids are intentionally only advisory; the creation action
 * still validates explicit participant additions before it mutates the snapshot.
 */
export function getKnowledgeWorkstreamCandidates(
  workstreams: Workstream[],
  workstreamProjects: WorkstreamProject[],
  selectedProjectIds: string[],
): KnowledgeWorkstreamCandidate[] {
  const selected = [...new Set(selectedProjectIds)];
  const selectedSet = new Set(selected);
  return workstreams
    .filter((workstream) => workstream.deletedAt === null)
    .map((workstream) => {
      const participatingProjectIds = [
        ...new Set(
          workstreamProjects
            .filter(
              (link) =>
                link.deletedAt === null &&
                link.workstreamId === workstream.id &&
                selectedSet.has(link.projectId),
            )
            .map((link) => link.projectId),
        ),
      ];
      const participatingSet = new Set(participatingProjectIds);
      const missingProjectIds = selected.filter((id) => !participatingSet.has(id));
      const rank: KnowledgeWorkstreamCandidate["rank"] =
        missingProjectIds.length === 0 ? 0 : participatingProjectIds.length > 0 ? 1 : 2;
      return { workstream, participatingProjectIds, missingProjectIds, rank };
    })
    .sort(
      (first, second) =>
        first.rank - second.rank ||
        first.workstream.name.localeCompare(second.workstream.name) ||
        first.workstream.id.localeCompare(second.workstream.id),
    );
}

export function getProjectNamesById(projects: Project[], ids: string[]): string[] {
  const names = new Map(projects.map((project) => [project.id, project.name]));
  return ids.map((id) => names.get(id) ?? id);
}
