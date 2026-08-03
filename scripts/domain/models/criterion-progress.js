// =========================================================
// DOMAIN — CriterionProgress
// Прогресс пользователя по одному пункту компетенции (criterion).
// Ручная отметка + опциональная привязка Activity как доказательства.
// =========================================================
import { generateId } from '../../utils/id.js';

export const PROGRESS_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

export function createCriterionProgress({ criterionId, status = PROGRESS_STATUS.NOT_STARTED, linkedActivityIds = [] }) {
  if (!criterionId) throw new Error('criterionId обязателен');
  const now = new Date().toISOString();
  return {
    id: generateId(),
    criterionId,
    status,
    linkedActivityIds: [...linkedActivityIds],
    confirmedAt: status === PROGRESS_STATUS.DONE ? now : null,
    updatedAt: now,
  };
}

export function markProgress(progress, status, linkedActivityIds) {
  const now = new Date().toISOString();
  return {
    ...progress,
    status,
    linkedActivityIds: linkedActivityIds !== undefined ? linkedActivityIds : progress.linkedActivityIds,
    confirmedAt: status === PROGRESS_STATUS.DONE ? now : progress.confirmedAt,
    updatedAt: now,
  };
}
