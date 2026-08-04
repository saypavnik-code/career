// REPOSITORY LAYER — Win
import { createBaseRepository } from './base-repository.js';
import { runRead } from '../storage/transaction.js';

const base = createBaseRepository('wins');

export const WinRepository = {
  ...base,
  async getByCompetencyArea(areaId) {
    return base.queryByIndex('competencyAreaId', areaId);
  },
  async getByCriterionId(criterionId) {
    return base.queryByIndex('linkedCriterionId', criterionId);
  },
  async getRecent(limit = 10) {
    const all = await base.getAll();
    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  },
};
