// =========================================================
// DOMAIN RULES — расчёт пробелов и целей роста
// Чистая функция: (должность, шкала, прогресс пользователя) ->
// для каждой из 12 областей — что нужно сделать, чтобы соответствовать
// текущему уровню, и что можно сделать, чтобы превзойти его (следующий уровень).
// =========================================================
import { LEVELS } from '../data/competency-scale.js';

const LEVEL_ORDER = { specialist: 0, senior: 1, lead: 2 };

export function nextLevel(level) {
  const idx = LEVEL_ORDER[level];
  if (idx === undefined || idx >= LEVELS.length - 1) return null;
  return LEVELS[idx + 1];
}

/**
 * @param {string} currentLevel — 'specialist' | 'senior' | 'lead'
 * @param {Array} competencyScale — COMPETENCY_SCALE
 * @param {Map<string,object>} progressByCriterionId — criterionId -> CriterionProgress
 * @returns {Array<{areaId, areaName, currentLevelCriteria, gaps, growthCriteria, completionPct}>}
 */
export function calculateProgressionGaps(currentLevel, competencyScale, progressByCriterionId) {
  const nl = nextLevel(currentLevel);

  return competencyScale.map((area) => {
    const currentCriteria = area.levels[currentLevel] || [];
    const growthCriteria = nl ? area.levels[nl] || [] : [];

    const withStatus = (criteria) =>
      criteria.map((c) => ({ ...c, progress: progressByCriterionId.get(c.id) || null }));

    const currentWithStatus = withStatus(currentCriteria);
    const gaps = currentWithStatus.filter((c) => c.progress?.status !== 'done');
    const doneCount = currentWithStatus.length - gaps.length;
    const completionPct = currentCriteria.length ? Math.round((doneCount / currentCriteria.length) * 100) : 0;

    return {
      areaId: area.id,
      areaName: area.name,
      currentLevelCriteria: currentWithStatus,
      gaps,
      growthCriteria: withStatus(growthCriteria),
      completionPct,
    };
  });
}

export function overallCompletionPct(gapsResult) {
  if (!gapsResult.length) return 0;
  const total = gapsResult.reduce((sum, a) => sum + a.completionPct, 0);
  return Math.round(total / gapsResult.length);
}
