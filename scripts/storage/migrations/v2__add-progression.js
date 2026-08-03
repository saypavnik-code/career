// =========================================================
// MIGRATION v2 — Профессиональный рост
// Добавляет сторы для шкалы компетенций: прогресс по пунктам,
// задачи роста, выбранная текущая должность.
// v1 не редактируется — это чисто additive-миграция.
// =========================================================
export default {
  name: 'v2__add-progression',
  up(db) {
    if (!db.objectStoreNames.contains('criterion_progress')) {
      const progress = db.createObjectStore('criterion_progress', { keyPath: 'id' });
      progress.createIndex('criterionId', 'criterionId', { unique: true });
      progress.createIndex('status', 'status', { unique: false });
    }

    if (!db.objectStoreNames.contains('tasks')) {
      const tasks = db.createObjectStore('tasks', { keyPath: 'id' });
      tasks.createIndex('status', 'status', { unique: false });
      tasks.createIndex('competencyAreaId', 'competencyAreaId', { unique: false });
      tasks.createIndex('linkedCriterionId', 'linkedCriterionId', { unique: false });
      tasks.createIndex('dueDate', 'dueDate', { unique: false });
    }
  },
};
