// REPOSITORY LAYER — базовый CRUD. Возвращает только простые объекты.
import { runRead, runWrite, RepositoryError } from '../storage/transaction.js';

export function createBaseRepository(storeName) {
  return {
    storeName,
    async add(record) {
      return runWrite(storeName, (store) => { store.add(record); return record; });
    },
    async update(record) {
      if (!record.id) throw new RepositoryError('update() requires a record with an id');
      return runWrite(storeName, (store) => { store.put(record); return record; });
    },
    async getById(id) {
      return runRead(storeName, (store, wrap) => wrap(store.get(id)));
    },
    async getAll() {
      return runRead(storeName, (store, wrap) => wrap(store.getAll()));
    },
    async delete(id) {
      return runWrite(storeName, (store) => { store.delete(id); return true; });
    },
    async count() {
      return runRead(storeName, (store, wrap) => wrap(store.count()));
    },
    async clear() {
      return runWrite(storeName, (store) => { store.clear(); return true; });
    },
    async queryByIndex(indexName, query) {
      return runRead(storeName, (store, wrap) => wrap(store.index(indexName).getAll(query)));
    },
  };
}
