import { CompetencyRepository } from '../repositories/competency-repository.js';
import { DEFAULT_COMPETENCIES } from '../domain/enums/competencies.js';
import { generateId } from '../utils/id.js';

export const CompetencyService = {
  async ensureSeeded() {
    const existing = await CompetencyRepository.getAll();
    if (existing.length > 0) return existing;
    const now = new Date().toISOString();
    const seeded = [];
    for (const def of DEFAULT_COMPETENCIES) {
      const record = { id: generateId(), archived: false, createdAt: now, updatedAt: now, ...def };
      await CompetencyRepository.add(record);
      seeded.push(record);
    }
    return seeded;
  },
  async getActive() { return CompetencyRepository.getActive(); },
};
