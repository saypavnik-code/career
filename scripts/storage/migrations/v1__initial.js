// Файлы миграций никогда не редактируются после публикации.
export default {
  name: 'v1__initial',
  up(db) {
    if (!db.objectStoreNames.contains('activities')) {
      const activities = db.createObjectStore('activities', { keyPath: 'id' });
      activities.createIndex('date', 'date', { unique: false });
      activities.createIndex('competencyIds', 'competencyIds', { unique: false, multiEntry: true });
      activities.createIndex('category', 'category', { unique: false });
    }
    if (!db.objectStoreNames.contains('competencies')) {
      const competencies = db.createObjectStore('competencies', { keyPath: 'id' });
      competencies.createIndex('archived', 'archived', { unique: false });
    }
    if (!db.objectStoreNames.contains('evidence')) {
      const evidence = db.createObjectStore('evidence', { keyPath: 'id' });
      evidence.createIndex('capturedDate', 'capturedDate', { unique: false });
      evidence.createIndex('type', 'type', { unique: false });
    }
    if (!db.objectStoreNames.contains('_meta_versions')) {
      db.createObjectStore('_meta_versions', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('backups')) {
      const backups = db.createObjectStore('backups', { keyPath: 'id' });
      backups.createIndex('timestamp', 'timestamp', { unique: false });
    }
  },
};
