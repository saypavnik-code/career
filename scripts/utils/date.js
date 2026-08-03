export function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  if (day !== 1) d.setHours(-24 * (day - 1));
  d.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: d, end };
}
export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}
export function todayKey() { return toDateKey(new Date()); }
export function formatShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}
export function formatWeekLabel(start, end) {
  return `${formatShort(start)} – ${formatShort(end)}`;
}
