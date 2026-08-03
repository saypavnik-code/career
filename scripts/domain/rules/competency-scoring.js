export function countActivitiesByCompetency(activities, competencies) {
  const counts = new Map();
  for (const activity of activities) {
    for (const id of activity.competencyIds || []) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return competencies
    .map((c) => ({ competencyId: c.id, name: c.name, count: counts.get(c.id) || 0 }))
    .sort((a, b) => b.count - a.count);
}

export function countActivitiesByCategory(activities) {
  const counts = new Map();
  for (const activity of activities) counts.set(activity.category, (counts.get(activity.category) || 0) + 1);
  return counts;
}

export function uniqueActiveDays(activities) {
  return new Set(activities.map((a) => a.date)).size;
}
