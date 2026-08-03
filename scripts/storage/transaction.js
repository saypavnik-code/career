// STORAGE LAYER — обёртки транзакций в Promise
import { openDatabase } from './db.js';

export class RepositoryError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'RepositoryError';
    this.cause = cause;
  }
}

function wrapRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new RepositoryError('IndexedDB request failed', request.error));
  });
}

export async function runRead(storeName, fn) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  return fn(store, wrapRequest);
}

export function runWrite(storeName, fn) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        let result;
        try {
          result = fn(store, wrapRequest);
        } catch (err) {
          reject(new RepositoryError('Write operation threw synchronously', err));
          return;
        }
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(new RepositoryError('Transaction failed', tx.error));
        tx.onabort = () => reject(new RepositoryError('Transaction aborted', tx.error));
      })
  );
}
