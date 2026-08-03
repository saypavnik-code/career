import { generateId } from '../../utils/id.js';
import { todayKey } from '../../utils/date.js';

export function createActivity(input) {
  const errors = validateActivity(input);
  if (errors.length) {
    const err = new Error('Activity validation failed');
    err.name = 'ValidationError';
    err.details = errors;
    throw err;
  }
  const now = new Date().toISOString();
  return {
    id: generateId(),
    date: input.date || todayKey(),
    category: input.category,
    description: input.description.trim(),
    competencyIds: normalizeIds(input.competencyIds),
    impact: (input.impact || '').trim(),
    metric: (input.metric || '').trim(),
    evidenceIds: normalizeIds(input.evidenceIds),
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
  };
}

export function validateActivity(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['Некорректные данные активности'];
  if (!input.description || !input.description.trim()) errors.push('Поле "Описание" обязательно');
  if (!input.date) errors.push('Поле "Дата" обязательно');
  if (!input.category) errors.push('Поле "Категория" обязательно');
  return errors;
}

function normalizeIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

function normalizeTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(',').map((t) => t.trim()).filter(Boolean);
}
