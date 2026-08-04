import { iconSvg } from '../utils/icons.js';

const NAV_GROUPS = [
  { title: 'Система', items: [
    { view: 'overview', label: 'Обзор', icon: 'home' },
    { view: 'activities', label: 'Активности', icon: 'activity' },
    { view: 'reports', label: 'Отчёты', icon: 'file_text' },
  ]},
  { title: 'Развитие', items: [
    { view: 'growth', label: 'Профессиональный рост', icon: 'target' },
    { view: 'wins', label: 'Победы', icon: 'check' },
    { view: 'ideas', label: 'Идеи', icon: 'sparkles' },
  ]},
  { title: 'Конфигурация', items: [{ view: 'settings', label: 'Настройки', icon: 'settings' }] },
];

export function renderSidebar(activeView) {
  const groupsHtml = NAV_GROUPS.map((group) => `
    <div class="nav-group">
      <div class="nav-title">${group.title}</div>
      ${group.items.map((item) => `
        <div class="nav-item ${item.view === activeView ? 'active' : ''}" data-view="${item.view}" role="button" tabindex="0">
          ${iconSvg(item.icon, { size: 16 })}
          <span>${item.label}</span>
        </div>`).join('')}
    </div>`).join('');

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="app-name">Развитие компетенций</div>
        <div class="app-subtitle">per aspera ad astra</div>
      </div>
      <nav class="sidebar-nav" id="sidebarNav">${groupsHtml}</nav>
    </aside>
  `;
}
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
