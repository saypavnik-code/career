import { escapeHtml } from '../utils/dom.js';
import { formatShort } from '../utils/date.js';
import { categoryLabel } from '../domain/enums/categories.js';
import { iconSvg } from '../utils/icons.js';

export function renderActivityCard(activity, competencyMap = new Map()) {
  const competencyNames = (activity.competencyIds || []).map((id) => competencyMap.get(id)).filter(Boolean).join(', ');
  return `
    <div class="card activity-row" data-activity-id="${escapeHtml(activity.id)}" style="margin-bottom: 8px; padding: 12px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 12px;">
        <div style="flex:1; min-width:0;">
          <div style="font-size: 14px; color: var(--color-text-primary);">${escapeHtml(activity.description)}</div>
          <div class="text-micro text-secondary" style="margin-top: 4px; display:flex; gap: 8px; flex-wrap: wrap;">
            <span>${escapeHtml(categoryLabel(activity.category))}</span>
            ${competencyNames ? `<span>· ${escapeHtml(competencyNames)}</span>` : ''}
            ${activity.metric ? `<span class="badge badge-success">${escapeHtml(activity.metric)}</span>` : ''}
          </div>
          ${activity.impact ? `<div class="text-small text-secondary" style="margin-top: 4px;">Влияние: ${escapeHtml(activity.impact)}</div>` : ''}
        </div>
        <span class="badge badge-neutral">${escapeHtml(formatShort(activity.date))}</span>
      </div>
      ${activity.evidenceIds?.length ? `<a href="#" class="text-micro" style="margin-top:6px; display:inline-flex; align-items:center; gap:4px;">${iconSvg('link', { size: 12 })} Подтверждение</a>` : ''}
    </div>
  `;
}
