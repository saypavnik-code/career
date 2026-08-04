import { renderOverviewView } from './views/overview-view.js';
import { renderActivitiesView } from './views/activities-view.js';
import { renderReportsView } from './views/reports-view.js';
import { renderSettingsView } from './views/settings-view.js';
import { renderGrowthView } from './views/growth-view.js';
import { renderWinsView } from './views/wins-view.js';
import { renderIdeasView } from './views/ideas-view.js';

const ROUTES = {
  overview: { title: 'Обзор', subtitle: '', mount: mountOverview },
  activities: { title: 'Активности', subtitle: 'Ежедневная фиксация', mount: renderActivitiesView },
  reports: { title: 'Отчёты', subtitle: 'Генерация из накопленных данных', mount: renderReportsView },
  growth: { title: 'Профессиональный рост', subtitle: 'Шкала компетенций отдела', mount: renderGrowthView },
  wins: { title: 'Победы', subtitle: 'Зафиксированные достижения', mount: renderWinsView },
  ideas: { title: 'Идеи', subtitle: 'Мысли и планы', mount: renderIdeasView },
  settings: { title: 'Настройки', subtitle: '', mount: renderSettingsView },
};
const DEFAULT_VIEW = 'overview';
let currentView = null;

async function mountOverview(container) {
  container.innerHTML = await renderOverviewView();
}

function getViewFromHash() {
  const hash = window.location.hash.replace('#', '');
  return ROUTES[hash] ? hash : DEFAULT_VIEW;
}

export function initRouter() {
  async function navigate(viewName) {
    const resolved = viewName in ROUTES ? viewName : DEFAULT_VIEW;
    const route = ROUTES[resolved];
    currentView = resolved;

    updateActiveNavItem(resolved);
    updateTopbar(route);

    const contentEl = document.getElementById('viewContent');
    contentEl.innerHTML = '<div class="empty-state">Загрузка…</div>';

    try {
      await route.mount(contentEl);
    } catch (err) {
      console.error(`Failed to mount view "${resolved}":`, err);
      contentEl.innerHTML = `<div class="empty-state"><div class="empty-title">Не удалось загрузить экран</div>Попробуйте обновить страницу.</div>`;
    }
  }

  bindSidebarNav();
  bindMobileMenuToggle();
  window.addEventListener('hashchange', () => navigate(getViewFromHash()));
  navigate(getViewFromHash());

  return { navigate, getCurrentView: () => currentView };
}

function updateActiveNavItem(viewName) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });
}

function updateTopbar(route) {
  const titleEl = document.getElementById('pageTitle');
  const subtitleEl = document.getElementById('pageSubtitle');
  if (titleEl) titleEl.textContent = route.title;
  if (subtitleEl) subtitleEl.textContent = route.subtitle || '';
}

function bindSidebarNav() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  nav.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    window.location.hash = item.dataset.view;
    document.getElementById('sidebar')?.classList.remove('open');
  });
  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.nav-item');
    if (!item) return;
    e.preventDefault();
    window.location.hash = item.dataset.view;
  });
}

function bindMobileMenuToggle() {
  const toggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
}
