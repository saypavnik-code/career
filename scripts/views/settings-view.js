import { BackupService } from '../services/backup-service.js';
import { CompetencyService } from '../services/competency-service.js';
import { ProgressionService } from '../services/progression-service.js';
import { NotificationService } from '../services/notification-service.js';
import { escapeHtml } from '../utils/dom.js';

export async function renderSettingsView(container) {
  const competencies = await CompetencyService.getActive();
  const position = ProgressionService.getCurrentPosition();

  container.innerHTML = `
    <div class="grid-12">
      <div class="col-6">
        <div class="card">
          <div class="card-header"><div class="card-title">Должность</div></div>
          ${position
            ? `<p class="text-secondary" style="margin-bottom:16px;">Текущая должность для расчёта прогресса: <strong style="color: var(--color-text-primary);">${escapeHtml(ProgressionService.LEVEL_LABELS[position] || position)}</strong>.</p>
               <button class="btn btn-ghost" id="resetPositionBtn">Сбросить выбор</button>`
            : `<p class="text-secondary" style="margin-bottom:16px;">Должность ещё не выбрана. Задайте её на вкладке «Профессиональный рост».</p>`}
        </div>
      </div>
      <div class="col-6">
        <div class="card">
          <div class="card-header"><div class="card-title">Резервное копирование</div></div>
          <p class="text-secondary" style="margin-bottom:16px;">Выгружает все данные (активности, компетенции, прогресс по шкале, задачи роста) в один JSON-файл. Автоматически запускается по пятницам.</p>
          <button class="btn btn-primary" id="exportBtn">Экспортировать JSON</button>
        </div>
      </div>
      <div class="col-6">
        <div class="card">
          <div class="card-header"><div class="card-title">Восстановление</div></div>
          <p class="text-secondary" style="margin-bottom:16px;">Импортируйте ранее сохранённый JSON-файл. Внимание: текущие данные будут перезаписаны после проверки файла.</p>
          <input type="file" id="importFile" accept=".json" style="display:none;">
          <button class="btn btn-danger" id="importTrigger">Импортировать JSON</button>
        </div>
      </div>
      <div class="col-12">
        <div class="card">
          <div class="card-header"><div class="card-title">Теги компетенций (для активностей)</div></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Название</th><th>Описание</th></tr></thead>
              <tbody>
                ${competencies.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td class="cell-secondary">${escapeHtml(c.description || '')}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#resetPositionBtn')?.addEventListener('click', () => {
    ProgressionService.setCurrentPosition(null);
    renderSettingsView(container);
    NotificationService.info('Должность сброшена');
  });

  container.querySelector('#exportBtn').addEventListener('click', async () => {
    await BackupService.triggerManualExport();
    NotificationService.success('Резервная копия скачана');
  });

  container.querySelector('#importTrigger').addEventListener('click', () => {
    container.querySelector('#importFile').click();
  });

  container.querySelector('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await BackupService.importAll(payload);
      NotificationService.success('Импорт завершён. Обновите страницу, чтобы увидеть данные.');
    } catch (err) {
      NotificationService.error(err.details ? err.details.join(', ') : 'Ошибка импорта файла');
    } finally {
      e.target.value = '';
    }
  });
}
