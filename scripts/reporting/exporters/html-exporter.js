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
  body { font-family: 'Inter', 'Roboto', -apple-system, sans-serif; color: #1A1A1A; background: #F8F9FA; padding: 48px 24px; }
  .report { max-width: 720px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8EAED; border-radius: 16px; padding: 48px; }
  h1 { font-size: 32px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.02em; }
  .period { color: #5F6368; font-size: 14px; margin-bottom: 32px; }
  h2 { font-size: 24px; font-weight: 700; margin: 32px 0 16px; border-bottom: 1px solid #E8EAED; padding-bottom: 12px; }
  h3 { font-size: 18px; font-weight: 600; margin: 20px 0 8px; }
  ul { margin: 0 0 16px; padding-left: 24px; }
  li { margin-bottom: 6px; font-size: 16px; line-height: 1.5; }
  .summary { color: #5F6368; font-size: 16px; }
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
