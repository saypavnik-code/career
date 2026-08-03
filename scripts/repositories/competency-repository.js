import { createBaseRepository } from './base-repository.js';
const base = createBaseRepository('competencies');
export const CompetencyRepository = {
  ...base,
  async getActive() {
    const all = await base.getAll();
    return all.filter((c) => !c.archived);
  },
};
