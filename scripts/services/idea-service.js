// =========================================================
// APPLICATION LAYER — Idea use-cases
// Независимый таск-трекер для мыслей и планов, без связи со шкалой компетенций.
// =========================================================
import { IdeaRepository } from '../repositories/idea-repository.js';
import { createIdea, updateIdeaStatus, IDEA_STATUS } from '../domain/models/idea.js';
import { bus } from './event-bus.js';

export const IdeaService = {
  IDEA_STATUS,

  async createIdea(input) {
    const idea = createIdea(input);
    await IdeaRepository.add(idea);
    bus.emit('idea:created', idea);
    return idea;
  },

  async getAll() {
    return IdeaRepository.getAll();
  },

  async getByStatus(status) {
    return IdeaRepository.getByStatus(status);
  },

  async setStatus(ideaId, status) {
    const idea = await IdeaRepository.getById(ideaId);
    if (!idea) throw new Error('Идея не найдена');
    const updated = updateIdeaStatus(idea, status);
    await IdeaRepository.update(updated);
    bus.emit('idea:updated', updated);
    return updated;
  },

  async deleteIdea(ideaId) {
    await IdeaRepository.delete(ideaId);
    bus.emit('idea:deleted', { id: ideaId });
  },
};
