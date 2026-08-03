import { escapeHtml } from '../utils/dom.js';

let stackEl = null;
function ensureStack() {
  if (stackEl) return stackEl;
  stackEl = document.createElement('div');
  stackEl.className = 'toast-stack';
  stackEl.setAttribute('role', 'status');
  stackEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(stackEl);
  return stackEl;
}
export const NotificationService = {
  show(message, { type = 'default', duration = 3200 } = {}) {
    const stack = ensureStack();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`.trim();
    toast.innerHTML = escapeHtml(message);
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  },
  success(message) { this.show(message, { type: 'success' }); },
  error(message) { this.show(message, { type: 'danger' }); },
  info(message) { this.show(message, { type: 'info' }); },
};
