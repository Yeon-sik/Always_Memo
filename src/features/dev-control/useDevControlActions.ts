import { useCallback } from "react";

import type { SnapshotUpdater } from "../../app/sync/useSnapshotStore";
import type { Device } from "../../types";
import type {
  BackfillInput,
  DevActionStatus,
  DevActionType,
  DevHistoryType,
  DevMilestoneStatus,
  DevProjectStatus,
  DevWorkstreamStatus,
} from "../../types";
import {
  createProject,
  createProjectAction,
  createProjectHistory,
  createProjectIdea,
  createProjectMilestone,
  softDeleteProject,
  softDeleteProjectAction,
  softDeleteProjectHistory,
  softDeleteProjectIdea,
  softDeleteProjectMilestone,
  updateProject,
  updateProjectAction,
  updateProjectHistory,
  updateProjectIdea,
  updateProjectMilestone,
  createWorkstream,
  createWorkstreamAction,
  createWorkstreamActionDependency,
  createWorkstreamActionProject,
  createWorkstreamMilestone,
  createWorkstreamProject,
  isWorkstreamActionDependencyAllowed,
  restoreWorkstreamActionDependency,
  restoreWorkstreamActionProject,
  restoreWorkstreamProject,
  softDeleteWorkstream,
  softDeleteWorkstreamAction,
  softDeleteWorkstreamActionDependency,
  softDeleteWorkstreamActionProject,
  softDeleteWorkstreamMilestone,
  softDeleteWorkstreamProject,
  updateWorkstream,
  updateWorkstreamAction,
  updateWorkstreamMilestone,
} from "./devControlService";
import type {
  ProjectActionChanges,
  ProjectChanges,
  ProjectHistoryChanges,
  ProjectIdeaChanges,
  ProjectMilestoneChanges,
  WorkstreamActionChanges,
  WorkstreamChanges,
  WorkstreamMilestoneChanges,
} from "./devControlService";

interface UseDevControlActionsOptions {
  commitSnapshot: (updater: SnapshotUpdater) => void;
  device: Device | null;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedWorkstreamId: string | null;
  setSelectedWorkstreamId: (id: string | null) => void;
}

export interface DevControlActions {
  addProject: (input: {
    name: string;
    repository: string | null;
    branch: string | null;
    githubRepositoryId?: string | null;
    githubOwner?: string | null;
    githubRepo?: string | null;
    status: DevProjectStatus;
    currentSummary: string;
    targetSummary: string;
    lastVerifiedCommit: string | null;
    lastVerifiedAt: string | null;
    backfillInput?: BackfillInput;
  }) => void;
  updateProject: (id: string, changes: ProjectChanges) => void;
  deleteProject: (id: string) => void;
  addProjectMilestone: (projectId: string, title: string, status?: DevMilestoneStatus) => void;
  updateProjectMilestone: (id: string, changes: ProjectMilestoneChanges) => void;
  deleteProjectMilestone: (id: string) => void;
  addProjectAction: (projectId: string, title: string, type?: DevActionType, status?: DevActionStatus) => void;
  updateProjectAction: (id: string, changes: ProjectActionChanges) => void;
  deleteProjectAction: (id: string) => void;
  addProjectIdea: (projectId: string, title: string) => void;
  updateProjectIdea: (id: string, changes: ProjectIdeaChanges) => void;
  deleteProjectIdea: (id: string) => void;
  addProjectHistory: (
    projectId: string,
    summary: string,
    type?: DevHistoryType,
    occurredAt?: string,
    githubRef?: string | null,
  ) => void;
  updateProjectHistory: (id: string, changes: ProjectHistoryChanges) => void;
  deleteProjectHistory: (id: string) => void;
  addWorkstream: (input: {
    name: string;
    status: DevWorkstreamStatus;
    projectIds: string[];
    backfillInput?: BackfillInput;
  }) => void;
  updateWorkstream: (id: string, changes: WorkstreamChanges) => void;
  deleteWorkstream: (id: string) => void;
  addWorkstreamProject: (workstreamId: string, projectId: string) => void;
  deleteWorkstreamProject: (id: string) => void;
  addWorkstreamMilestone: (
    workstreamId: string,
    title: string,
    status?: DevMilestoneStatus,
  ) => void;
  updateWorkstreamMilestone: (
    id: string,
    changes: WorkstreamMilestoneChanges,
  ) => void;
  deleteWorkstreamMilestone: (id: string) => void;
  addWorkstreamAction: (
    workstreamId: string,
    title: string,
    type?: DevActionType,
    status?: DevActionStatus,
  ) => void;
  updateWorkstreamAction: (
    id: string,
    changes: WorkstreamActionChanges,
  ) => void;
  deleteWorkstreamAction: (id: string) => void;
  addWorkstreamActionProject: (actionId: string, projectId: string) => void;
  deleteWorkstreamActionProject: (id: string) => void;
  addWorkstreamActionDependency: (
    actionId: string,
    dependsOnActionId: string,
  ) => void;
  deleteWorkstreamActionDependency: (id: string) => void;
}

export function useDevControlActions({
  commitSnapshot,
  device,
  selectedProjectId,
  setSelectedProjectId,
  selectedWorkstreamId,
  setSelectedWorkstreamId,
}: UseDevControlActionsOptions): DevControlActions {
  const addProject = useCallback(
    (input: Parameters<DevControlActions["addProject"]>[0]) => {
      if (!device) return;
      const project = createProject(device.id, input, input.backfillInput);
      commitSnapshot((snapshot) => ({ ...snapshot, projects: [...snapshot.projects, project] }));
      setSelectedProjectId(project.id);
    },
    [commitSnapshot, device, setSelectedProjectId],
  );

  const updateProjectById = useCallback(
    (id: string, changes: ProjectChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projects: snapshot.projects.map((project) =>
          project.id === id ? updateProject(project, changes, device.id) : project,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteProject = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projects: snapshot.projects.map((project) =>
          project.id === id ? softDeleteProject(project, device.id) : project,
        ),
      }));
      if (selectedProjectId === id) setSelectedProjectId(null);
    },
    [commitSnapshot, device, selectedProjectId, setSelectedProjectId],
  );

  const addProjectMilestone = useCallback(
    (projectId: string, title: string, status: DevMilestoneStatus = "PLANNED") => {
      if (!device) return;
      const milestone = createProjectMilestone(projectId, title, device.id, status);
      commitSnapshot((snapshot) => ({ ...snapshot, projectMilestones: [...snapshot.projectMilestones, milestone] }));
    },
    [commitSnapshot, device],
  );
  const updateProjectMilestoneById = useCallback(
    (id: string, changes: ProjectMilestoneChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectMilestones: snapshot.projectMilestones.map((item) =>
          item.id === id ? updateProjectMilestone(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );
  const deleteProjectMilestone = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectMilestones: snapshot.projectMilestones.map((item) =>
          item.id === id ? softDeleteProjectMilestone(item, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addProjectAction = useCallback(
    (projectId: string, title: string, type: DevActionType = "NEXT", status: DevActionStatus = "OPEN") => {
      if (!device) return;
      const action = createProjectAction(projectId, title, device.id, type, status);
      commitSnapshot((snapshot) => ({ ...snapshot, projectActions: [...snapshot.projectActions, action] }));
    },
    [commitSnapshot, device],
  );
  const updateProjectActionById = useCallback(
    (id: string, changes: ProjectActionChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectActions: snapshot.projectActions.map((item) =>
          item.id === id ? updateProjectAction(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );
  const deleteProjectAction = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectActions: snapshot.projectActions.map((item) =>
          item.id === id ? softDeleteProjectAction(item, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addProjectIdea = useCallback(
    (projectId: string, title: string) => {
      if (!device) return;
      const idea = createProjectIdea(projectId, title, device.id);
      commitSnapshot((snapshot) => ({ ...snapshot, projectIdeas: [...snapshot.projectIdeas, idea] }));
    },
    [commitSnapshot, device],
  );
  const updateProjectIdeaById = useCallback(
    (id: string, changes: ProjectIdeaChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectIdeas: snapshot.projectIdeas.map((item) =>
          item.id === id ? updateProjectIdea(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );
  const deleteProjectIdea = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectIdeas: snapshot.projectIdeas.map((item) =>
          item.id === id ? softDeleteProjectIdea(item, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addProjectHistory = useCallback(
    (
      projectId: string,
      summary: string,
      type: DevHistoryType = "NOTE",
      occurredAt?: string,
      githubRef: string | null = null,
    ) => {
      if (!device) return;
      const history = createProjectHistory(
        projectId,
        summary,
        device.id,
        type,
        occurredAt ?? new Date().toISOString(),
        githubRef,
      );
      commitSnapshot((snapshot) => ({ ...snapshot, projectHistory: [...snapshot.projectHistory, history] }));
    },
    [commitSnapshot, device],
  );
  const updateProjectHistoryById = useCallback(
    (id: string, changes: ProjectHistoryChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectHistory: snapshot.projectHistory.map((item) =>
          item.id === id ? updateProjectHistory(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );
  const deleteProjectHistory = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        projectHistory: snapshot.projectHistory.map((item) =>
          item.id === id ? softDeleteProjectHistory(item, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addWorkstream = useCallback(
    (input: Parameters<DevControlActions["addWorkstream"]>[0]) => {
      if (!device) return;
      const workstream = createWorkstream(device.id, input, input.backfillInput);
      const requestedProjectIds = new Set(input.projectIds);
      commitSnapshot((snapshot) => {
        const projectIds = snapshot.projects
          .filter(
            (project) =>
              project.deletedAt === null && requestedProjectIds.has(project.id),
          )
          .map((project) => project.id);
        const links = projectIds.map((projectId) =>
          createWorkstreamProject(workstream.id, projectId, device.id),
        );
        return {
          ...snapshot,
          workstreams: [...snapshot.workstreams, workstream],
          workstreamProjects: [...snapshot.workstreamProjects, ...links],
        };
      });
      setSelectedWorkstreamId(workstream.id);
    },
    [commitSnapshot, device, setSelectedWorkstreamId],
  );

  const updateWorkstreamById = useCallback(
    (id: string, changes: WorkstreamChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreams: snapshot.workstreams.map((item) =>
          item.id === id ? updateWorkstream(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteWorkstream = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreams: snapshot.workstreams.map((item) =>
          item.id === id ? softDeleteWorkstream(item, device.id) : item,
        ),
      }));
      if (selectedWorkstreamId === id) setSelectedWorkstreamId(null);
    },
    [commitSnapshot, device, selectedWorkstreamId, setSelectedWorkstreamId],
  );

  const addWorkstreamProject = useCallback(
    (workstreamId: string, projectId: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => {
        const workstream = snapshot.workstreams.find(
          (item) => item.id === workstreamId && item.deletedAt === null,
        );
        const project = snapshot.projects.find(
          (item) => item.id === projectId && item.deletedAt === null,
        );
        if (!workstream || !project) return snapshot;

        const existing = snapshot.workstreamProjects.find(
          (item) =>
            item.workstreamId === workstreamId && item.projectId === projectId,
        );
        if (existing) {
          if (existing.deletedAt === null) return snapshot;
          return {
            ...snapshot,
            workstreamProjects: snapshot.workstreamProjects.map((item) =>
              item.id === existing.id
                ? restoreWorkstreamProject(item, device.id)
                : item,
            ),
          };
        }

        return {
          ...snapshot,
          workstreamProjects: [
            ...snapshot.workstreamProjects,
            createWorkstreamProject(workstreamId, projectId, device.id),
          ],
        };
      });
    },
    [commitSnapshot, device],
  );

  const deleteWorkstreamProject = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => {
        const participation = snapshot.workstreamProjects.find(
          (item) => item.id === id,
        );
        if (!participation) return snapshot;

        const workstreamActionIds = new Set(
          snapshot.workstreamActions
            .filter(
              (item) =>
                item.workstreamId === participation.workstreamId &&
                item.deletedAt === null,
            )
            .map((item) => item.id),
        );

        return {
          ...snapshot,
          workstreamProjects: snapshot.workstreamProjects.map((item) =>
            item.id === id ? softDeleteWorkstreamProject(item, device.id) : item,
          ),
          workstreamActionProjects: snapshot.workstreamActionProjects.map(
            (item) =>
              item.deletedAt === null &&
              item.projectId === participation.projectId &&
              workstreamActionIds.has(item.actionId)
                ? softDeleteWorkstreamActionProject(item, device.id)
                : item,
          ),
        };
      });
    },
    [commitSnapshot, device],
  );

  const addWorkstreamMilestone = useCallback(
    (
      workstreamId: string,
      title: string,
      status: DevMilestoneStatus = "PLANNED",
    ) => {
      if (!device) return;
      const milestone = createWorkstreamMilestone(
        workstreamId,
        title,
        device.id,
        status,
      );
      commitSnapshot((snapshot) => {
        if (
          !snapshot.workstreams.some(
            (item) => item.id === workstreamId && item.deletedAt === null,
          )
        ) {
          return snapshot;
        }
        return {
          ...snapshot,
          workstreamMilestones: [...snapshot.workstreamMilestones, milestone],
        };
      });
    },
    [commitSnapshot, device],
  );

  const updateWorkstreamMilestoneById = useCallback(
    (id: string, changes: WorkstreamMilestoneChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamMilestones: snapshot.workstreamMilestones.map((item) =>
          item.id === id
            ? updateWorkstreamMilestone(item, changes, device.id)
            : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteWorkstreamMilestone = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamMilestones: snapshot.workstreamMilestones.map((item) =>
          item.id === id
            ? softDeleteWorkstreamMilestone(item, device.id)
            : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addWorkstreamAction = useCallback(
    (
      workstreamId: string,
      title: string,
      type: DevActionType = "NEXT",
      status: DevActionStatus = "OPEN",
    ) => {
      if (!device) return;
      const action = createWorkstreamAction(
        workstreamId,
        title,
        device.id,
        type,
        status,
      );
      commitSnapshot((snapshot) => {
        if (
          !snapshot.workstreams.some(
            (item) => item.id === workstreamId && item.deletedAt === null,
          )
        ) {
          return snapshot;
        }
        return {
          ...snapshot,
          workstreamActions: [...snapshot.workstreamActions, action],
        };
      });
    },
    [commitSnapshot, device],
  );

  const updateWorkstreamActionById = useCallback(
    (id: string, changes: WorkstreamActionChanges) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamActions: snapshot.workstreamActions.map((item) =>
          item.id === id ? updateWorkstreamAction(item, changes, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteWorkstreamAction = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamActions: snapshot.workstreamActions.map((item) =>
          item.id === id ? softDeleteWorkstreamAction(item, device.id) : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addWorkstreamActionProject = useCallback(
    (actionId: string, projectId: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => {
        const action = snapshot.workstreamActions.find(
          (item) => item.id === actionId && item.deletedAt === null,
        );
        const project = snapshot.projects.find(
          (item) => item.id === projectId && item.deletedAt === null,
        );
        if (!action || !project) return snapshot;
        const isParticipating = snapshot.workstreamProjects.some(
          (item) =>
            item.workstreamId === action.workstreamId &&
            item.projectId === projectId &&
            item.deletedAt === null,
        );
        if (!isParticipating) return snapshot;

        const existing = snapshot.workstreamActionProjects.find(
          (item) => item.actionId === actionId && item.projectId === projectId,
        );
        if (existing) {
          if (existing.deletedAt === null) return snapshot;
          return {
            ...snapshot,
            workstreamActionProjects: snapshot.workstreamActionProjects.map(
              (item) =>
                item.id === existing.id
                  ? restoreWorkstreamActionProject(item, device.id)
                  : item,
            ),
          };
        }

        return {
          ...snapshot,
          workstreamActionProjects: [
            ...snapshot.workstreamActionProjects,
            createWorkstreamActionProject(actionId, projectId, device.id),
          ],
        };
      });
    },
    [commitSnapshot, device],
  );

  const deleteWorkstreamActionProject = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamActionProjects: snapshot.workstreamActionProjects.map((item) =>
          item.id === id
            ? softDeleteWorkstreamActionProject(item, device.id)
            : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const addWorkstreamActionDependency = useCallback(
    (actionId: string, dependsOnActionId: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => {
        const action = snapshot.workstreamActions.find(
          (item) => item.id === actionId && item.deletedAt === null,
        );
        const dependsOnAction = snapshot.workstreamActions.find(
          (item) => item.id === dependsOnActionId && item.deletedAt === null,
        );
        if (
          !action ||
          !dependsOnAction ||
          action.workstreamId !== dependsOnAction.workstreamId ||
          !isWorkstreamActionDependencyAllowed(
            snapshot.workstreamActionDependencies,
            actionId,
            dependsOnActionId,
          )
        ) {
          return snapshot;
        }

        const existing = snapshot.workstreamActionDependencies.find(
          (item) =>
            item.actionId === actionId &&
            item.dependsOnActionId === dependsOnActionId,
        );
        if (existing) {
          if (existing.deletedAt === null) return snapshot;
          return {
            ...snapshot,
            workstreamActionDependencies:
              snapshot.workstreamActionDependencies.map((item) =>
                item.id === existing.id
                  ? restoreWorkstreamActionDependency(item, device.id)
                  : item,
              ),
          };
        }

        return {
          ...snapshot,
          workstreamActionDependencies: [
            ...snapshot.workstreamActionDependencies,
            createWorkstreamActionDependency(
              actionId,
              dependsOnActionId,
              device.id,
            ),
          ],
        };
      });
    },
    [commitSnapshot, device],
  );

  const deleteWorkstreamActionDependency = useCallback(
    (id: string) => {
      if (!device) return;
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workstreamActionDependencies: snapshot.workstreamActionDependencies.map(
          (item) =>
            item.id === id
              ? softDeleteWorkstreamActionDependency(item, device.id)
              : item,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  return {
    addProject,
    updateProject: updateProjectById,
    deleteProject,
    addProjectMilestone,
    updateProjectMilestone: updateProjectMilestoneById,
    deleteProjectMilestone,
    addProjectAction,
    updateProjectAction: updateProjectActionById,
    deleteProjectAction,
    addProjectIdea,
    updateProjectIdea: updateProjectIdeaById,
    deleteProjectIdea,
    addProjectHistory,
    updateProjectHistory: updateProjectHistoryById,
    deleteProjectHistory,
    addWorkstream,
    updateWorkstream: updateWorkstreamById,
    deleteWorkstream,
    addWorkstreamProject,
    deleteWorkstreamProject,
    addWorkstreamMilestone,
    updateWorkstreamMilestone: updateWorkstreamMilestoneById,
    deleteWorkstreamMilestone,
    addWorkstreamAction,
    updateWorkstreamAction: updateWorkstreamActionById,
    deleteWorkstreamAction,
    addWorkstreamActionProject,
    deleteWorkstreamActionProject,
    addWorkstreamActionDependency,
    deleteWorkstreamActionDependency,
  };
}
