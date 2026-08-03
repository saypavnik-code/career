// =========================================================
// COMPONENT — Criterion Row
// Один пункт компетенции: чекбокс статуса + опциональная подсказка
// о потенциальном доказательстве + кнопка "Создать задачу".
// Props only — не фетчит данные сам.
// =========================================================
import { escapeHtml } from '../utils/dom.js';
import { iconSvg } from '../utils/icons.js';

export function renderCriterionRow({ criterion, areaId, areaName, level, mode = 'current', evidenceCount = 0 }) {
  const isDone = criterion.progress?.status === 'done';
  const checkboxIcon = isDone ? iconSvg('check', { size: 14 }) : '';

  const evidenceHint = evidenceCount > 0
    ? `<span class="text-micro" style="color: var(--color-info); display:inline-flex; align-items:center; gap:4px; margin-left: var(--space-sm);">
         ${iconSvg('sparkles', { size: 12 })} есть похожие активности (${evidenceCount})
       </span>`
    : '';

  const growthBadge = mode === 'growth'
    ? `<span class="badge badge-info" style="margin-left: var(--space-sm);">цель роста</span>`
    : '';

  return `
    <div class="criterion-row" data-criterion-id="${escapeHtml(criterion.id)}" data-area-id="${escapeHtml(areaId)}" data-level="${escapeHtml(level)}"
         style="display:flex; align-items:flex-start; gap: var(--space-sm); padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border-default);">
      ${mode === 'current' ? `
        <button class="criterion-checkbox" aria-label="Отметить выполнение" data-action="toggle-criterion" data-done="${isDone ? '1' : '0'}"
          style="flex-shrink:0; width:20px; height:20px; margin-top:2px; border-radius: var(--radius-sm); border: 1px solid var(--color-border-strong);
                 background: ${isDone ? 'var(--color-success)' : 'var(--color-surface-base)'}; color: white; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0;">
          ${checkboxIcon}
        </button>
      ` : `<div style="width:20px; flex-shrink:0; margin-top:2px; color: var(--color-text-disabled);">${iconSvg('target', { size: 14 })}</div>`}
      <div style="flex:1; min-width:0;">
        <span class="text-small" style="${isDone && mode === 'current' ? 'color: var(--color-text-secondary); text-decoration: line-through;' : ''}">${escapeHtml(criterion.text)}</span>
        ${growthBadge}
        ${evidenceHint}
      </div>
      <button class="btn btn-ghost btn-sm" data-action="create-task" style="flex-shrink:0;">
        Создать задачу
      </button>
    </div>
  `;
}
