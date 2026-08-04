// =========================================================
// APPLICATION LAYER — Win (Победа) use-cases
// Фиксация свершившихся достижений — не планирование, а документирование.
// =========================================================
import { WinRepository } from '../repositories/win-repository.js';
import { createWin } from '../domain/models/win.js';
import { bus } from './event-bus.js';

export const WinService = {
  async recordWin(input) {
    const win = createWin(input);
    await WinRepository.add(win);
    bus.emit('win:created', win);
    return win;
  },

  async getAll() {
    return WinRepository.getAll();
  },

  async getRecent(limit = 10) {
    return WinRepository.getRecent(limit);
  },

  async deleteWin(winId) {
    await WinRepository.delete(winId);
    bus.emit('win:deleted', { id: winId });
  },

  /** Фиксирует победу напрямую из пункта компетенции — переносит формулировку пункта в title. */
  async recordFromCriterion({ criterion, areaId, areaName, level, impact, metric }) {
    return this.recordWin({
      title: criterion.text,
      description: `Достижение по направлению: ${areaName}`,
      impact: impact || '',
      metric: metric || '',
      linkedCriterionId: criterion.id,
      competencyAreaId: areaId,
      targetLevel: level,
    });
  },
};
