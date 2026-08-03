// =========================================================
// REPORTING — шаблон "Карта компетенций"
// Полный презентационный отчёт для руководства: соответствие
// сотрудника всей шкале компетенций отдела (12 направлений),
// с прогрессом по текущему уровню и целями роста.
// Отвечает только за СТРУКТУРУ И СОДЕРЖАНИЕ — не за формат вывода.
// =========================================================
import { LEVEL_LABELS } from '../../domain/data/competency-scale.js';
import { calculateProgressionGaps, overallCompletionPct, nextLevel } from '../../domain/rules/progression-gap.js';

/**
 * @param {object} params
 * @param {string} params.currentLevel — 'specialist' | 'senior' | 'lead'
 * @param {Array} params.competencyScale — COMPETENCY_SCALE
 * @param {Map} params.progressByCriterionId — criterionId -> CriterionProgress
 * @param {string} [params.employeeName] — опционально, для персонализации отчёта
 * @returns {object} структурированный документ отчёта
 */
export function buildCompetencyReportDocument({ currentLevel, competencyScale, progressByCriterionId, employeeName }) {
  const areas = calculateProgressionGaps(currentLevel, competencyScale, progressByCriterionId);
  const overall = overallCompletionPct(areas);
  const nl = nextLevel(currentLevel);

  const totalCriteria = areas.reduce((sum, a) => sum + a.currentLevelCriteria.length, 0);
  const totalDone = areas.reduce((sum, a) => sum + (a.currentLevelCriteria.length - a.gaps.length), 0);
  const fullyMetAreas = areas.filter((a) => a.completionPct === 100).length;
  const weakestAreas = [...areas].sort((a, b) => a.completionPct - b.completionPct).slice(0, 3);
  const strongestAreas = [...areas]
    .filter((a) => a.completionPct > 0)
    .sort((a, b) => b.completionPct - a.completionPct)
    .slice(0, 3);

  return {
    title: 'Карта компетенций',
    employeeName: employeeName || null,
    currentLevel,
    currentLevelLabel: LEVEL_LABELS[currentLevel],
    nextLevel: nl,
    nextLevelLabel: nl ? LEVEL_LABELS[nl] : null,
    generatedAt: new Date().toISOString(),
    summary: {
      overallCompletionPct: overall,
      totalCriteria,
      totalDone,
      totalAreas: areas.length,
      fullyMetAreas,
      weakestAreas: weakestAreas.map((a) => ({ areaName: a.areaName, completionPct: a.completionPct })),
      strongestAreas: strongestAreas.map((a) => ({ areaName: a.areaName, completionPct: a.completionPct })),
    },
    areas,
  };
}
