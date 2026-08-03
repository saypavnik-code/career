// STORAGE LAYER — IndexedDB connection. Единственный модуль, открывающий БД.
import { migrations } from './migrations/index.js';

const DB_NAME = 'CompetencyDevDB';
export const CURRENT_SCHEMA_VERSION = migrations.length;

let dbInstance = null;
let openPromise = null;

export function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (openPromise) return openPromise;

  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, CURRENT_SCHEMA_VERSION);
    const appliedVersions = [];

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const fromVersion = event.oldVersion;
      const toVersion = event.newVersion;
      for (let v = fromVersion + 1; v <= toVersion; v++) {
        const migration = migrations[v - 1];
        if (!migration) continue;
        try {
          migration.up(db);
          appliedVersions.push({ version: v, name: migration.name, success: true });
        } catch (err) {
          appliedVersions.push({ version: v, name: migration.name, success: false, error: String(err) });
          throw err;
        }
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      if (appliedVersions.length) {
        recordVersionHistory(dbInstance, appliedVersions).catch(() => {});
      }
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => console.warn('IndexedDB upgrade заблокирован другой открытой вкладкой.');
  });

  return openPromise;
}

async function recordVersionHistory(db, appliedVersions) {
  if (!db.objectStoreNames.contains('_meta_versions')) return;
  const tx = db.transaction('_meta_versions', 'readwrite');
  const store = tx.objectStore('_meta_versions');
  const now = new Date().toISOString();
  for (const entry of appliedVersions) {
    store.add({
      id: `v${entry.version}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      schemaVersion: entry.version,
      migrationScript: entry.name,
      appliedAt: now,
      success: entry.success,
    });
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
