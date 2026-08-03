// =========================================================
// VIEW — Профессиональный рост
// Селектор должности + 12 областей компетенций с пробелами
// текущего уровня и целями роста для следующего.
// =========================================================
import { ProgressionService } from '../services/progression-service.js';
import { TaskService } from '../services/task-service.js';
import { LEVELS, LEVEL_LABELS } from '../domain/data/competency-scale.js';
import { renderCriterionRow } from '../components/criterion-row.js';
import { escapeHtml } from '../utils/dom.js';
import { NotificationService } from '../services/notification-service.js';
import { bus } from '../services/event-bus.js';

let currentAreasData = null; // кэш для повторного рендера без рефетча при raise/lower

export async function renderGrowthView(container) {
  container.innerHTML = await buildHtml();
  wireEvents(container);
  bus.on('position:changed', () => remount(container));
}

async function remount(container) {
  container.innerHTML = await buildHtml();
  wireEvents(container);
}

async function buildHtml() {
  const position = ProgressionService.getCurrentPosition();

  if (!position) {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">Выберите текущую должность</div></div>
        ${renderPositionSelector(null)}
      </div>
    `;
  }

  const { areas, overallCompletionPct } = await ProgressionService.getProgressionOverview(position);
  currentAreasData = areas;
  const nextLevel = ProgressionService.getNextLevel(position);

  return `
    <div class="stack">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Ваша должность</div>
            <div class="card-description">Система показывает, что нужно для соответствия текущему уровню, и цели для роста${nextLevel ? ` до уровня «${LEVEL_LABELS[nextLevel]}»` : ''}.</div>
          </div>
        </div>
        ${renderPositionSelector(position)}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Общее соответствие уровню «${escapeHtml(LEVEL_LABELS[position])}»</div>
        </div>
        <div style="display:flex; align-items:center; gap: var(--space-md);">
          <div style="flex:1; background: var(--color-surface-muted); border-radius: var(--radius-pill); height: 10px; overflow:hidden;">
            <div style="width:${overallCompletionPct}%; background: var(--color-brand-primary); height:100%;"></div>
          </div>
          <div class="num" style="font-weight:700; font-size: 18px; width: 50px; text-align:right;">${overallCompletionPct}%</div>
        </div>
      </div>

      <div class="stack" id="areasList">
        ${areas.map((area) => renderAreaCard(area, position, nextLevel)).join('')}
      </div>
    </div>
  `;
}

function renderPositionSelector(current) {
  return `
    <div class="chip-group" id="positionSelector">
      ${LEVELS.map((level) => `
        <button class="chip ${level === current ? 'selected' : ''}" data-level="${level}">
          ${escapeHtml(LEVEL_LABELS[level])}
        </button>
      `).join('')}
    </div>
  `;
}

function renderAreaCard(area, currentLevel, nextLevel) {
  const gapCount = area.gaps.length;
  const statusBadge = gapCount === 0
    ? `<span class="badge badge-success">Соответствует</span>`
    : `<span class="badge badge-warning">${gapCount} пункт${gapCount === 1 ? '' : gapCount < 5 ? 'а' : 'ов'} осталось</span>`;

  return `
    <details class="card" style="padding:0;">
      <summary style="padding: var(--space-lg); cursor:pointer; display:flex; align-items:center; justify-content:space-between; list-style:none;">
        <div>
          <div class="card-title" style="display:inline;">${escapeHtml(area.areaName)}</div>
          <span class="text-small text-secondary" style="margin-left: var(--space-sm);">${area.completionPct}%</span>
        </div>
        ${statusBadge}
      </summary>
      <div style="padding: 0 var(--space-lg) var(--space-lg);">
        <div class="text-micro text-secondary" style="text-transform:uppercase; margin: var(--space-md) 0 var(--space-xs);">Ожидания уровня «${escapeHtml(LEVEL_LABELS[currentLevel])}»</div>
        <div>${area.currentLevelCriteria.map((c) => renderCriterionRow({ criterion: c, areaId: area.areaId, areaName: area.areaName, level: currentLevel, mode: 'current' })).join('')}</div>
        ${nextLevel ? `
          <div class="text-micro text-secondary" style="text-transform:uppercase; margin: var(--space-lg) 0 var(--space-xs);">Как превзойти — уровень «${escapeHtml(LEVEL_LABELS[nextLevel])}»</div>
          <div>${area.growthCriteria.map((c) => renderCriterionRow({ criterion: c, areaId: area.areaId, areaName: area.areaName, level: nextLevel, mode: 'growth' })).join('')}</div>
        ` : ''}
      </div>
    </details>
  `;
}

function wireEvents(container) {
  const selector = container.querySelector('#positionSelector');
  selector?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    ProgressionService.setCurrentPosition(chip.dataset.level);
  });

  container.addEventListener('click', async (e) => {
    const toggleBtn = e.target.closest('[data-action="toggle-criterion"]');
    if (toggleBtn) {
      const row = toggleBtn.closest('.criterion-row');
      const criterionId = row.dataset.criterionId;
      const isDone = toggleBtn.dataset.done === '1';
      await ProgressionService.setCriterionStatus(criterionId, isDone ? 'not_started' : 'done');
      await remount(container);
      return;
    }

    const taskBtn = e.target.closest('[data-action="create-task"]');
    if (taskBtn) {
      const row = taskBtn.closest('.criterion-row');
      const criterionId = row.dataset.criterionId;
      const areaId = row.dataset.areaId;
      const level = row.dataset.level;
      const area = currentAreasData?.find((a) => a.areaId === areaId);
      const criterion = [...(area?.currentLevelCriteria || []), ...(area?.growthCriteria || [])].find((c) => c.id === criterionId);
      if (!criterion || !area) return;
      try {
        await TaskService.createFromCriterion({ criterion, areaId, areaName: area.areaName, level });
        NotificationService.success('Задача создана — смотрите на вкладке «Задачи»');
      } catch {
        NotificationService.error('Не удалось создать задачу');
      }
    }
  });
}
