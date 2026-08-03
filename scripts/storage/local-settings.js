// STORAGE LAYER — LocalStorage. ТОЛЬКО настройки, никаких доменных данных.
const PREFIX = 'competency_os:';
const DEFAULTS = {
  theme: 'light',
  weekStartDay: 1,
  defaultReportFormat: 'markdown',
  sidebarCollapsed: false,
  lastBackupDate: null,
  employeeName: '',
};

export const LocalSettings = {
  get(key) {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return DEFAULTS[key] ?? null;
    try { return JSON.parse(raw); } catch { return raw; }
  },
  set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },
  getAll() {
    const result = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) result[key] = this.get(key);
    return result;
  },
};
