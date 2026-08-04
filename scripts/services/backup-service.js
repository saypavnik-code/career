import { ActivityRepository } from '../repositories/activity-repository.js';
import { CompetencyRepository } from '../repositories/competency-repository.js';
import { EvidenceRepository } from '../repositories/evidence-repository.js';
import { BackupRepository } from '../repositories/backup-repository.js';
import { CriterionProgressRepository } from '../repositories/criterion-progress-repository.js';
import { WinRepository } from '../repositories/win-repository.js';
import { IdeaRepository } from '../repositories/idea-repository.js';
import { CURRENT_SCHEMA_VERSION } from '../storage/db.js';
import { LocalSettings } from '../storage/local-settings.js';
import { generateId } from '../utils/id.js';

const REPOSITORIES = {
  activities: ActivityRepository,
  competencies: CompetencyRepository,
  evidence: EvidenceRepository,
  criterion_progress: CriterionProgressRepository,
  wins: WinRepository,
  ideas: IdeaRepository,
};

export const BackupService = {
  async exportAll() {
    const stores = {};
    const entityCounts = {};
    for (const [name, repo] of Object.entries(REPOSITORIES)) {
      const records = await repo.getAll();
      stores[name] = records;
      entityCounts[name] = records.length;
    }
    const payload = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      stores,
      settings: { currentPosition: LocalSettings.get('currentPosition') },
    };
    await BackupRepository.add({ id: generateId(), timestamp: payload.exportedAt, trigger: 'manual', entityCounts });
    return payload;
  },
  downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },
  async triggerManualExport() {
    const payload = await this.exportAll();
    const dateStr = payload.exportedAt.slice(0, 10);
    this.downloadJson(payload, `backup_competencies_${dateStr}.json`);
    LocalSettings.set('lastBackupDate', dateStr);
    return payload;
  },
  validateImportPayload(payload) {
    const errors = [];
    if (!payload || typeof payload !== 'object') { errors.push('Файл повреждён или имеет неверный формат.'); return errors; }
    if (!payload.stores || typeof payload.stores !== 'object') errors.push('В файле отсутствует раздел "stores".');
    if (typeof payload.schemaVersion !== 'number') errors.push('В файле отсутствует версия схемы.');
    return errors;
  },
  async importAll(payload) {
    const errors = this.validateImportPayload(payload);
    if (errors.length) {
      const err = new Error('Некорректный файл резервной копии');
      err.details = errors;
      throw err;
    }
    for (const [name, repo] of Object.entries(REPOSITORIES)) {
      const records = payload.stores[name];
      if (!Array.isArray(records)) continue;
      await repo.clear();
      for (const record of records) await repo.add(record);
    }
    if (payload.settings?.currentPosition) {
      LocalSettings.set('currentPosition', payload.settings.currentPosition);
    }
    return true;
  },
  checkAutoBackup() {
    const today = new Date();
    const isFriday = today.getDay() === 5;
    const lastBackup = LocalSettings.get('lastBackupDate');
    const todayKeyStr = today.toISOString().slice(0, 10);
    if (isFriday && lastBackup !== todayKeyStr) this.triggerManualExport();
  },
};
