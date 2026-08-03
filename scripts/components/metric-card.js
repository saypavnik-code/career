import { escapeHtml } from '../utils/dom.js';
import { iconSvg } from '../utils/icons.js';

export function renderMetricCard({ label, value, delta, deltaDirection = 'flat' }) {
  const deltaHtml = delta
    ? `<div class="metric-delta ${deltaDirection}">
         ${iconSvg(deltaDirection === 'up' ? 'trending_up' : deltaDirection === 'down' ? 'trending_down' : 'minus', { size: 12 })}
         ${escapeHtml(delta)}
       </div>`
    : '';
  return `
    <div class="card metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value num">${escapeHtml(value)}</div>
      ${deltaHtml}
    </div>
  `;
}
