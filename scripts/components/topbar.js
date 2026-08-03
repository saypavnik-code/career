import { escapeHtml } from '../utils/dom.js';
import { iconSvg } from '../utils/icons.js';

export function renderTopbar({ title, subtitle }) {
  return `
    <header class="topbar">
      <div class="topbar-heading">
        <button class="btn btn-ghost btn-icon-only" id="menuToggle" aria-label="Меню">
          ${iconSvg('menu', { size: 18 })}
        </button>
        <span class="topbar-title" id="pageTitle">${escapeHtml(title)}</span>
        <span class="topbar-subtitle" id="pageSubtitle">${escapeHtml(subtitle || '')}</span>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-primary" id="generateReportBtn">
          ${iconSvg('sparkles', { size: 14 })}
          Сформировать отчёт за неделю
        </button>
      </div>
    </header>
  `;
}
