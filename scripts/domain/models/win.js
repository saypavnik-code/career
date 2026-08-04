// =========================================================
// DOMAIN — Win (Победа)
// Фиксация свершившегося достижения, привязанного к пункту
// компетенции. В отличие от старой Task, здесь нет статусов
// планирования (todo/in_progress) — Победа документирует то,
// что уже сделано, как Activity. Используется в Карте компетенций
// как раздел доказательств для итоговой аттестации.
// =========================================================
import { generateId } from '../../utils/id.js';
import { todayKey } from '../../utils/date.js';

export function createWin(input) {
  const errors = validateWin(input);
  if (errors.length) {
    const err = new Error('Win validation failed');
    err.name = 'ValidationError';
    err.details = errors;
    throw err;
  }
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: input.title.trim(),
    description: (input.description || '').trim(),
    impact: (input.impact || '').trim(),
    metric: (input.metric || '').trim(),
    date: input.date || todayKey(),
    linkedCriterionId: input.linkedCriterionId || null,
    competencyAreaId: input.competencyAreaId || null,
    targetLevel: input.targetLevel || null,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateWin(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['Некорректные данные победы'];
  if (!input.title || !input.title.trim()) errors.push('Поле "Название" обязательно');
  return errors;
}
