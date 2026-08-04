// REPOSITORY LAYER — Idea
import { createBaseRepository } from './base-repository.js';

const base = createBaseRepository('ideas');

export const IdeaRepository = {
  ...base,
  async getByStatus(status) {
    return base.queryByIndex('status', status);
  },
};
