// REPOSITORY LAYER — CriterionProgress
import { createBaseRepository } from './base-repository.js';
import { runRead } from '../storage/transaction.js';

const base = createBaseRepository('criterion_progress');

export const CriterionProgressRepository = {
  ...base,
  async getByCriterionId(criterionId) {
    return runRead('criterion_progress', (store, wrap) => wrap(store.index('criterionId').get(criterionId)));
  },
  /** Возвращает Map<criterionId, progress> для быстрого доступа при рендере шкалы. */
  async getAllAsMap() {
    const all = await base.getAll();
    return new Map(all.map((p) => [p.criterionId, p]));
  },
};
