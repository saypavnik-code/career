// =========================================================
// COMPONENT — Win Card (Победа)
// Без статусов — фиксация свершившегося достижения, как Activity.
// =========================================================
import { escapeHtml } from '../utils/dom.js';
import { formatShort } from '../utils/date.js';
import { getArea, LEVEL_LABELS } from '../domain/data/competency-scale.js';
import { iconSvg } from '../utils/icons.js';

export function renderWinCard(win) {
  const area = win.competencyAreaId ? getArea(win.competencyAreaId) : null;

  return `
    <div class="card" data-win-id="${escapeHtml(win.id)}" style="padding: var(--space-md); margin-bottom: var(--space-sm);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: var(--space-md);">
        <div style="flex:1; min-width:0;">
          <div style="font-size: 14px; color: var(--color-text-primary);">${escapeHtml(win.title)}</div>
          ${win.description ? `<div class="text-small text-secondary" style="margin-top: 2px;">${escapeHtml(win.description)}</div>` : ''}
        </div>
        <span class="badge badge-neutral" style="flex-shrink:0;">${escapeHtml(formatShort(win.date))}</span>
      </div>
      <div style="display:flex; align-items:center; gap: var(--space-sm); flex-wrap: wrap; margin-top: var(--space-sm);">
        ${area ? `<span class="badge badge-info">${escapeHtml(area.name)}</span>` : ''}
        ${win.targetLevel ? `<span class="badge badge-neutral">${escapeHtml(LEVEL_LABELS[win.targetLevel] || win.targetLevel)}</span>` : ''}
        ${win.metric ? `<span class="badge badge-success">${escapeHtml(win.metric)}</span>` : ''}
      </div>
      ${win.impact ? `<div class="text-small text-secondary" style="margin-top: var(--space-sm);">Влияние: ${escapeHtml(win.impact)}</div>` : ''}
      <div style="display:flex; margin-top: var(--space-sm);">
        <button class="btn btn-sm btn-ghost" data-action="delete-win" style="margin-left:auto;">${iconSvg('x', { size: 12 })}</button>
      </div>
    </div>
  `;
}
