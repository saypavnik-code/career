import { ActivityRepository } from '../repositories/activity-repository.js';
import { createActivity } from '../domain/models/activity.js';
import { getWeekRange, toDateKey } from '../utils/date.js';
import { bus } from './event-bus.js';

export const ActivityService = {
  async captureActivity(formInput) {
    const activity = createActivity(formInput);
    await ActivityRepository.add(activity);
    bus.emit('activity:created', activity);
    return activity;
  },
  async getCurrentWeekActivities(referenceDate = new Date()) {
    const { start, end } = getWeekRange(referenceDate);
    return ActivityRepository.getByWeek(toDateKey(start), toDateKey(end));
  },
  async getAll() { return ActivityRepository.getAll(); },
  async getRecent(limit = 5) { return ActivityRepository.getRecent(limit); },
  async deleteActivity(id) {
    await ActivityRepository.delete(id);
    bus.emit('activity:deleted', { id });
  },
};
