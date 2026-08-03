import { openDatabase } from './storage/db.js';
import { CompetencyService } from './services/competency-service.js';
import { BackupService } from './services/backup-service.js';
import { NotificationService } from './services/notification-service.js';
import { renderSidebar } from './components/sidebar.js';
import { renderTopbar } from './components/topbar.js';
import { initRouter } from './router.js';
import { ReportBuilder } from './reporting/report-builder.js';
import { getWeekRange, toDateKey } from './utils/date.js';

async function bootstrap() {
  const appRoot = document.getElementById('app-root');

  try {
    await openDatabase();
  } catch (err) {
    console.error('Failed to open database:', err);
    appRoot.innerHTML = `
      <div class="empty-state" style="margin: 48px auto; max-width: 480px;">
        <div class="empty-title">Не удалось открыть локальную базу данных</div>
        Проверьте, что браузер поддерживает IndexedDB и что режим приватного просмотра отключён.
      </div>`;
    return;
  }

  await CompetencyService.ensureSeeded();

  appRoot.innerHTML = `
    ${renderSidebar('overview')}
    <div class="main-area">
      ${renderTopbar({ title: 'Обзор', subtitle: '' })}
      <main class="content">
        <div id="viewContent"></div>
      </main>
    </div>
  `;

  bindGlobalReportButton();
  initRouter();
  BackupService.checkAutoBackup();
}

function bindGlobalReportButton() {
  const btn = document.getElementById('generateReportBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const { start, end } = getWeekRange();
    const doc = await ReportBuilder.buildWeeklyReview(start, end);
    if (!doc.sections.some((s) => s.items?.length || s.groups?.length)) {
      NotificationService.info('Нет активностей за эту неделю для формирования отчёта');
      return;
    }
    const content = ReportBuilder.export(doc, 'markdown');
    ReportBuilder.download(content, `weekly-review_${toDateKey(start)}.md`, 'text/markdown');
    NotificationService.success('Отчёт сформирован и скачан');
  });
}

bootstrap();
