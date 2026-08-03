// =========================================================
// COMPONENT — Task Card
// =========================================================
import { escapeHtml } from '../utils/dom.js';
import { formatShort } from '../utils/date.js';
import { getArea, LEVEL_LABELS } from '../domain/data/competency-scale.js';
import { iconSvg } from '../utils/icons.js';

export function renderTaskCard(task) {
  const area = task.competencyAreaId ? getArea(task.competencyAreaId) : null;
  const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date(new Date().toDateString());

  return `
    <div class="card" data-task-id="${escapeHtml(task.id)}" style="padding: var(--space-md); margin-bottom: var(--space-sm);">
      <div style="font-size: 14px; color: var(--color-text-primary); ${task.status === 'done' ? 'text-decoration: line-through; color: var(--color-text-secondary);' : ''}">
        ${escapeHtml(task.title)}
      </div>
      <div style="display:flex; align-items:center; gap: var(--space-sm); flex-wrap: wrap; margin-top: var(--space-sm);">
        ${area ? `<span class="badge badge-info">${escapeHtml(area.name)}</span>` : ''}
        ${task.targetLevel ? `<span class="badge badge-neutral">${escapeHtml(LEVEL_LABELS[task.targetLevel] || task.targetLevel)}</span>` : ''}
        ${task.dueDate ? `<span class="badge ${isOverdue ? 'badge-danger' : 'badge-neutral'}">${iconSvg('file_text', { size: 10 })} ${escapeHtml(formatShort(task.dueDate))}</span>` : ''}
      </div>
      <div style="display:flex; gap: var(--space-xs); margin-top: var(--space-sm);">
        ${task.status !== 'todo' ? `<button class="btn btn-sm" data-action="set-status" data-status="todo">К выполнению</button>` : ''}
        ${task.status !== 'in_progress' ? `<button class="btn btn-sm" data-action="set-status" data-status="in_progress">В работе</button>` : ''}
        ${task.status !== 'done' ? `<button class="btn btn-sm btn-primary" data-action="set-status" data-status="done">Готово</button>` : ''}
        <button class="btn btn-sm btn-ghost" data-action="delete-task" style="margin-left:auto;">${iconSvg('x', { size: 12 })}</button>
      </div>
    </div>
  `;
}
