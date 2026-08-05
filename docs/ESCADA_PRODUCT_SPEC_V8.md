# Эскада v8 — Profile-aware closed-world AI guidance

## Product promise

Я быстро записываю работу и идеи, а Эскада помогает превратить их в доказательства моего профессионального роста.

Core loop:

`Записал → Развил → Подтвердил → Оформил → Понял следующий шаг`

## Product boundaries

Эскада остаётся личной профессиональной памятью. Это не HRIS, не система аттестации, не Jira и не универсальный task manager.

- Competencies guide reflection but never become a mandatory checklist.
- AI appears only after an explicit button click.
- AI never assigns an official level or predicts promotion.
- No KPI module, employee comparison, manager approval, leaderboard or automatic review cycle.

## Navigation

1. Сегодня — free-form capture and one calm recommendation.
2. Идеи — minimal cards and expandable workspaces.
3. Wins — simple, evidence-based achievements.
4. Отчёты — manual selection and AI-assisted draft.
5. Рост — current expectations, next-level expectations and full reference scale.

Settings are opened from the profile chip.

## Data model v4

- `captures`: free-form thoughts that can later become an idea, win or note.
- `ideas`: context, next step, light kanban, notes, evidence and optional competency links.
- `wins`: result, importance, evidence, optional metrics and confirmation.
- `reports`: type, period, selected wins, optional in-progress ideas and editable content.
- `profile`: name, free-form role title, market/team and separately selected scale level.

Storage migrates from `escada:v3`, `career-os:v2` and `career-os:v1` to `escada:v4`.

## Closed-world AI

The competency scale is stored in `competency-knowledge.mjs` as 12 competencies, three levels and criterion-level source page references.

AI request flow:

1. User clicks a contextual button.
2. Server validates profile and artifact payload.
3. Deterministic retrieval selects criteria for the current and next level.
4. Only the selected artifact and retrieved criteria are sent to the configured model.
5. The model must return structured JSON.
6. The server rejects unsupported criterion IDs and retries malformed JSON once.
7. UI shows the cited scale criteria under “Почему Эскада так решила?”.

Contextual actions:

- Idea: `Разобрать с Эскадой`.
- Win: `Усилить формулировку`.
- Report: `Собрать черновик с Эскадой` and `Проверить по шкале`.
- Growth: `Что развивать дальше?`.

## Runtime configuration

The project now uses a server deployment instead of GitHub Pages static export.

Environment variables:

- `ESCADA_AI_BASE_URL`: OpenAI-compatible internal or external API base URL ending before `/chat/completions`.
- `ESCADA_AI_MODEL`: model identifier.
- `ESCADA_AI_API_KEY`: optional bearer token.

The browser never receives the API key. The API route applies payload limits, a simple in-memory rate limit, a 45-second timeout, closed-world prompt rules and response validation.

## Verification

- Unit tests cover migration, quick capture, growth logic, knowledge-base completeness, retrieval boundaries and AI-response validation.
- Production verification runs `node --test tests/escada-v8.test.mjs` and `next build`.
