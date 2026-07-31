import type { Task } from "../../types";
import { getVisibleTasks, updateTask } from "./taskService";

export type TaskDropPlacement = "before" | "after";

export function reorderTasksForDrop(
  tasks: Task[],
  draggedTaskId: string,
  targetTaskId: string,
  placement: TaskDropPlacement,
  deviceId: string,
): Task[] {
  if (draggedTaskId === targetTaskId) {
    return tasks;
  }

  const currentVisibleTasks = getVisibleTasks(tasks);
  const targetExists = currentVisibleTasks.some(
    (task) => task.id === targetTaskId,
  );
  const draggedTask = currentVisibleTasks.find(
    (task) => task.id === draggedTaskId,
  );

  if (!draggedTask || !targetExists) {
    return tasks;
  }

  const reorderedTasks = currentVisibleTasks.filter(
    (task) => task.id !== draggedTaskId,
  );
  const targetIndex = reorderedTasks.findIndex(
    (task) => task.id === targetTaskId,
  );

  if (targetIndex < 0) {
    return tasks;
  }

  reorderedTasks.splice(
    placement === "after" ? targetIndex + 1 : targetIndex,
    0,
    draggedTask,
  );

  const nextOrderById = new Map(
    reorderedTasks.map((task, index) => [task.id, index]),
  );

  return tasks.map((task) => {
    const nextOrderIndex = nextOrderById.get(task.id);

    if (
      nextOrderIndex === undefined ||
      task.orderIndex === nextOrderIndex
    ) {
      return task;
    }

    return updateTask(task, { orderIndex: nextOrderIndex }, deviceId);
  });
}
