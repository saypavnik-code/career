// =========================================================
// REPORTING — PDF-экспорт "Карты компетенций"
// Без внешних зависимостей: рендерим презентационный HTML в скрытый
// iframe и вызываем нативный диалог печати браузера ("Сохранить как PDF").
// =========================================================
import { toCompetencyReportHtml } from './competency-report-html-exporter.js';

export function printCompetencyReportAsPdf(doc) {
  const html = toCompetencyReportHtml(doc);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc2 = iframe.contentWindow.document;
  doc2.open();
  doc2.write(html);
  doc2.close();

  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  };
}
