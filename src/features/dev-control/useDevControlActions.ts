import { useCallback } from "react";

import type { SnapshotUpdater } from "../../app/sync/useSnapshotStore";
import type {
  Device,
} from "../../types";
import type {
  BackfillInput,
  DevActionStatus,
  DevActionType,
  DevHistoryType,
  DevMilestoneStatus,
  DevProjectStatus,
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
} from "./devControlService";
import type {
  ProjectActionChanges,
  ProjectChanges,
  ProjectHistoryChanges,
  ProjectIdeaChanges,
  ProjectMilestoneChanges,
} from "./devControlService";

interface UseDevControlActionsOptions {
  commitSnapshot: (updater: SnapshotUpdater) => void;
  device: Device | null;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
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
}

export function useDevControlActions({
  commitSnapshot,
  device,
  selectedProjectId,
  setSelectedProjectId,
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
  };
}
