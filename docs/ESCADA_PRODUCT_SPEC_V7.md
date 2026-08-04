# Эскада — Product Spec v7

## Product promise

Эскада — персональная система профессионального роста. Она помогает сотруднику сохранить идею, развернуть работу, зафиксировать результат как win и собрать доказательный отчёт.

Основной цикл:

`Idea → Work → Win → Report → Reflection`

## Product boundaries

- Эскада не заменяет Jira, Asana или корпоративный task manager.
- Мини-канбан существует только внутри идеи и хранит контекст, который понадобится для win и отчёта.
- Компетенции не являются обязательным чеклистом и не присваивают сотруднику официальный уровень.
- Автоматические выводы называются сигналами и всегда сопровождаются объяснением ограничений.

## Feedback incorporated

1. Все точки входа в существующую идею называются одинаково: **Открыть**.
2. У идеи появилась детальная карточка с контекстом, следующим шагом, мини-канбаном и заметками.
3. Выполненные этапы автоматически переносятся в win и далее в отчёт.
4. Для идеи выводится предположительный уровень: специалист, старший или ведущий.
5. На экране Сегодня появился Навигатор с подсказками по следующему уровню, застоявшимся идеям, готовности к win и качеству доказательств.
6. В Компетенциях появилась вкладка **Мой прогресс** с покрытием, артефактами и подсвеченными поведенческими сигналами.
7. Проект переименован в **Эскада**. Лестница используется как символ последовательного карьерного роста.

## Data model v3

### Idea

- title, details, nextStep, status
- competencyIds
- levelSignal, levelReason
- behaviorRefs
- workItems: backlog / doing / done
- notes

### Win

- result, impact, evidence
- competencyIds, behaviorRefs, levelSignal
- sourceIdeaId
- workSummary and noteSummary inherited from the idea

### Progress

Progress is calculated as evidence coverage, not as an HR score:

- coverage of competencies by level;
- idea, completed-work and win counts;
- observed behavior references;
- inferred level and confidence based only on recorded artifacts.

## Privacy and deployment

- localStorage only;
- automatic migration from `career-os:v2` and `career-os:v1` to `escada:v3`;
- JSON export/import;
- static Next.js export for GitHub Pages;
- no new runtime dependencies.
