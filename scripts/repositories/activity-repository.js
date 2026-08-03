import { createBaseRepository } from './base-repository.js';
import { runRead } from '../storage/transaction.js';

const base = createBaseRepository('activities');

export const ActivityRepository = {
  ...base,
  async getByWeek(start, end) {
    return runRead('activities', (store, wrap) => {
      const range = IDBKeyRange.bound(toDateKey(start), toDateKey(end));
      return wrap(store.index('date').getAll(range));
    });
  },
  async getByCompetencyId(competencyId) {
    return base.queryByIndex('competencyIds', competencyId);
  },
  async getRecent(limit = 5) {
    const all = await base.getAll();
    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  },
};

function toDateKey(date) {
  return typeof date === 'string' ? date : date.toISOString().slice(0, 10);
}
