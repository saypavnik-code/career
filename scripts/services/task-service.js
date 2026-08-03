// =========================================================
// APPLICATION LAYER — Task use-cases
// =========================================================
import { TaskRepository } from '../repositories/task-repository.js';
import { createTask, updateTaskStatus, TASK_STATUS } from '../domain/models/task.js';
import { bus } from './event-bus.js';

export const TaskService = {
  TASK_STATUS,

  async createTask(input) {
    const task = createTask(input);
    await TaskRepository.add(task);
    bus.emit('task:created', task);
    return task;
  },

  async getAll() {
    return TaskRepository.getAll();
  },

  async getByStatus(status) {
    return TaskRepository.getByStatus(status);
  },

  async setStatus(taskId, status) {
    const task = await TaskRepository.getById(taskId);
    if (!task) throw new Error('Задача не найдена');
    const updated = updateTaskStatus(task, status);
    await TaskRepository.update(updated);
    bus.emit('task:updated', updated);
    return updated;
  },

  async deleteTask(taskId) {
    await TaskRepository.delete(taskId);
    bus.emit('task:deleted', { id: taskId });
  },

  /** Создаёт задачу роста напрямую из пункта компетенции. */
  async createFromCriterion({ criterion, areaId, areaName, level, dueDate }) {
    return this.createTask({
      title: criterion.text,
      description: `Цель роста: ${areaName}`,
      linkedCriterionId: criterion.id,
      competencyAreaId: areaId,
      targetLevel: level,
      dueDate: dueDate || null,
    });
  },
};
