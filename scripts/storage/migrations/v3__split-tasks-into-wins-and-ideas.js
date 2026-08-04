// =========================================================
// MIGRATION v3 — Разделение "Задач" на "Победы" и "Идеи"
// Продуктовое решение: приложение документирует свершившееся
// (Победы), а не планирует будущее (это переехало в независимые Идеи).
//
// Существующие записи из старого стора tasks переносятся в wins
// (старая семантика "задача роста, привязанная к пункту компетенции"
// ближе к Победе, чем к свободной Идее), затем tasks удаляется.
// v1/v2 не редактируются — это чисто additive+migrate-миграция.
// =========================================================
export default {
  name: 'v3__split-tasks-into-wins-and-ideas',
  up(db, transaction) {
    if (!db.objectStoreNames.contains('wins')) {
      const wins = db.createObjectStore('wins', { keyPath: 'id' });
      wins.createIndex('date', 'date', { unique: false });
      wins.createIndex('competencyAreaId', 'competencyAreaId', { unique: false });
      wins.createIndex('linkedCriterionId', 'linkedCriterionId', { unique: false });
    }

    if (!db.objectStoreNames.contains('ideas')) {
      const ideas = db.createObjectStore('ideas', { keyPath: 'id' });
      ideas.createIndex('status', 'status', { unique: false });
      ideas.createIndex('dueDate', 'dueDate', { unique: false });
    }

    // Перенос данных из старого стора tasks (если он существует и не пуст)
    if (db.objectStoreNames.contains('tasks') && transaction) {
      const oldStore = transaction.objectStore('tasks');
      const winsStore = transaction.objectStore('wins');
      const request = oldStore.getAll();
      request.onsuccess = () => {
        const oldTasks = request.result || [];
        for (const task of oldTasks) {
          winsStore.add({
            id: task.id,
            title: task.title,
            description: task.description || '',
            impact: '',
            metric: '',
            date: (task.createdAt || new Date().toISOString()).slice(0, 10),
            linkedCriterionId: task.linkedCriterionId || null,
            competencyAreaId: task.competencyAreaId || null,
            targetLevel: task.targetLevel || null,
            createdAt: task.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        // Удаляем старый стор только после того, как все записи скопированы —
        // иначе это гонка между асинхронным getAll() и синхронным deleteObjectStore().
        db.deleteObjectStore('tasks');
      };
    }
  },
};
