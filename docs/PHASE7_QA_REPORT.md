# Phase 7 — UX QA and stabilization report

**Status:** completed alongside patch v19, the final phase of the AI-First
Product Roadmap. This document records what was actually checked, not just
that a checklist was run.

## Method

Every one of roadmap section 11's 8 mandatory scenarios and section 15's 15
Definition-of-Done items was traced against the live code — either by
running the real `career-core.mjs` / `local-guidance.mjs` functions directly
in Node against realistic input, or by reading the exact rendered JSX — not
by assuming a prior patch's own description was still accurate.

## The 8 mandatory scenarios (roadmap section 11)

All 8 pass, and are now permanent regression tests in
`tests/escada-v10.test.mjs` (not just a one-time manual check):

1. Записать мысль — `createNote()` produces a well-formed Note, appended to
   `state.notes`.
2. Открыть заметку — retrievable by id from `state.notes`.
3. Превратить заметку в идею — `noteToIdea()` carries title/body across
   without asking the person to retype anything; `convertedIdeaId` links
   back correctly.
4. Изменить статус идеи — all four active statuses round-trip through
   `migrateIdeaStatus()` unchanged (idempotent).
5. Получить карьерную подсказку — `buildLocalGuidance('idea_review', ...)`
   returns a headline, cited strengths, and a caveat with zero external AI
   configured.
6. Превратить идею в win — `promoteIdeaToWin()` produces a win linked by
   `sourceIdeaId`, carrying `idea.details` into `sourceContext`.
7. Найти win в разделе Wins — the win is present in `state.wins`, and the
   source idea leaves the active kanban (status `won`, filtered out of the
   four visible columns).
8. Перезагрузить страницу — a full `JSON.stringify` -> `JSON.parse` ->
   `migrateState()` round-trip (exactly what `CareerDashboard.tsx` does on
   mount) preserves the note.

## Definition of Done (roadmap section 15) — 15 items

All 15 confirmed true against the live code, with two genuine gaps found
and fixed by this patch (items 9 and 12 below), and one judgment call
flagged rather than silently decided (item 7):

| # | Item | Status |
|---|---|---|
| 1 | «Сегодня» = only form + pin board | OK — verified, no other elements in `TodayView` |
| 2 | Note created in one action | OK |
| 3 | Title = first four words | OK — `deriveNoteTitle()`, tested against the roadmap's own worked example |
| 4 | Note opens as an overlay | OK — reuses `Modal` (backdrop, click-outside, Escape), no route change |
| 5 | Note -> Idea without retyping | OK |
| 6 | «Идеи» is a clean kanban | OK — no filter bar, no duplicate heading |
| 7 | Idea has only title/meaning/status/hint | **Judgment call, not a bug** — see below |
| 8 | No internal work-item kanban | OK — confirmed absent from the rendered JSX |
| 9 | `Win!` creates a linked win | OK, but see the sourceContext fix below |
| 10 | Career hint uses the real scale | OK, including the lead-level fix from v17 |
| 11 | External AI is optional | OK — `requestAi()` falls back to `buildLocalGuidance()` unconditionally |
| 12 | All old user data preserved | **Fixed this patch** — see below |
| 13 | August design system preserved | OK — every new CSS rule since v11 uses existing tokens only |
| 14 | Mobile/tablet/desktop checked | OK — pin board, kanban, and idea workspace each have their own breakpoints |
| 15 | Build + tests pass before commit | OK — structural: every patch script's gate runs `npm ci && npm run test:escada && npm run build` before allowing a commit |

### Fixed: migration gap on `sourceContext` (item 12)

v18 added `sourceContext` to the Win shape and correctly set it in
`promoteIdeaToWin()`, but never updated `normalizeWin()` — the function
every stored win passes through on load via `migrateState()` — or the two
hand-written wins in `demoState()`. A win saved before v18 (or the demo
data) would migrate with `sourceContext: undefined`, which doesn't match
the `Win` TypeScript interface's `string` type. Found by running a full
legacy-v1-to-v5 migration in Node and inspecting the actual output, not by
reading the v18 diff. Fixed: both now default to `''`.

### Removed: dead `autoAi` code (stabilization, not a bug)

`IdeaWorkspace`'s `autoAi` prop / `ideaAiOnOpen` state / `hasAutoRun` ref
existed to auto-run `idea_review` when opened from a now-removed
"✦ ИИ-подсказка" button on the old (pre-v14) idea card. `setIdeaAiOnOpen(true)`
is not called anywhere in the current code — the auto-run path has been
permanently unreachable since v14's kanban rewrite. This never violated
section 13's "AI-анализ без нажатия кнопки" exclusion (the dead path never
fired), but Phase 7 explicitly asks for stabilization, so it's removed.
"Разобрать с Эскадой" remains the only way to trigger `idea_review`, exactly
as it already behaved in practice — this is a cleanup, not a behavior change.

### Flagged: DoD item 7's terse wording vs. section 6.2's fuller spec

DoD #7 says an idea should contain "только название, смысл, статус и
карьерная подсказка." The current `IdeaWorkspace` (built in v15/v16 against
section 6's more detailed spec, not against this one-line summary) also
keeps: a competency-chips section, the "Разобрать с Эскадой" AI panel, and
two collapsed-by-default secondary sections ("Рабочие заметки",
"Доказательства"). Section 6.2 itself says only that title and meaning are
"два **основных** поля" — implying other things can exist without being
main fields — and section 13's explicit exclusion list does not mention
competencies, notes, or evidence. This patch does not remove any of that
functionality on the strength of a terser restatement contradicting a more
detailed spec it was already built against; it's flagged here for a human
call rather than decided unilaterally in code.

## Priorities (roadmap section 12)

All 13 P0 items are present and working. No P1 or P2 item was
accidentally implemented ahead of schedule — spot-checked "сохранение
AI-предложения в поле «Смысл»" (P1) specifically, confirmed absent.

## Exclusions (roadmap section 13)

Spot-checked the codebase for accidental reintroduction of anything on the
explicit exclusion list (percentage-based competency scoring, deadlines,
sprints, auto-triggered AI, a separate AI chat, manager dashboard). None
found.

## Technical verification (this patch, and every patch since v11)

```bash
npm ci
npm run test:escada
npm run build
```

All three pass before any commit is made — enforced structurally by every
patch script's own verification gate, not just claimed.
