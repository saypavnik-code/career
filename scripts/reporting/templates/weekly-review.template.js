import { categoryLabel } from '../../domain/enums/categories.js';
import { formatWeekLabel } from '../../utils/date.js';

export function buildWeeklyReviewDocument({ weekStart, weekEnd, activities, competencies }) {
  const competencyById = new Map(competencies.map((c) => [c.id, c.name]));
  const byCompetency = groupBy(activities, (a) => (a.competencyIds && a.competencyIds[0]) || 'unassigned');
  const byCategory = groupBy(activities, (a) => a.category);
  const withMetrics = activities.filter((a) => a.metric);

  return {
    title: 'Отчёт по развитию компетенций (Weekly Review)',
    period: formatWeekLabel(weekStart, weekEnd),
    generatedAt: new Date().toISOString(),
    sections: [
      {
        heading: 'Резюме влияния на бизнес',
        summary: `Всего зафиксировано активностей: ${activities.length}`,
        items: withMetrics.length ? withMetrics.map((a) => `${a.description} — метрика: ${a.metric}`) : ['Метрик не зафиксировано за этот период.'],
      },
      {
        heading: 'Прогресс по компетенциям',
        groups: Object.entries(byCompetency).map(([id, items]) => ({
          groupTitle: competencyById.get(id) || 'Без компетенции',
          items: items.map((a) => `${a.description}${a.impact ? ` (влияние: ${a.impact})` : ''}`),
        })),
      },
      {
        heading: 'Бизнес-ценность по категориям',
        groups: Object.entries(byCategory).map(([cat, items]) => ({
          groupTitle: categoryLabel(cat),
          items: items.map((a) => `${a.description}${a.evidenceIds?.length ? ' (есть подтверждение)' : ''}`),
        })),
      },
    ],
  };
}

function groupBy(list, keyFn) {
  return list.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}
