import { ActivityService } from '../services/activity-service.js';
import { CompetencyService } from '../services/competency-service.js';
import { CATEGORIES } from '../domain/enums/categories.js';
import { renderActivityCard } from '../components/activity-card.js';
import { escapeHtml } from '../utils/dom.js';
import { todayKey } from '../utils/date.js';
import { NotificationService } from '../services/notification-service.js';
import { bus } from '../services/event-bus.js';

export async function renderActivitiesView(container) {
  const competencies = await CompetencyService.getActive();
  container.innerHTML = await buildHtml(competencies);
  wireEvents(container);
  bus.on('activity:created', () => refreshLog(container, competencies));
  bus.on('activity:deleted', () => refreshLog(container, competencies));
}

async function buildHtml(competencies) {
  const weekActivities = await ActivityService.getCurrentWeekActivities();
  return `
    <div class="stack">
      <div class="card">
        <div class="card-header"><div class="card-title">Новая активность</div></div>
        <form id="activityForm">
          <div class="field-row">
            <div class="field">
              <label class="label" for="act_date">Дата</label>
              <input type="date" class="input" id="act_date" value="${todayKey()}" required>
            </div>
            <div class="field">
              <label class="label" for="act_category">Категория</label>
              <select class="select" id="act_category" required>
                ${CATEGORIES.map((c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field" style="flex: 2;">
              <label class="label" for="act_description">Описание (что сделано?)</label>
              <textarea class="textarea" id="act_description" placeholder="Напр.: Автоматизировал парсинг конкурентов через ИИ" required></textarea>
            </div>
            <div class="field">
              <label class="label" for="act_competency">Компетенция</label>
              <select class="select" id="act_competency">
                <option value="">—</option>
                ${competencies.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label" for="act_impact">Влияние на бизнес</label>
              <input type="text" class="input" id="act_impact" placeholder="Напр.: Снизил CAC на 5%">
            </div>
            <div class="field">
              <label class="label" for="act_metric">Метрика (если есть)</label>
              <input type="text" class="input" id="act_metric" placeholder="+10% ROI">
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label" for="act_tags">Теги (через запятую)</label>
              <input type="text" class="input" id="act_tags" placeholder="bitrix24, brazil, whatsapp">
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary" id="saveActivityBtn">Зафиксировать</button>
          </div>
        </form>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Журнал активностей (текущая неделя)</div></div>
        <div id="activityLog">${weekActivities.length ? weekActivities.sort((a, b) => b.date.localeCompare(a.date)).map((a) => renderActivityCard(a, competencyMap(competencies))).join('') : emptyLog()}</div>
      </div>
    </div>
  `;
}

function competencyMap(competencies) { return new Map(competencies.map((c) => [c.id, c.name])); }
function emptyLog() { return `<div class="empty-state"><div class="empty-title">За эту неделю активностей нет</div>Добавьте первую выше.</div>`; }

function wireEvents(container) {
  const form = container.querySelector('#activityForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = {
      date: container.querySelector('#act_date').value,
      category: container.querySelector('#act_category').value,
      description: container.querySelector('#act_description').value,
      competencyIds: container.querySelector('#act_competency').value || [],
      impact: container.querySelector('#act_impact').value,
      metric: container.querySelector('#act_metric').value,
      tags: container.querySelector('#act_tags').value,
    };
    try {
      await ActivityService.captureActivity(input);
      form.reset();
      container.querySelector('#act_date').value = todayKey();
      NotificationService.success('Активность зафиксирована');
    } catch (err) {
      NotificationService.error(err.details ? err.details.join(', ') : 'Не удалось сохранить активность');
    }
  });
}

async function refreshLog(container, competencies) {
  const logEl = container.querySelector('#activityLog');
  if (!logEl) return;
  const weekActivities = await ActivityService.getCurrentWeekActivities();
  logEl.innerHTML = weekActivities.length
    ? weekActivities.sort((a, b) => b.date.localeCompare(a.date)).map((a) => renderActivityCard(a, competencyMap(competencies))).join('')
    : emptyLog();
}
