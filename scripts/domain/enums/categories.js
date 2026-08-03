export const CATEGORIES = [
  { value: 'seo_geo', label: 'SEO / GEO / AEO' },
  { value: 'ads', label: 'Google Ads' },
  { value: 'ai', label: 'ИИ-процессы' },
  { value: 'localization', label: 'Локализация' },
  { value: 'pr', label: 'PR и медиа' },
  { value: 'analytics', label: 'Аналитика' },
  { value: 'strategy', label: 'Стратегия' },
];
export function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
