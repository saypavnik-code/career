// =========================================================
// REPORTING — HTML-экспорт "Карты компетенций"
// Презентационный документ для руководства. Использует те же
// design-токены, что и живое приложение (dashboard design.md),
// но верстается отдельно от generic report exporter'а — здесь
// нужна визуальная карта (прогресс-бары, статусы), а не список.
// =========================================================
import { escapeHtml } from '../../utils/dom.js';

function renderCriterionLine(criterion, doneIcon) {
  const isDone = criterion.progress?.status === 'done';
  const icon = isDone ? doneIcon.done : doneIcon.pending;
  const color = isDone ? '#16A34A' : '#94A3B8';
  return `
    <div style="display:flex; align-items:flex-start; gap:8px; padding:6px 0; font-size:13px; line-height:1.5;">
      <span style="flex-shrink:0; width:16px; height:16px; margin-top:1px; color:${color};">${icon}</span>
      <span style="color:${isDone ? '#0F172A' : '#475569'};">${escapeHtml(criterion.text)}</span>
    </div>
  `;
}

const ICON_DONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const ICON_PENDING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>';

function renderAreaBlock(area, currentLevelLabel, nextLevelLabel) {
  const barColor = area.completionPct === 100 ? '#16A34A' : area.completionPct >= 50 ? '#2563EB' : '#D97706';
  const statusBadge = area.completionPct === 100
    ? `<span style="display:inline-flex; align-items:center; padding:2px 8px; font-size:11px; font-weight:600; border-radius:4px; background:#DCFCE7; color:#15803D;">Соответствует</span>`
    : `<span style="display:inline-flex; align-items:center; padding:2px 8px; font-size:11px; font-weight:600; border-radius:4px; background:#FEF3C7; color:#B45309;">${area.gaps.length} пункт(ов) осталось</span>`;

  return `
    <div style="page-break-inside: avoid; border:1px solid #E2E8F0; border-radius:8px; padding:20px; margin-bottom:16px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;">
        <div style="font-size:16px; font-weight:600; color:#0F172A;">${escapeHtml(area.areaName)}</div>
        ${statusBadge}
      </div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <div style="flex:1; background:#F1F5F9; border-radius:999px; height:8px; overflow:hidden;">
          <div style="width:${area.completionPct}%; background:${barColor}; height:100%;"></div>
        </div>
        <div style="font-weight:700; font-size:14px; width:44px; text-align:right; color:#0F172A;">${area.completionPct}%</div>
      </div>
      <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#64748B; margin-bottom:4px;">
        Ожидания уровня «${escapeHtml(currentLevelLabel)}»
      </div>
      <div>${area.currentLevelCriteria.map((c) => renderCriterionLine(c, { done: ICON_DONE, pending: ICON_PENDING })).join('')}</div>
      ${nextLevelLabel && area.growthCriteria.length ? `
        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#64748B; margin:16px 0 4px;">
          Цели роста — уровень «${escapeHtml(nextLevelLabel)}»
        </div>
        <div style="opacity:0.85;">${area.growthCriteria.map((c) => renderCriterionLine(c, { done: ICON_DONE, pending: ICON_PENDING })).join('')}</div>
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
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #F1F5F9; font-size:13px;">
      <span>${escapeHtml(a.areaName)}</span>
      <span style="font-weight:600; color:${a.completionPct >= 50 ? '#B45309' : '#B91C1C'};">${a.completionPct}%</span>
    </div>
  `).join('');

  const strongestHtml = s.strongestAreas.map((a) => `
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #F1F5F9; font-size:13px;">
      <span>${escapeHtml(a.areaName)}</span>
      <span style="font-weight:600; color:#15803D;">${a.completionPct}%</span>
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
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #0F172A;
    background: #F1F5F9;
    margin: 0;
    padding: 40px 20px;
    font-feature-settings: 'tnum';
    font-variant-numeric: tabular-nums;
  }
  .report { max-width: 800px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .report-header { background: #0F172A; color: #FFFFFF; padding: 32px 40px; }
  .report-header .eyebrow { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 8px; }
  .report-header h1 { font-size: 28px; font-weight: 700; margin: 0 0 4px; }
  .report-header .subtitle { font-size: 14px; color: #CBD5E1; }
  .report-header .meta { margin-top: 20px; display:flex; gap: 24px; flex-wrap: wrap; }
  .report-header .meta-item .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #94A3B8; }
  .report-header .meta-item .value { font-size: 15px; font-weight: 600; color: #FFFFFF; margin-top: 2px; }
  .body-content { padding: 32px 40px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
  .summary-card { border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; text-align: center; }
  .summary-card .num { font-size: 32px; font-weight: 700; color: #2563EB; }
  .summary-card .label { font-size: 12px; color: #64748B; margin-top: 4px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
  .two-col h3 { font-size: 14px; font-weight: 600; margin: 0 0 8px; }
  h2.section-title { font-size: 18px; font-weight: 700; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #0F172A; }
  .report-footer { padding: 20px 40px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center; }
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
      </div>

      <div class="two-col">
        <div>
          <h3 style="color:#15803D;">Сильные стороны</h3>
          ${strongestHtml || '<div style="font-size:13px; color:#94A3B8;">Недостаточно данных</div>'}
        </div>
        <div>
          <h3 style="color:#B45309;">Зоны роста</h3>
          ${weakestHtml || '<div style="font-size:13px; color:#94A3B8;">Недостаточно данных</div>'}
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
