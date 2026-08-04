// =========================================================
// COMPONENT — Idea Card
// Канбан-карточка со статусами, унаследована от прежней Task-логики.
// =========================================================
import { escapeHtml } from '../utils/dom.js';
import { formatShort } from '../utils/date.js';
import { iconSvg } from '../utils/icons.js';

export function renderIdeaCard(idea) {
  const isOverdue = idea.dueDate && idea.status !== 'done' && new Date(idea.dueDate) < new Date(new Date().toDateString());

  return `
    <div class="card" data-idea-id="${escapeHtml(idea.id)}" style="padding: var(--space-md); margin-bottom: var(--space-sm);">
      <div style="font-size: 14px; color: var(--color-text-primary); ${idea.status === 'done' ? 'text-decoration: line-through; color: var(--color-text-secondary);' : ''}">
        ${escapeHtml(idea.title)}
      </div>
      ${idea.description ? `<div class="text-small text-secondary" style="margin-top: 2px;">${escapeHtml(idea.description)}</div>` : ''}
      <div style="display:flex; align-items:center; gap: var(--space-sm); flex-wrap: wrap; margin-top: var(--space-sm);">
        ${idea.dueDate ? `<span class="badge ${isOverdue ? 'badge-danger' : 'badge-neutral'}">${iconSvg('file_text', { size: 10 })} ${escapeHtml(formatShort(idea.dueDate))}</span>` : ''}
      </div>
      <div style="display:flex; gap: var(--space-xs); margin-top: var(--space-sm);">
        ${idea.status !== 'todo' ? `<button class="btn btn-sm" data-action="set-status" data-status="todo">К выполнению</button>` : ''}
        ${idea.status !== 'in_progress' ? `<button class="btn btn-sm" data-action="set-status" data-status="in_progress">В работе</button>` : ''}
        ${idea.status !== 'done' ? `<button class="btn btn-sm btn-primary" data-action="set-status" data-status="done">Готово</button>` : ''}
        <button class="btn btn-sm btn-ghost" data-action="delete-idea" style="margin-left:auto;">${iconSvg('x', { size: 12 })}</button>
      </div>
    </div>
  `;
}
