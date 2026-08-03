import { ActivityService } from '../services/activity-service.js';
import { CompetencyService } from '../services/competency-service.js';
import { ProgressionService } from '../services/progression-service.js';
import { CriterionProgressRepository } from '../repositories/criterion-progress-repository.js';
import { COMPETENCY_SCALE } from '../domain/data/competency-scale.js';
import { buildWeeklyReviewDocument } from './templates/weekly-review.template.js';
import { buildCompetencyReportDocument } from './templates/competency-report.template.js';
import { toMarkdown } from './exporters/markdown-exporter.js';
import { toHtml } from './exporters/html-exporter.js';
import { toJson } from './exporters/json-exporter.js';
import { printAsPdf } from './exporters/pdf-exporter.js';
import { toCompetencyReportMarkdown } from './exporters/competency-report-markdown-exporter.js';
import { toCompetencyReportHtml } from './exporters/competency-report-html-exporter.js';
import { printCompetencyReportAsPdf } from './exporters/competency-report-pdf-exporter.js';

export const ReportBuilder = {
  async buildWeeklyReview(weekStart, weekEnd) {
    const [activities, competencies] = await Promise.all([
      ActivityService.getCurrentWeekActivities(weekStart),
      CompetencyService.getActive(),
    ]);
    return buildWeeklyReviewDocument({ weekStart, weekEnd, activities, competencies });
  },

  /** Полная "Карта компетенций" — презентационный отчёт для руководства. */
  async buildCompetencyReport({ employeeName } = {}) {
    const currentLevel = ProgressionService.getCurrentPosition();
    if (!currentLevel) {
      const err = new Error('Не выбрана должность');
      err.code = 'NO_POSITION';
      throw err;
    }
    const progressByCriterionId = await CriterionProgressRepository.getAllAsMap();
    return buildCompetencyReportDocument({ currentLevel, competencyScale: COMPETENCY_SCALE, progressByCriterionId, employeeName });
  },

  export(doc, format, { reportType = 'weekly-review' } = {}) {
    if (reportType === 'competency-report') {
      switch (format) {
        case 'markdown': return toCompetencyReportMarkdown(doc);
        case 'html': return toCompetencyReportHtml(doc);
        case 'json': return toJson(doc);
        case 'pdf': return printCompetencyReportAsPdf(doc);
        default: throw new Error(`Неизвестный формат экспорта: ${format}`);
      }
    }
    switch (format) {
      case 'markdown': return toMarkdown(doc);
      case 'html': return toHtml(doc);
      case 'json': return toJson(doc);
      case 'pdf': return printAsPdf(doc);
      default: throw new Error(`Неизвестный формат экспорта: ${format}`);
    }
  },

  download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },
};
