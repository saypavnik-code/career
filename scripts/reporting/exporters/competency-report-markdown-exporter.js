// =========================================================
// REPORTING — Markdown-экспорт "Карты компетенций"
// =========================================================
export function toCompetencyReportMarkdown(doc) {
  const s = doc.summary;
  const lines = [];

  lines.push(`# ${doc.title}${doc.employeeName ? ' — ' + doc.employeeName : ''}`);
  lines.push('');
  lines.push(`**Должность:** ${doc.currentLevelLabel}${doc.nextLevelLabel ? ` (следующий уровень: ${doc.nextLevelLabel})` : ''}`);
  lines.push(`**Сформировано:** ${new Date(doc.generatedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}`);
  lines.push(`**Общее соответствие уровню:** ${s.overallCompletionPct}%`);
  lines.push('');

  lines.push('## Сводка');
  lines.push('');
  lines.push(`- Выполнено пунктов: ${s.totalDone} из ${s.totalCriteria}`);
  lines.push(`- Направлений закрыто полностью: ${s.fullyMetAreas} из ${s.totalAreas}`);
  lines.push('');
  lines.push('**Сильные стороны:**');
  if (s.strongestAreas.length) {
    s.strongestAreas.forEach((a) => lines.push(`- ${a.areaName} — ${a.completionPct}%`));
  } else {
    lines.push('_Недостаточно данных_');
  }
  lines.push('');
  lines.push('**Зоны роста:**');
  s.weakestAreas.forEach((a) => lines.push(`- ${a.areaName} — ${a.completionPct}%`));
  lines.push('');

  lines.push('## Детализация по направлениям');
  lines.push('');
  for (const area of doc.areas) {
    lines.push(`### ${area.areaName} — ${area.completionPct}%`);
    lines.push('');
    lines.push(`_Ожидания уровня «${doc.currentLevelLabel}»_`);
    lines.push('');
    for (const c of area.currentLevelCriteria) {
      const mark = c.progress?.status === 'done' ? '[x]' : '[ ]';
      lines.push(`- ${mark} ${c.text}`);
    }
    if (doc.nextLevelLabel && area.growthCriteria.length) {
      lines.push('');
      lines.push(`_Цели роста — уровень «${doc.nextLevelLabel}»_`);
      lines.push('');
      for (const c of area.growthCriteria) {
        lines.push(`- [ ] ${c.text}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
