// =========================================================
// REPORTING — HTML-экспорт "Карты компетенций"
// Презентационный документ для руководства. Использует ту же
// светлую, мягкую палитру, что и живое приложение (design v2:
// нежный голубой / тёплый оранжевый / нежный лайм), но верстается
// отдельно от generic report exporter'а — здесь нужна визуальная
// карта (прогресс-бары, статусы), а не список.
// =========================================================
import { escapeHtml } from '../../utils/dom.js';

function renderCriterionLine(criterion, doneIcon) {
  const isDone = criterion.progress?.status === 'done';
  const icon = isDone ? doneIcon.done : doneIcon.pending;
  const color = isDone ? '#6B9E3F' : '#80868B';
  return `
    <div style="display:flex; align-items:flex-start; gap:8px; padding:6px 0; font-size:14px; line-height:1.5;">
      <span style="flex-shrink:0; width:18px; height:18px; margin-top:1px; color:${color};">${icon}</span>
      <span style="color:${isDone ? '#1A1A1A' : '#5F6368'};">${escapeHtml(criterion.text)}</span>
    </div>
  `;
}

const ICON_DONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const ICON_PENDING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>';

function renderWinLine(win) {
  const dateStr = new Date(win.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
  return `
    <div style="padding:10px 14px; background:#F1F8E9; border-left:3px solid #8BC34A; border-radius:8px; margin-bottom:8px; font-size:14px;">
      <div style="display:flex; justify-content:space-between; gap:8px;">
        <span style="color:#1A1A1A; font-weight:500;">${escapeHtml(win.title)}</span>
        <span style="color:#5F6368; flex-shrink:0; font-size:12px;">${dateStr}</span>
      </div>
      ${win.impact ? `<div style="color:#4F7A2C; margin-top:2px;">${escapeHtml(win.impact)}</div>` : ''}
    </div>
  `;
}

function renderAreaBlock(area, currentLevelLabel, nextLevelLabel) {
  const barColor = area.completionPct === 100 ? '#8BC34A' : area.completionPct >= 50 ? '#357AB8' : '#F4A261';
  const statusBadge = area.completionPct === 100
    ? `<span style="display:inline-flex; align-items:center; padding:4px 10px; font-size:12px; font-weight:600; border-radius:8px; background:#F1F8E9; color:#4F7A2C;">Соответствует</span>`
    : `<span style="display:inline-flex; align-items:center; padding:4px 10px; font-size:12px; font-weight:600; border-radius:8px; background:#FDF0E4; color:#B5651A;">${area.gaps.length} пункт(ов) осталось</span>`;

  return `
    <div style="page-break-inside: avoid; border:1px solid #E8EAED; border-radius:16px; padding:24px; margin-bottom:20px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px;">
        <div style="font-size:18px; font-weight:600; color:#1A1A1A;">${escapeHtml(area.areaName)}</div>
        ${statusBadge}
      </div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
        <div style="flex:1; background:#F8F9FA; border-radius:999px; height:10px; overflow:hidden;">
          <div style="width:${area.completionPct}%; background:${barColor}; height:100%; border-radius:999px;"></div>
        </div>
        <div style="font-weight:700; font-size:16px; width:48px; text-align:right; color:#1A1A1A;">${area.completionPct}%</div>
      </div>
      <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#80868B; margin-bottom:6px;">
        Ожидания уровня «${escapeHtml(currentLevelLabel)}»
      </div>
      <div>${area.currentLevelCriteria.map((c) => renderCriterionLine(c, { done: ICON_DONE, pending: ICON_PENDING })).join('')}</div>
      ${nextLevelLabel && area.growthCriteria.length ? `
        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#80868B; margin:20px 0 6px;">
          Цели роста — уровень «${escapeHtml(nextLevelLabel)}»
        </div>
        <div style="opacity:0.85;">${area.growthCriteria.map((c) => renderCriterionLine(c, { done: ICON_DONE, pending: ICON_PENDING })).join('')}</div>
      ` : ''}
      ${area.wins && area.wins.length ? `
        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#4F7A2C; margin:20px 0 6px;">
          Зафиксированные победы (${area.wins.length})
        </div>
        <div>${area.wins.map(renderWinLine).join('')}</div>
      ` : ''}
    </div>
  `;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function toCompetencyReportHtml(doc) {
  const s = doc.summary;

  const areasHtml = doc.areas.map((area) => renderAreaBlock(area, doc.currentLevelLabel, doc.nextLevelLabel)).join('');

  const weakestHtml = s.weakestAreas.map((a) => `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #F8F9FA; font-size:14px;">
      <span>${escapeHtml(a.areaName)}</span>
      <span style="font-weight:600; color:${a.completionPct >= 50 ? '#B5651A' : '#C0392B'};">${a.completionPct}%</span>
    </div>
  `).join('');

  const strongestHtml = s.strongestAreas.map((a) => `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #F8F9FA; font-size:14px;">
      <span>${escapeHtml(a.areaName)}</span>
      <span style="font-weight:600; color:#4F7A2C;">${a.completionPct}%</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(doc.title)}${doc.employeeName ? ' — ' + escapeHtml(doc.employeeName) : ''}</title>
<style>
  @page { margin: 24mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    color: #1A1A1A;
    background: #F8F9FA;
    margin: 0;
    padding: 48px 20px;
    font-feature-settings: 'tnum';
    font-variant-numeric: tabular-nums;
  }
  .report { max-width: 800px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px -2px rgba(26,26,26,0.08); }
  .report-header { background: #22252A; color: #FFFFFF; padding: 40px; }
  .report-header .eyebrow { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.5); margin-bottom: 10px; }
  .report-header h1 { font-size: 32px; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.02em; }
  .report-header .subtitle { font-size: 15px; color: rgba(255,255,255,0.7); }
  .report-header .meta { margin-top: 24px; display:flex; gap: 32px; flex-wrap: wrap; }
  .report-header .meta-item .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.5); }
  .report-header .meta-item .value { font-size: 16px; font-weight: 600; color: #FFFFFF; margin-top: 4px; }
  .body-content { padding: 40px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 40px; }
  .summary-card { border: 1px solid #E8EAED; border-radius: 12px; padding: 20px; text-align: center; }
  .summary-card .num { font-size: 32px; font-weight: 700; color: #357AB8; }
  .summary-card .label { font-size: 12px; color: #5F6368; margin-top: 6px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
  .two-col h3 { font-size: 16px; font-weight: 600; margin: 0 0 10px; }
  h2.section-title { font-size: 20px; font-weight: 700; margin: 40px 0 20px; padding-bottom: 10px; border-bottom: 2px solid #1A1A1A; }
  .report-footer { padding: 24px 40px; border-top: 1px solid #E8EAED; font-size: 11px; color: #80868B; text-align: center; }
  @media print {
    body { background: #FFFFFF; padding: 0; }
    .report { box-shadow: none; border-radius: 0; max-width: 100%; }
  }
</style>
</head>
<body>
  <div class="report">
    <div class="report-header">
      <div class="eyebrow">Отдел Digital Marketing</div>
      <h1>${escapeHtml(doc.title)}</h1>
      <div class="subtitle">${doc.employeeName ? escapeHtml(doc.employeeName) + ' · ' : ''}Сформировано ${escapeHtml(formatDate(doc.generatedAt))}</div>
      <div class="meta">
        <div class="meta-item">
          <div class="label">Текущая должность</div>
          <div class="value">${escapeHtml(doc.currentLevelLabel)}</div>
        </div>
        ${doc.nextLevelLabel ? `
          <div class="meta-item">
            <div class="label">Следующий уровень</div>
            <div class="value">${escapeHtml(doc.nextLevelLabel)}</div>
          </div>
        ` : ''}
        <div class="meta-item">
          <div class="label">Общее соответствие</div>
          <div class="value">${s.overallCompletionPct}%</div>
        </div>
      </div>
    </div>

    <div class="body-content">
      <div class="summary-grid">
        <div class="summary-card"><div class="num">${s.overallCompletionPct}%</div><div class="label">Общее соответствие уровню</div></div>
        <div class="summary-card"><div class="num">${s.totalDone}/${s.totalCriteria}</div><div class="label">Пунктов выполнено</div></div>
        <div class="summary-card"><div class="num">${s.fullyMetAreas}/${s.totalAreas}</div><div class="label">Направлений закрыто полностью</div></div>
        <div class="summary-card"><div class="num" style="color:#8BC34A;">${s.totalWins}</div><div class="label">Зафиксировано побед</div></div>
      </div>

      <div class="two-col">
        <div>
          <h3 style="color:#4F7A2C;">Сильные стороны</h3>
          ${strongestHtml || '<div style="font-size:14px; color:#80868B;">Недостаточно данных</div>'}
        </div>
        <div>
          <h3 style="color:#B5651A;">Зоны роста</h3>
          ${weakestHtml || '<div style="font-size:14px; color:#80868B;">Недостаточно данных</div>'}
        </div>
      </div>

      <h2 class="section-title">Детализация по направлениям</h2>
      ${areasHtml}
    </div>

    <div class="report-footer">
      Сгенерировано автоматически системой «Развитие компетенций» на основе шкалы уровней компетенций отдела Digital Marketing
    </div>
  </div>
</body>
</html>`;
}
