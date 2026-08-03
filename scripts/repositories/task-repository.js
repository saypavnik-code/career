// REPOSITORY LAYER — Task
import { createBaseRepository } from './base-repository.js';

const base = createBaseRepository('tasks');

export const TaskRepository = {
  ...base,
  async getByStatus(status) {
    return base.queryByIndex('status', status);
  },
  async getByCompetencyArea(areaId) {
    return base.queryByIndex('competencyAreaId', areaId);
  },
};
