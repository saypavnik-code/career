# Развитие компетенций — Architecture Reference

This folder contains the implementation of the layered architecture designed for this
project: Presentation (views/components) → Application (services) → Domain (models/rules) →
Repository → Storage (IndexedDB/LocalStorage).

## Layer boundary (enforced by folder location)

- `scripts/storage/` — the only code that touches `indexedDB` directly. Connection lifecycle,
  schema, versioned migrations (`storage/migrations/`, one file per version, never edited after
  publish), LocalStorage wrapper (settings only, never domain data).
- `scripts/repositories/` — CRUD + indexed queries per entity. Composes `base-repository.js`.
  Returns plain objects only, never raw `IDBRequest`.
- `scripts/domain/` — entity shape/validation (`models/`), cross-entity business rules
  (`rules/`), fixed vocabularies (`enums/`). Pure functions, no DOM, no IndexedDB.
- `scripts/services/` — orchestrates use-cases: calls domain validation, then repository
  persistence, then emits an event on `services/event-bus.js`. This is where a new report
  type or a new capture flow gets wired.
- `scripts/reporting/` — its own subsystem: `templates/` decide document structure,
  `exporters/` decide output format (Markdown/HTML/JSON/PDF). Adding a new report type is a
  template-only change; adding a new export format is an exporter-only change.
- `scripts/components/` + `scripts/views/` — Presentation layer. Components are dumb —
  props in, HTML string out, no fetching. Views compose components and call services.
- `scripts/router.js` — hash-based routing (`#overview`, `#activities`, etc.), required
  because GitHub Pages has no server-side rewrite rules for path-based SPA routing.

## Current entities (IndexedDB stores)

`activities`, `competencies`, `evidence`, `backups`, `_meta_versions` — defined in
`storage/migrations/v1__initial.js`. Extending the schema means adding
`storage/migrations/v2__<name>.js` and appending it to `storage/migrations/index.js` —
never editing `v1` in place.

## Extending this app

Adding entity #6 (e.g. `Decision`) follows the same five-file pattern every existing
entity follows:
1. `storage/migrations/vN__add-decisions.js` — new object store + indexes
2. `repositories/decision-repository.js` — composes `base-repository.js`
3. `domain/models/decision.js` — validation/shape
4. `services/decision-service.js` — orchestration
5. `views/decisions-view.js` + `components/decision-card.js` — presentation

This mirrors the full 15-section architecture document produced during the design phase
of this project (product architecture, domain model for 16 entities, reporting engine,
backup/restore strategy, deployment notes, and a full rationale table for every major
technical decision). Re-request that document at any point if you need the complete
long-form version — this file is the condensed, implementation-adjacent companion to it.

## Дополнение — Профессиональный рост (v2)

Добавлена additive-миграцией `storage/migrations/v2__add-progression.js` (сторы
`criterion_progress`, `tasks`), не затрагивающей v1.

Новый домен строго отделён от прежней сущности `Competency` (теги для активностей —
Стратегия/Data-driven и т.д.): шкала компетенций отдела — это `domain/data/competency-scale.js`,
статичные данные (12 областей × 3 уровня × N пунктов, id вида `<area>-<level>-<index>`),
никогда не изменяемые кодом.

Слои:
- `domain/models/criterion-progress.js`, `domain/models/task.js` — валидация и фабрики
- `domain/rules/progression-gap.js` — чистая функция расчёта пробелов/целей роста
- `domain/rules/evidence-matching.js` — грубый стеммер + пересечение ключевых слов для
  подсказки "эта активность может быть доказательством" (эвристика, не финальное решение —
  пользователь всегда подтверждает вручную)
- `repositories/criterion-progress-repository.js`, `repositories/task-repository.js`
- `services/progression-service.js` (текущая должность хранится в LocalStorage как
  UI-настройка, не доменные данные), `services/task-service.js`
- `views/growth-view.js`, `views/tasks-view.js` + компоненты `criterion-row.js`, `task-card.js`

Ручное подтверждение пункта — единственный источник истины для "выполнено"; подсказка
по активностям — только вспомогательная, никогда не закрывает пункт автоматически.

## Дополнение — Карта компетенций (презентационный отчёт)

Новый тип отчёта, независимый от Weekly Review: полная сверка сотрудника со всей
шкалой компетенций (не привязан к неделе, не зависит от активностей).

- `reporting/templates/competency-report.template.js` — собирает структурированный
  документ через `calculateProgressionGaps()` (переиспользует ту же чистую функцию,
  что и экран «Профессиональный рост» — гарантия, что цифры в отчёте и в приложении
  совпадают)
- `reporting/exporters/competency-report-html-exporter.js` — отдельный от generic
  `html-exporter.js` рендерер: презентационная вёрстка (прогресс-бары, карточки
  сводки, статус-бейджи) специально под показ руководству, не список
- `reporting/exporters/competency-report-markdown-exporter.js` — Markdown-версия
  с чекбоксами `[x]`/`[ ]` для быстрого просмотра/копирования
- `reporting/exporters/competency-report-pdf-exporter.js` — печать через скрытый
  iframe, использует HTML-версию этого отчёта (не generic pdf-exporter)
- JSON использует уже существующий generic `json-exporter.js` — специализация не
  нужна, структура документа самодостаточна

`ReportBuilder.export(doc, format, { reportType })` — диспетчер по типу отчёта,
чтобы Weekly Review и Карта компетенций могли использовать одинаковые названия
форматов (html/pdf/md/json), но разные рендереры.

Данные о прогрессе (`criterion_progress`) и задачах (`tasks`) хранятся в IndexedDB
и включены в резервное копирование (`backup-service.js`) — при экспорте/импорте
JSON-бэкапа прогресс по шкале и задачи роста сохраняются вместе с активностями.
