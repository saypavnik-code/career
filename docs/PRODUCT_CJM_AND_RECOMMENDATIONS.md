# Product CJM and recommendations

**Status:** living document, last updated alongside patch v11.
**Scope:** who the user is, their journey through Эскада, and concrete,
principle-compatible product improvements. This does not replace
`ESCADA_PRODUCT_SPEC_V8.md` — it is the reasoning layer behind it.

## Who the user is

A conscientious individual contributor in an international Digital Marketing
team who does real, often good, work — but is bad at narrating it. They are
not chasing motivation or gamification; they are trying to close the gap
between "I did meaningful things this quarter" and "I can produce three
convincing sentences about it in a 1:1 or a promotion case."

Two consequences follow directly from this and are already reflected in the
product:

- Capture must accept zero classification effort, because the moment a
  thought occurs is rarely the moment there is spare attention to categorize it.
- Escada must actively resist inventing numbers, causality, or manager
  recognition, because this user is more likely to under-claim than
  over-claim, and the failure mode to guard against is fabricated confidence
  under report-writing pressure, not self-promotion.

## Journey (five stages)

1. **Trigger** — something happens at work: an idea, a decision, praise, a
   deadline. Off-product.
2. **Capture** — "Сегодня" screen, free-text, no forced classification.
3. **Develop** — inside an idea workspace: lightweight kanban, notes,
   optional guidance on request.
4. **Evidence** — a win: what happened, why it matters, what proves it.
5. **Report / Growth** — draft assembled from selected wins; growth view
   shows next-level signals.

Emotional arc: calm at capture -> mild anxiety about forgetting mid-cycle ->
uncertainty about wording when writing a win -> relief/confidence once a
report draft exists.

## Primary risk: the idea -> win handoff is silent

Nothing in the current flow proactively surfaces "this idea's kanban is all
`done` and it has no linked win yet." The user must remember, unprompted, to
open the idea and click "Оформить win." For someone whose core problem is
*forgetting to document*, this is exactly the seam most likely to leak.

### Recommendation 1 — surface a "ready to become a win" signal

Extend the existing `buildCoachNotes` logic (already used for the promptCard
on "Сегодня") to include ideas where all `workItems` are `done` but no win
references that `ideaId`. This reuses the existing coach-note mechanism and
UI slot — no new component, no new AI call, consistent with "AI only on
explicit request" since this is a deterministic local heuristic, not a model
call.

### Recommendation 2 — show the idea -> win link on the win itself

The data model already carries `ideaId` on a win (used by
`promoteIdeaToWin` / `captureToWinDraft`), but the win card and win detail
view do not display it. Surfacing a small "из идеи «...»" reference on the
win card would close the narrative loop when the user is selecting wins for
a report and trying to remember the fuller context.

### Recommendation 3 — use `reportingRhythm` proactively

`Profile.reportingRhythm` (`monthly` / `quarterly` / `half-year`) and
`cycleEnd` already exist on the profile but are not used to time any
guidance. A coach note like "1:1 через N дней — соберите wins" would close
another gap between "product knows the user's review cadence" and "product
never mentions it." This stays within the closed-world, button-triggered,
no-background-AI constraints since it is a date comparison, not a model call.

### Recommendation 4 — verify the "quick capture under 10 seconds" claim

Handoff section 19 (Step 4) asks for a real-user simplicity review; nobody
has run it. Before adding more guidance surfaces, validate that the existing
five-screen flow actually holds up for one or two real users. Cheap to run,
high signal, and it will tell us whether Recommendations 1-3 are worth
building at all.

## Explicitly out of scope (per product principles)

Manager dashboards, employee comparison, ranking, gamified streaks, and
automatic level assignment remain excluded — none of the above
recommendations introduce any of these; they only make the existing local,
button/heuristic-driven guidance more proactive within a single user's own
data.

## Sprint v25 implementation status

The three continuity recommendations above are now represented in the product flow:

- the win-ready signal is surfaced directly on the idea kanban;
- linked wins show the source idea, and saved reports can be reopened;
- `reportingRhythm` / `cycleEnd` now drive the default reporting period and are editable from Profile, with an explicit contextual control in Reports rather than a new Today-screen interruption.

A second continuity gap was also closed: archiving an idea is now reversible, and deleting a win that came from an idea restores that source idea to `outcomes` instead of leaving it stranded in terminal `won`.

The "Сегодня" screen remains intentionally limited to capture + pin board; reporting-cycle context lives in Reports/Profile so the capture step stays low-friction.
