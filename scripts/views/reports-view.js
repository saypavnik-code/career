// =========================================================
// VIEW — Отчёты
// Два независимых типа отчётов:
//  1. Карта компетенций — презентационный отчёт для руководства,
//     полное соответствие шкале (не привязан к неделе).
//  2. Weekly Review — сводка активностей за текущую неделю.
// =========================================================
import { ReportBuilder } from '../reporting/report-builder.js';
import { ProgressionService } from '../services/progression-service.js';
import { LocalSettings } from '../storage/local-settings.js';
import { getWeekRange, formatWeekLabel, toDateKey } from '../utils/date.js';
import { escapeHtml } from '../utils/dom.js';
import { NotificationService } from '../services/notification-service.js';

export async function renderReportsView(container) {
  const { start, end } = getWeekRange();
  const position = ProgressionService.getCurrentPosition();

  container.innerHTML = `
    <div class="stack">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Карта компетенций</div>
            <div class="card-description">Презентационный отчёт для руководства: полное соответствие шкале компетенций отдела</div>
          </div>
        </div>
        ${position ? renderCompetencyReportForm() : renderNoPositionState()}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Генерация Weekly Review</div></div>
        <p class="text-secondary" style="margin-bottom: 16px;">
          Система автоматически соберёт активности за текущую неделю (${escapeHtml(formatWeekLabel(start, end))}),
          сгруппирует их по компетенциям и категориям для формирования исполнительского отчёта.
        </p>
        <div style="display:flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-primary" data-format="markdown" data-report="weekly-review">Скачать (.md)</button>
          <button class="btn" data-format="html" data-report="weekly-review">Скачать (.html)</button>
          <button class="btn" data-format="json" data-report="weekly-review">Скачать (.json)</button>
          <button class="btn" data-format="pdf" data-report="weekly-review">Печать / PDF</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Предпросмотр</div></div>
        <div id="reportPreview" class="empty-state">Нажмите одну из кнопок выше, чтобы сформировать и скачать отчёт.</div>
      </div>
    </div>
  `;

  wireEvents(container, start, end);
}

function renderNoPositionState() {
  return `<div class="empty-state"><div class="empty-title">Должность не выбрана</div>Выберите текущую должность на вкладке «Профессиональный рост», чтобы сформировать карту компетенций.</div>`;
}

function renderCompetencyReportForm() {
  const savedName = LocalSettings.get('employeeName') || '';
  return `
    <div class="field-row">
      <div class="field">
        <label class="label" for="employeeName">Имя сотрудника (для отчёта, необязательно)</label>
        <input type="text" class="input" id="employeeName" placeholder="Напр.: Иван Петров" value="${escapeHtml(savedName)}">
      </div>
    </div>
    <div style="display:flex; gap: 8px; flex-wrap: wrap;">
      <button class="btn btn-primary" data-format="html" data-report="competency-report">Скачать (.html)</button>
      <button class="btn" data-format="pdf" data-report="competency-report">Печать / PDF</button>
      <button class="btn" data-format="markdown" data-report="competency-report">Скачать (.md)</button>
      <button class="btn" data-format="json" data-report="competency-report">Скачать (.json)</button>
    </div>
  `;
}

function wireEvents(container, weekStart, weekEnd) {
  container.querySelectorAll('[data-format]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const reportType = btn.dataset.report;
      if (reportType === 'competency-report') {
        handleGenerateCompetencyReport(btn.dataset.format, container);
      } else {
        handleGenerateWeeklyReview(btn.dataset.format, container, weekStart, weekEnd);
      }
    });
  });
}

async function handleGenerateCompetencyReport(format, container) {
  const preview = container.querySelector('#reportPreview');
  const employeeNameInput = container.querySelector('#employeeName');
  const employeeName = employeeNameInput ? employeeNameInput.value.trim() : '';
  if (employeeName) LocalSettings.set('employeeName', employeeName);

  let doc;
  try {
    doc = await ReportBuilder.buildCompetencyReport({ employeeName: employeeName || undefined });
  } catch (err) {
    if (err.code === 'NO_POSITION') {
      NotificationService.error('Сначала выберите должность на вкладке «Профессиональный рост»');
    } else {
      NotificationService.error('Не удалось сформировать отчёт');
    }
    return;
  }

  const dateStr = toDateKey(new Date());
  const nameSlug = employeeName ? '_' + employeeName.replace(/\s+/g, '_') : '';
  const extensions = { markdown: 'md', html: 'html', json: 'json' };
  const mimeTypes = { markdown: 'text/markdown', html: 'text/html', json: 'application/json' };

  if (format === 'pdf') {
    ReportBuilder.export(doc, 'pdf', { reportType: 'competency-report' });
    NotificationService.info('Откроется диалог печати — выберите «Сохранить как PDF»');
    return;
  }

  const content = ReportBuilder.export(doc, format, { reportType: 'competency-report' });
  ReportBuilder.download(content, `karta_kompetenciy${nameSlug}_${dateStr}.${extensions[format]}`, mimeTypes[format]);

  preview.className = '';
  if (format === 'html') {
    const blobUrl = URL.createObjectURL(new Blob([content], { type: 'text/html' }));
    preview.innerHTML = `<iframe src="${blobUrl}" style="width:100%; height:600px; border:1px solid var(--color-border-default); border-radius:var(--radius-md);"></iframe>`;
  } else {
    preview.innerHTML = `<pre style="white-space: pre-wrap; font-size: 13px; color: var(--color-text-secondary); margin:0;">${escapeHtml(content.slice(0, 2000))}${content.length > 2000 ? '\n…' : ''}</pre>`;
  }
  NotificationService.success('Карта компетенций сформирована и скачана');
}

async function handleGenerateWeeklyReview(format, container, start, end) {
  const doc = await ReportBuilder.buildWeeklyReview(start, end);
  const preview = container.querySelector('#reportPreview');

  if (!doc.sections.some((s) => (s.items?.length || s.groups?.length))) {
    preview.className = 'empty-state';
    preview.innerHTML = '<div class="empty-title">Нет активностей за эту неделю</div>Зафиксируйте хотя бы одну на вкладке «Активности».';
    NotificationService.info('Нет данных за эту неделю для формирования отчёта');
    return;
  }

  const dateStr = toDateKey(start);
  const extensions = { markdown: 'md', html: 'html', json: 'json' };
  const mimeTypes = { markdown: 'text/markdown', html: 'text/html', json: 'application/json' };

  if (format === 'pdf') { ReportBuilder.export(doc, 'pdf'); return; }

  const content = ReportBuilder.export(doc, format);
  ReportBuilder.download(content, `weekly-review_${dateStr}.${extensions[format]}`, mimeTypes[format]);

  preview.className = '';
  preview.innerHTML = `<pre style="white-space: pre-wrap; font-size: 13px; color: var(--color-text-secondary); margin:0;">${escapeHtml(content.slice(0, 2000))}${content.length > 2000 ? '\n…' : ''}</pre>`;
  NotificationService.success('Отчёт сформирован и скачан');
}
