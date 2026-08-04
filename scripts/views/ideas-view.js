// =========================================================
// VIEW — Идеи
// Независимый таск-трекер для организации мыслей и планов.
// Канбан-доска (К выполнению / В работе / Готово), без связи
// со шкалой компетенций — свободное пространство.
// =========================================================
import { IdeaService } from '../services/idea-service.js';
import { renderIdeaCard } from '../components/idea-card.js';
import { bus } from '../services/event-bus.js';
import { NotificationService } from '../services/notification-service.js';
import { escapeHtml } from '../utils/dom.js';

const COLUMNS = [
  { status: 'todo', label: 'К выполнению' },
  { status: 'in_progress', label: 'В работе' },
  { status: 'done', label: 'Готово' },
];

export async function renderIdeasView(container) {
  container.innerHTML = await buildHtml();
  wireEvents(container);
  bus.on('idea:created', () => refresh(container));
  bus.on('idea:updated', () => refresh(container));
  bus.on('idea:deleted', () => refresh(container));
}

async function refresh(container) {
  container.innerHTML = await buildHtml();
  wireEvents(container);
}

async function buildHtml() {
  const allIdeas = await IdeaService.getAll();

  const form = `
    <div class="card">
      <div class="card-header"><div class="card-title">Новая идея</div></div>
      <form id="ideaForm">
        <div class="field-row">
          <div class="field" style="flex: 2;">
            <label class="label" for="idea_title">Название</label>
            <input type="text" class="input" id="idea_title" placeholder="Напр.: Протестировать новый формат сторис" required>
          </div>
          <div class="field">
            <label class="label" for="idea_dueDate">Срок (необязательно)</label>
            <input type="date" class="input" id="idea_dueDate">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="label" for="idea_description">Описание</label>
            <textarea class="textarea" id="idea_description" placeholder="Детали, контекст, зачем это нужно"></textarea>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button type="submit" class="btn btn-primary">Добавить идею</button>
        </div>
      </form>
    </div>
  `;

  if (!allIdeas.length) {
    return `${form}<div class="empty-state mt-lg"><div class="empty-title">Пока нет идей</div>Добавьте первую выше.</div>`;
  }

  const board = `
    <div class="grid-12">
      ${COLUMNS.map((col) => {
        const ideas = allIdeas.filter((t) => t.status === col.status).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        return `
          <div class="col-4">
            <div class="card-header" style="border:none; padding-bottom: var(--space-sm);">
              <div class="card-title">${col.label}</div>
              <span class="badge badge-neutral">${ideas.length}</span>
            </div>
            <div data-column="${col.status}">
              ${ideas.length ? ideas.map(renderIdeaCard).join('') : `<div class="empty-state text-micro">Нет идей</div>`}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  return `<div class="stack">${form}${board}</div>`;
}

function wireEvents(container) {
  const formEl = container.querySelector('#ideaForm');
  formEl?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = {
      title: container.querySelector('#idea_title').value,
      description: container.querySelector('#idea_description').value,
      dueDate: container.querySelector('#idea_dueDate').value || null,
    };
    try {
      await IdeaService.createIdea(input);
      NotificationService.success('Идея добавлена');
    } catch (err) {
      NotificationService.error(err.details ? err.details.join(', ') : 'Не удалось добавить идею');
    }
  });

  container.addEventListener('click', async (e) => {
    const statusBtn = e.target.closest('[data-action="set-status"]');
    if (statusBtn) {
      const ideaId = statusBtn.closest('[data-idea-id]').dataset.ideaId;
      try {
        await IdeaService.setStatus(ideaId, statusBtn.dataset.status);
      } catch {
        NotificationService.error('Не удалось обновить статус идеи');
      }
      return;
    }

    const deleteBtn = e.target.closest('[data-action="delete-idea"]');
    if (deleteBtn) {
      const ideaId = deleteBtn.closest('[data-idea-id]').dataset.ideaId;
      await IdeaService.deleteIdea(ideaId);
    }
  });
}
