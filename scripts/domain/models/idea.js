// =========================================================
// DOMAIN — Idea (Идея)
// Свободное пространство для организации мыслей и планов —
// таск-трекер, полностью независимый от шкалы компетенций.
// В отличие от Win, здесь сохраняется канбан-логика планирования
// (статусы), унаследованная от прежней сущности Task.
// =========================================================
import { generateId } from '../../utils/id.js';

export const IDEA_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

export function createIdea(input) {
  const errors = validateIdea(input);
  if (errors.length) {
    const err = new Error('Idea validation failed');
    err.name = 'ValidationError';
    err.details = errors;
    throw err;
  }
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: input.title.trim(),
    description: (input.description || '').trim(),
    dueDate: input.dueDate || null,
    status: IDEA_STATUS.TODO,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateIdea(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['Некорректные данные идеи'];
  if (!input.title || !input.title.trim()) errors.push('Поле "Название" обязательно');
  return errors;
}

export function updateIdeaStatus(idea, status) {
  return { ...idea, status, updatedAt: new Date().toISOString() };
}
