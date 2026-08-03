import { escapeHtml } from '../../utils/dom.js';

export function toHtml(doc) {
  const sectionsHtml = doc.sections.map((section) => {
    let inner = `<h2>${escapeHtml(section.heading)}</h2>`;
    if (section.summary) inner += `<p class="summary">${escapeHtml(section.summary)}</p>`;
    if (section.items) inner += `<ul>${section.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
    if (section.groups) {
      inner += section.groups.map((g) => `<h3>${escapeHtml(g.groupTitle)}</h3><ul>${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`).join('');
    }
    return `<section>${inner}</section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(doc.title)}</title>
<style>
  body { font-family: 'Inter', -apple-system, sans-serif; color: #0F172A; background: #F1F5F9; padding: 32px; }
  .report { max-width: 720px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 32px; }
  h1 { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
  .period { color: #64748B; font-size: 13px; margin-bottom: 24px; }
  h2 { font-size: 20px; font-weight: 600; margin: 24px 0 12px; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; }
  h3 { font-size: 16px; font-weight: 600; margin: 16px 0 8px; }
  ul { margin: 0 0 12px; padding-left: 20px; }
  li { margin-bottom: 4px; font-size: 14px; }
  .summary { color: #334155; font-size: 14px; }
</style>
</head>
<body>
  <div class="report">
    <h1>${escapeHtml(doc.title)}</h1>
    <div class="period">Период: ${escapeHtml(doc.period)}</div>
    ${sectionsHtml}
  </div>
</body>
</html>`;
}
