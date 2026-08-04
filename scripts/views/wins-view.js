// =========================================================
// VIEW — Победы
// Лента зафиксированных достижений — не канбан, не планирование.
// Победы попадают на вкладку «Профессиональный рост» → «Зафиксировать
// победу» на конкретном пункте компетенции, и учитываются в Карте
// компетенций для итоговой аттестации.
// =========================================================
import { WinService } from '../services/win-service.js';
import { renderWinCard } from '../components/win-card.js';
import { bus } from '../services/event-bus.js';
import { NotificationService } from '../services/notification-service.js';

export async function renderWinsView(container) {
  container.innerHTML = await buildHtml();
  wireEvents(container);
  bus.on('win:created', () => refresh(container));
  bus.on('win:deleted', () => refresh(container));
}

async function refresh(container) {
  container.innerHTML = await buildHtml();
  wireEvents(container);
}

async function buildHtml() {
  const wins = await WinService.getAll();

  if (!wins.length) {
    return `<div class="empty-state"><div class="empty-title">Пока нет побед</div>Фиксируйте достижения на вкладке «Профессиональный рост» — кнопка «Зафиксировать победу» на любом пункте компетенции.</div>`;
  }

  const sorted = [...wins].sort((a, b) => b.date.localeCompare(a.date));

  return `
    <div class="stack">
      <div class="card" style="border-color: var(--color-brand-primary);">
        <div class="text-small text-secondary">Всего зафиксировано побед: <strong style="color: var(--color-text-primary);">${wins.length}</strong>. Этот список используется в «Карте компетенций» как доказательство для итоговой аттестации.</div>
      </div>
      <div id="winsList">${sorted.map(renderWinCard).join('')}</div>
    </div>
  `;
}

function wireEvents(container) {
  container.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('[data-action="delete-win"]');
    if (deleteBtn) {
      const winId = deleteBtn.closest('[data-win-id]').dataset.winId;
      await WinService.deleteWin(winId);
      NotificationService.info('Победа удалена');
    }
  });
}
