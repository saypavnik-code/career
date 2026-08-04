# Career OS v4 — product specification

## Product promise

Career OS is a private, lightweight working-memory system for an employee who develops within a competency framework. It helps the employee capture ideas, turn real outcomes into wins, and assemble evidence-based reports without turning the competency scale into a mandatory checklist.

Core loop:

`Idea → action/experiment → Win → Report → next Idea`

The competency framework is contextual metadata and reflection guidance. Linking an idea or win to competencies is optional.

## Primary user

An individual employee working in Digital Marketing across one or more channels or markets. They need to remember ideas during daily work, preserve evidence of impact, prepare monthly/quarterly reports, and discuss growth with a manager.

## CJM

### 1. Enter and set context

**Trigger:** first visit or start of a new role/cycle.

**User action:** adds name, role, market/team, and preferred reporting rhythm.

**System response:** opens a clean workspace and explains the Idea → Win → Report loop. No forced self-assessment.

**Outcome:** the user understands that Career OS is a personal work memory, not an HR evaluation form.

### 2. Capture an idea in seconds

**Trigger:** the user notices an opportunity, problem, hypothesis, or useful observation during work.

**User action:** writes a single-line idea from the Today screen. Details and competency context are optional.

**System response:** saves it to Inbox and suggests up to three potentially relevant competencies based on text.

**Outcome:** the thought is not lost and does not become an artificial commitment.

### 3. Develop the idea

**Trigger:** the idea becomes relevant.

**User action:** adds context, a small next step, and moves it to “In progress”. They may browse competency signals for inspiration.

**System response:** keeps the item as an idea rather than a task checklist.

**Outcome:** the user has a lightweight experiment or action without project-management overhead.

### 4. Convert evidence into a win

**Trigger:** the action produces a change, result, decision, artifact, learning, or recognition.

**User action:** converts the idea to a win or records a standalone win. Adds impact and evidence when available.

**System response:** preserves the link to the source idea and optional competency context; marks the idea as converted.

**Outcome:** the user accumulates a reliable evidence trail and avoids recency bias.

### 5. Build a report

**Trigger:** monthly/quarterly update, 1:1, performance review, promotion case, or CV refresh.

**User action:** chooses a period and relevant wins.

**System response:** creates an editable Markdown narrative with a summary, wins, impact, evidence, competency signals, and next focus.

**Outcome:** reporting becomes editing and prioritization instead of reconstruction from memory.

### 6. Reflect and continue

**Trigger:** after a report or when the user lacks direction.

**User action:** reviews patterns in wins and opens competency descriptions as prompts.

**System response:** surfaces recurring competency signals and reflection questions without calculating a performance score.

**Outcome:** new ideas emerge from actual experience and the cycle restarts.

## Product decisions

- **Competencies are prompts, not gates.** No sliders, completion percentage, or mandatory evidence per criterion.
- **Ideas are not tasks.** They can remain uncertain, be explored, archived, or become wins.
- **Wins require meaning, not perfection.** Impact and evidence can be added incrementally.
- **Reports are generated from selected evidence.** The employee controls inclusion and wording.
- **Privacy first.** Data stays in browser localStorage and can be exported/imported as JSON.
- **Static deployment.** No backend or authentication is required for GitHub Pages MVP.

## Data model

- `Profile`: employee context and reporting rhythm.
- `Idea`: title, context, next step, status, optional competencies, timestamps.
- `Win`: title, impact, evidence, date, optional competencies, source idea, report visibility.
- `Report`: period, selected wins, editable Markdown content, saved timestamp.
- `Competency`: source framework, level-specific behavioral signals, keywords for suggestions.

## Reliability

- Versioned localStorage schema (`career-os:v2`).
- Automatic migration from the v1 task/win model.
- JSON backup and restore.
- Pure domain logic in `career-core.mjs`.
- Node built-in tests for suggestions, migration, promotion, reporting, period filters, and insights.
- Static-export configuration and GitHub Pages workflow.
