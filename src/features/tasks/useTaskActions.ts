import { useCallback } from "react";

import type { SnapshotUpdater } from "../../app/sync/useSnapshotStore";
import type { BackfillInput, Device } from "../../types";
import {
  createTask,
  getNextOrderIndex,
  softDeleteTask,
  updateTask,
} from "./taskService";
import {
  reorderTasksForDrop,
  type TaskDropPlacement,
} from "./taskReorder";

interface UseTaskActionsOptions {
  commitSnapshot: (updater: SnapshotUpdater) => void;
  device: Device | null;
}

export interface TaskActions {
  addTask: (
    text: string,
    dueDate?: string | null,
    dueTime?: string | null,
    plannedDate?: string | null,
    backfillInput?: BackfillInput,
  ) => void;
  deleteTask: (taskId: string) => void;
  reorderTasks: (
    draggedTaskId: string,
    targetTaskId: string,
    placement: TaskDropPlacement,
  ) => void;
  toggleTask: (taskId: string) => void;
  updateTaskPlannedDate: (
    taskId: string,
    plannedDate: string | null,
  ) => void;
  updateTaskSchedule: (
    taskId: string,
    dueDate: string | null,
    dueTime: string | null,
  ) => void;
  updateTaskText: (taskId: string, text: string) => void;
}

export function useTaskActions({
  commitSnapshot,
  device,
}: UseTaskActionsOptions): TaskActions {
  const addTask = useCallback(
    (
      text: string,
      dueDate: string | null = null,
      dueTime: string | null = null,
      plannedDate: string | null = null,
      backfillInput?: BackfillInput,
    ) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => {
        const task = createTask(
          text,
          getNextOrderIndex(snapshot.tasks),
          device.id,
          dueDate,
          dueTime,
          plannedDate,
          backfillInput,
        );

        return {
          ...snapshot,
          tasks: [...snapshot.tasks, task],
        };
      });
    },
    [commitSnapshot, device],
  );

  const toggleTask = useCallback(
    (taskId: string) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        tasks: snapshot.tasks.map((task) =>
          task.id === taskId
            ? updateTask(task, { isDone: !task.isDone }, device.id)
            : task,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const updateTaskText = useCallback(
    (taskId: string, text: string) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        tasks: snapshot.tasks.map((task) =>
          task.id === taskId ? updateTask(task, { text }, device.id) : task,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const updateTaskSchedule = useCallback(
    (taskId: string, dueDate: string | null, dueTime: string | null) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        tasks: snapshot.tasks.map((task) =>
          task.id === taskId
            ? updateTask(task, { dueDate, dueTime }, device.id)
            : task,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const updateTaskPlannedDate = useCallback(
    (taskId: string, plannedDate: string | null) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        tasks: snapshot.tasks.map((task) =>
          task.id === taskId
            ? updateTask(task, { plannedDate }, device.id)
            : task,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        tasks: snapshot.tasks.map((task) =>
          task.id === taskId ? softDeleteTask(task, device.id) : task,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const reorderTasks = useCallback(
    (
      draggedTaskId: string,
      targetTaskId: string,
      placement: TaskDropPlacement,
    ) => {
      if (!device || draggedTaskId === targetTaskId) {
        return;
      }

      commitSnapshot((snapshot) => {
        const tasks = reorderTasksForDrop(
          snapshot.tasks,
          draggedTaskId,
          targetTaskId,
          placement,
          device.id,
        );

        return tasks === snapshot.tasks ? snapshot : { ...snapshot, tasks };
      });
    },
    [commitSnapshot, device],
  );

  return {
    addTask,
    deleteTask,
    reorderTasks,
    toggleTask,
    updateTaskPlannedDate,
    updateTaskSchedule,
    updateTaskText,
  };
}
