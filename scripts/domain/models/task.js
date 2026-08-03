// =========================================================
// DOMAIN — Task
// Полноценная задача роста, привязанная к пункту компетенции.
// =========================================================
import { generateId } from '../../utils/id.js';

export const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

export function createTask(input) {
  const errors = validateTask(input);
  if (errors.length) {
    const err = new Error('Task validation failed');
    err.name = 'ValidationError';
    err.details = errors;
    throw err;
  }
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: input.title.trim(),
    description: (input.description || '').trim(),
    linkedCriterionId: input.linkedCriterionId || null,
    competencyAreaId: input.competencyAreaId || null,
    targetLevel: input.targetLevel || null,
    dueDate: input.dueDate || null,
    status: TASK_STATUS.TODO,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateTask(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['Некорректные данные задачи'];
  if (!input.title || !input.title.trim()) errors.push('Поле "Название" обязательно');
  return errors;
}

export function updateTaskStatus(task, status) {
  return { ...task, status, updatedAt: new Date().toISOString() };
}
