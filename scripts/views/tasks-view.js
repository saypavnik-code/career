// =========================================================
// VIEW — Задачи (Task board)
// Три колонки по статусу, задачи роста создаются со страницы
// "Профессиональный рост" и попадают сюда.
// =========================================================
import { TaskService } from '../services/task-service.js';
import { renderTaskCard } from '../components/task-card.js';
import { bus } from '../services/event-bus.js';
import { NotificationService } from '../services/notification-service.js';

const COLUMNS = [
  { status: 'todo', label: 'К выполнению' },
  { status: 'in_progress', label: 'В работе' },
  { status: 'done', label: 'Готово' },
];

export async function renderTasksView(container) {
  container.innerHTML = await buildHtml();
  wireEvents(container);
  bus.on('task:created', () => refresh(container));
  bus.on('task:updated', () => refresh(container));
  bus.on('task:deleted', () => refresh(container));
}

async function refresh(container) {
  container.innerHTML = await buildHtml();
  wireEvents(container);
}

async function buildHtml() {
  const allTasks = await TaskService.getAll();

  if (!allTasks.length) {
    return `<div class="empty-state"><div class="empty-title">Пока нет задач</div>Создавайте задачи роста на вкладке «Профессиональный рост» — они появятся здесь.</div>`;
  }

  return `
    <div class="grid-12">
      ${COLUMNS.map((col) => {
        const tasks = allTasks.filter((t) => t.status === col.status).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        return `
          <div class="col-4">
            <div class="card-header" style="border:none; padding-bottom: var(--space-sm);">
              <div class="card-title">${col.label}</div>
              <span class="badge badge-neutral">${tasks.length}</span>
            </div>
            <div data-column="${col.status}">
              ${tasks.length ? tasks.map(renderTaskCard).join('') : `<div class="empty-state text-micro">Нет задач</div>`}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function wireEvents(container) {
  container.addEventListener('click', async (e) => {
    const statusBtn = e.target.closest('[data-action="set-status"]');
    if (statusBtn) {
      const taskId = statusBtn.closest('[data-task-id]').dataset.taskId;
      try {
        await TaskService.setStatus(taskId, statusBtn.dataset.status);
      } catch {
        NotificationService.error('Не удалось обновить статус задачи');
      }
      return;
    }

    const deleteBtn = e.target.closest('[data-action="delete-task"]');
    if (deleteBtn) {
      const taskId = deleteBtn.closest('[data-task-id]').dataset.taskId;
      await TaskService.deleteTask(taskId);
    }
  });
}
