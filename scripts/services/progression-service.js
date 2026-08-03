// =========================================================
// APPLICATION LAYER — Профессиональный рост
// Оркестрация: должность пользователя + шкала компетенций +
// прогресс по пунктам + подсказки-доказательства из активностей.
// =========================================================
import { COMPETENCY_SCALE, LEVEL_LABELS } from '../domain/data/competency-scale.js';
import { calculateProgressionGaps, overallCompletionPct, nextLevel } from '../domain/rules/progression-gap.js';
import { findPotentialEvidence } from '../domain/rules/evidence-matching.js';
import { CriterionProgressRepository } from '../repositories/criterion-progress-repository.js';
import { ActivityRepository } from '../repositories/activity-repository.js';
import { createCriterionProgress, markProgress, PROGRESS_STATUS } from '../domain/models/criterion-progress.js';
import { LocalSettings } from '../storage/local-settings.js';
import { bus } from './event-bus.js';

const SETTINGS_KEY = 'currentPosition';

export const ProgressionService = {
  LEVEL_LABELS,

  getCurrentPosition() {
    return LocalSettings.get(SETTINGS_KEY) || null;
  },

  setCurrentPosition(level) {
    LocalSettings.set(SETTINGS_KEY, level);
    bus.emit('position:changed', { level });
  },

  getNextLevel(level) {
    return nextLevel(level);
  },

  /** Полная картина: пробелы текущего уровня + цели роста для следующего, по всем 12 областям. */
  async getProgressionOverview(currentLevel) {
    const progressMap = await CriterionProgressRepository.getAllAsMap();
    const areas = calculateProgressionGaps(currentLevel, COMPETENCY_SCALE, progressMap);
    return { areas, overallCompletionPct: overallCompletionPct(areas) };
  },

  /** Подсказка: какие уже зафиксированные активности могут быть доказательством для этого пункта. */
  async suggestEvidence(criterionText) {
    const activities = await ActivityRepository.getAll();
    return findPotentialEvidence(criterionText, activities);
  },

  async setCriterionStatus(criterionId, status, linkedActivityIds) {
    const existing = await CriterionProgressRepository.getByCriterionId(criterionId);
    if (existing) {
      const updated = markProgress(existing, status, linkedActivityIds);
      await CriterionProgressRepository.update(updated);
      bus.emit('progress:updated', updated);
      return updated;
    }
    const created = createCriterionProgress({ criterionId, status, linkedActivityIds });
    await CriterionProgressRepository.add(created);
    bus.emit('progress:updated', created);
    return created;
  },
};
