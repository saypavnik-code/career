import { createBaseRepository } from './base-repository.js';
const base = createBaseRepository('backups');
export const BackupRepository = {
  ...base,
  async getLatest() {
    const all = await base.getAll();
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] || null;
  },
};
