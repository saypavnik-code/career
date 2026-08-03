import { ActivityService } from '../services/activity-service.js';
import { CompetencyService } from '../services/competency-service.js';
import { ProgressionService } from '../services/progression-service.js';
import { countActivitiesByCompetency, uniqueActiveDays } from '../domain/rules/competency-scoring.js';
import { renderMetricCard } from '../components/metric-card.js';
import { formatShort, getWeekRange, formatWeekLabel } from '../utils/date.js';
import { escapeHtml } from '../utils/dom.js';

export async function renderOverviewView() {
  const weekActivities = await ActivityService.getCurrentWeekActivities();
  const allActivities = await ActivityService.getAll();
  const competencies = await CompetencyService.getActive();
  const { start, end } = getWeekRange();

  const activeDays = uniqueActiveDays(weekActivities);
  const byCompetency = countActivitiesByCompetency(weekActivities, competencies);
  const touchedCompetencies = byCompetency.filter((c) => c.count > 0).length;
  const recent = [...allActivities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return `
    <div class="stack">
      <div class="grid-12">
        <div class="col-4">${renderMetricCard({ label: 'Активностей за неделю', value: String(weekActivities.length) })}</div>
        <div class="col-4">${renderMetricCard({ label: 'Дней с активностью', value: String(activeDays) })}</div>
        <div class="col-4">${renderMetricCard({ label: 'Задействовано компетенций', value: String(touchedCompetencies) })}</div>
      </div>
      ${await renderGrowthSummaryCard()}
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Компетенции этой недели</div>
            <div class="card-description">${escapeHtml(formatWeekLabel(start, end))}</div>
          </div>
        </div>
        ${renderCompetencyBreakdown(byCompetency)}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Последние активности</div></div>
        ${renderRecentTable(recent)}
      </div>
    </div>
  `;
}

async function renderGrowthSummaryCard() {
  const position = ProgressionService.getCurrentPosition();

  if (!position) {
    return `
      <div class="card" style="border-color: var(--color-brand-primary);">
        <div class="card-header"><div class="card-title">Профессиональный рост</div></div>
        <p class="text-secondary" style="margin-bottom: var(--space-md);">Выберите свою текущую должность, чтобы увидеть, что нужно для соответствия ожиданиям и как их превзойти.</p>
        <a href="#growth" class="btn btn-primary">Выбрать должность</a>
      </div>
    `;
  }

  const { areas, overallCompletionPct } = await ProgressionService.getProgressionOverview(position);
  const weakestAreas = [...areas].sort((a, b) => a.completionPct - b.completionPct).slice(0, 3);

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Профессиональный рост</div>
          <div class="card-description">Должность: ${escapeHtml(ProgressionService.LEVEL_LABELS[position])}</div>
        </div>
        <div class="num" style="font-weight:700; font-size: 20px;">${overallCompletionPct}%</div>
      </div>
      <div class="text-micro text-secondary" style="text-transform:uppercase; margin-bottom: var(--space-sm);">Больше всего пробелов</div>
      <div class="stack" style="gap: var(--space-xs);">
        ${weakestAreas.map((a) => `
          <div style="display:flex; align-items:center; justify-content:space-between; gap: var(--space-md);">
            <span class="text-small">${escapeHtml(a.areaName)}</span>
            <span class="badge ${a.completionPct === 100 ? 'badge-success' : 'badge-warning'}">${a.completionPct}%</span>
          </div>
        `).join('')}
      </div>
      <a href="#growth" class="btn btn-ghost btn-sm" style="margin-top: var(--space-md);">Смотреть все направления →</a>
    </div>
  `;
}

function renderCompetencyBreakdown(items) {
  if (!items.length) return `<div class="empty-state">Нет компетенций. Добавьте их в Настройках.</div>`;
  const max = Math.max(1, ...items.map((i) => i.count));
  return `
    <div class="stack" style="gap: 8px;">
      ${items.map((i) => `
        <div style="display:flex; align-items:center; gap: 12px;">
          <div class="text-small" style="width: 160px; flex-shrink:0;">${escapeHtml(i.name)}</div>
          <div style="flex:1; background: var(--color-surface-muted); border-radius: var(--radius-pill); height: 8px; overflow:hidden;">
            <div style="width:${(i.count / max) * 100}%; background: var(--color-brand-primary); height:100%;"></div>
          </div>
          <div class="text-small num" style="width: 24px; text-align:right;">${i.count}</div>
        </div>`).join('')}
    </div>
  `;
}

function renderRecentTable(activities) {
  if (!activities.length) return `<div class="empty-state"><div class="empty-title">Пока нет активностей</div>Зафиксируйте первую на вкладке «Активности».</div>`;
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Описание</th><th>Категория</th><th class="num">Дата</th></tr></thead>
        <tbody>
          ${activities.map((a) => `
            <tr>
              <td>${escapeHtml(a.description)}</td>
              <td class="cell-secondary">${escapeHtml(a.category)}</td>
              <td class="num">${escapeHtml(formatShort(a.date))}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}
