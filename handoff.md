# Escada — Handoff

**Last updated:** after v42 (consolidation pass, v43).
**This file is a snapshot, not a changelog.** Earlier sessions appended a
new section per patch, which is how this project's docs drifted out of
sync with `origin/main` more than once (v34 baseline confusion; v40/v41
appended on top of the v39 consolidation instead of triggering a fresh
rewrite). Going forward, `handoff.md` should be *rewritten* at natural
pause points — not appended to indefinitely. If you're reading this having
just landed several patches in a row, that's the signal to rewrite this
file again rather than append a sixth section.

## Confirmed baseline

Always verify with `git log --oneline -1 origin/main` before trusting this
file or any other doc in this repo. As of this consolidation, the
confirmed chain is:

```
v34 → v35 → v36 → v37 → v38 → v39 → v40 → v41 → v42 → v43 (this patch, docs only)
```

All are applied and pushed to `origin/main`. Test count after v42:
**141/141 passing**
(`tests/escada-v{8,10,11,12,13,14,15,16,17,18,19,20,21}.test.mjs`).

## What v34–v42 did (Fable Architectural Review roadmap)

Source: Deep Architectural & GUI Review from Claude Fable, delivered
2026-09-04 (`fable-roadmap.md`, kept as the working plan document — status
markers updated in place, plan content for remaining patches preserved).
All P0 items shipped; P1 in progress (Patch D–G shipped, some scoped down
from the literal ask with reasons recorded below and in the roadmap file
itself).

- **v34 — Guarded import + hydration safety (P0-1).** `isEscadaState(raw)`
  structural gate in `career-core.mjs`; `migrateState` refuses garbage
  input instead of merging unknown keys into live state. Corrupt primary
  storage key preserved (`escada:corrupt:<iso>`) rather than silently
  falling back to an older key. `escada:backup:<iso>` rotation (last 3)
  before hydration/import overwrites. `importData` requires explicit
  confirm with idea/win/report counts. `localStorage` persistence wrapped
  in try/catch with a recovery banner on quota errors.

- **v35 — Retrieval admission filter + provenance (P0-2).**
  `retrieveCriteria`'s admission bug fixed: a criterion was admitted
  whenever `currentBoost` alone cleared the score threshold, with zero
  real text overlap and zero explicit competency match. Confirmed
  concretely: an unrelated artifact ("bought bread and milk") got 2
  confident "strengths". Fixed: admission requires `overlap > 0 ||
  explicitMatch`. New `matches: {criterion, overlap, explicit}[]` field
  (backward-compatible — `criteria` bare-array unchanged). `strengths`/
  `stretch` gated on real matches only; empty is now valid and honest.

- **v36 — Level-signal tie-break + behavior-ref fallback (P0-3, math
  half).** `inferLevelSignal`: on a genuine score tie (verified: a 3-way
  tie is reproducible), the old code always picked the *higher* level —
  silently inflating inferred growth regardless of the person's actual
  profile level. Fixed: ties resolve to whichever tied level is closest to
  the profile's current level. `suggestBehaviorRefs`: the zero-overlap
  fallback ranked by insertion order, not score — fixed to sort by score
  first.

- **v37 — Accept-chip for AI-suggested level signal (P0-3, UI half).** New
  `levelSignalConfirmed: boolean` on `Idea`/`Win`, defaulting to `false`
  everywhere a record is constructed or migrated. `saveIdea`/`saveWin`
  previously overwrote `levelSignal` unconditionally on every save — any
  confirmation would have been silently discarded. Fixed: a confirmed
  value survives save unless the record's text no longer supports it.
  One-click "Подтвердить" / "✓ Подтверждено" chip added to
  `IdeaWorkspace`. `WinModal` intentionally not touched (no level-signal UI
  there — out of scope, not forgotten).

- **v38 — Report reachability + update-by-id save + real HTML escaping
  (P1, Patch D).** Closed the long-standing product priority: saved
  reports were unreachable — never shown on the Reports page at all, only
  inside the open draft modal, capped at 5. Fixed with a full, uncapped
  "Сохранённые отчёты" section + type filter. `reportText` no longer
  doubles as the modal-visibility flag (new `reportDraftOpen: boolean`).
  `saveReport` updates in place by `currentReportId` (single "Сохранить"
  button, per product decision — the roadmap's two-button "save as new
  version" design was **not** implemented). Print/PDF: the report body was already escaped correctly; only title/periodLine (from free-text profile.name) lacked escaping, now fixed. **Dropped, confirmed with Pavel:** the
  roadmap's `window.open`/`noopener` claim — checked against the current
  MDN reference, `noopener` nulls the new window's `.opener`, not the
  return value of `open()` itself; the existing `if (!printWindow)` guard
  already handles the real failure case correctly. No change made there.

- **v39 — Documentation consolidation.** `handoff.md` and
  `escada-product-roadmap.md` rewritten as clean snapshots instead of
  further appends; `fable-roadmap.md` got targeted status-marker edits.
  No application code changed.

- **v40 — Stale note-conversion + import editor-clearing (Patch E,
  scoped / P1-5, part of P1-6).** **Scope note:** the roadmap's literal ask
  was a full id-based `useMemo` rewrite of `ideaDraft`/`winDraft`/
  `openNote` (currently full entity snapshots). Checked the actual UI
  layering first: `IdeaWorkspace`/`WinModal` render as overlays ON TOP OF
  `IdeasView`/`WinsView` (both mounted simultaneously) — the specific
  failure mode the roadmap worried about (Kanban drag mutating an idea
  while its own editor is open) is not practically reachable, since the
  editor modal covers the list behind it. Scoped down to two concrete,
  everyday-reachable bugs instead: (1) editing a note's text, then
  clicking "Это идея!" without clicking "Сохранить" first, silently used
  the pre-edit text — fixed with `convertNoteToIdea(noteId, pendingText?)`
  looking the note up fresh and applying pending text atomically (a naive
  "call onEdit then onConvert" would still race, since `setState` isn't
  synchronous); (2) `importData` never cleared open editors — fixed, all
  four cleared on import.

- **v41 — Unified unsaved-work guard + PWA reload safety (Patch F /
  P1-6).** `useDialogBehavior`/`Modal`/`ArtifactEditorShell` gained
  `isDirty`: Escape, backdrop-click, and the close button all confirm via
  `window.confirm` before discarding input. Wired into every editor with
  comparable draft state. New `hasUnsavedWork` unified selector. **Found a
  worse bug than the roadmap described** while reviewing the old SW-reload
  gate: it only checked `ideaDraft || winDraft || reportDraftOpen` —
  `openNote` was never included, so a pending update could silently
  `window.location.reload()` while a note was open with unsaved text, zero
  warning. Fixed by removing auto-reload entirely — replaced with a
  persistent, dismissible banner ("Доступно обновление" / "Перезагрузить"
  / "Позже"). `beforeunload` added (didn't exist at all before).
  `generateReport` ("Пересобрать черновик") now confirms before
  overwriting an edited draft.

- **v42 — AI response validation + timeout + rewrite-merge fix (Patch G,
  validation half / P1-1).** `parseAndValidateAiResponse` already existed
  fully implemented in `ai-contract.mjs` (citation-id allowlisting,
  length clamps, required-field checks) but was **never called** from
  `CareerDashboard.tsx` — confirmed by grep. An external endpoint's raw
  response flowed straight into the UI unvalidated; the closed-world
  citation guarantee was enforced only by the prompt, never by code.
  Verified concretely: a fabricated citation ID passed through before this
  patch; `parseAndValidateAiResponse` now filters it out. Fixed:
  `requestAi` computes `retrieval` locally (never trusting the allowlist
  from the endpoint being validated) and validates before returning.
  `AbortController` with a 20s timeout added (zero timeout handling
  existed before — a hung endpoint left `aiBusy` stuck forever). New
  `nonEmptyFields` helper fixes the rewrite-apply bug: `parseAndValidateAiResponse`
  normalizes a missing rewrite field to `''` (not `undefined`), so a
  title-only rewrite was silently blanking `impact`/`evidence` on apply —
  verified with both pre- and post-fix merge behavior. **Scope note:** P1-2
  (growth-guidance payload budget) deferred to its own patch — see below.

## Fable roadmap — what's left

See `fable-roadmap.md` for full detail (status markers updated in place;
plan content for remaining patches unchanged). Remaining, roughly in
dependency order:

- **Patch G, remainder (P1-2, deferred from v42):** growth-guidance
  payload budget. `GrowthView`'s AI call sends the entire raw `state.wins`
  array unfiltered. Measured directly (not estimated): a realistic `Win`
  object serializes to ~938 characters; at the roadmap's stated ~24000
  character server limit, this is exceeded around **26 wins** — a
  plausible count after 1–2 years of active use, which is exactly the
  product's target usage pattern. Needs aggregated signals (counts per
  confirmed competency, last N win title+impact) instead of a raw dump —
  a different shape of fix than v42's validation work, not a quick
  follow-on.
- **Patch H** — migration normalization + error boundary (P1-4). Confirmed
  real gap: `career-core.mjs`'s `migrateState` does `reports:
  Array.isArray(raw.reports) ? raw.reports : []` with **no**
  `normalizeReport` equivalent (unlike `normalizeIdea`/`normalizeWin`).
- **Patch I** — multi-tab safety (P1-7)
- **Patch J** — contract cleanup: enums, types, unify inference (P1-9)
- **Patch K** — scoped AI state per view (P1-10)
- **Product decision (P1-8, not yet made):** Idea → Work definition —
  needed before whichever patch touches that surface

Next patch number: **v44** (tentatively Patch H, or the deferred P1-2
payload-budget half of Patch G — either is reasonable to pick up next;
confirm against `git log origin/main` before starting either).

## Separate, pre-Fable feature track (also relevant, not forgotten)

Distinct from the Fable architectural-review work above. Status as of this
consolidation, unchanged since v39:

- **v31 — Custom scale upload (mock parser).** Shipped. `parseCustomScaleMock`
  is a deterministic offline parser, **not** real AI parsing — still true
  as of v42.
- **v32 — AI retrieval on active scale.** Shipped.
- **v33 — Personal focus per cycle.** Shipped — `focusCompetencyIds`.
- **Real AI parsing for the custom scale** — **still not done**. Standing
  priority from before the Fable review started; superseded in urgency,
  never completed.
- **"Шкала" as answer, not encyclopedia** — not started.
- **Soft return-rhythm reminders** — not started.

## Mandatory delivery protocol (unchanged, restated for a fresh session)

1. `git pull --ff-only origin main`; verify `git log --oneline` baseline
   matches what you expect before writing any patch — **do not trust this
   file, `escada-product-roadmap.md`, or memory for the exact baseline
   commit; only `git log` is authoritative.**
2. One new `escada_patch_vN.py` per patch, never reuse a filename.
3. Every edit via `str_replace_once`-style exact-match with a uniqueness
   check (`count == 1`, else `REFUSING` + no changes).
4. `npm ci && npm run test:escada && npm run build` — full success required.
5. `git commit` + `git push origin main` only on complete success.
6. Dirty-tree check excludes files matching `escada_patch_v\d+\.py` only.
7. Work only on `main`.
8. Code and commit messages in English; product UI stays in Russian.
9. **Before implementing a roadmap claim, verify it against the actual
   code or an authoritative outside source when the claim is checkable**
   (e.g. a browser API's documented behavior). Two roadmap claims have
   already turned out to be wrong or overstated when checked directly:
   the `window.open`/`noopener` claim in Patch D (dropped after checking
   current MDN docs), and the SW-reload bug in Patch F (found to be worse
   than described once actually read). Trust but verify, every time —
   the roadmap is a plan, not a spec already proven correct.

## Known project-level facts worth restating for a fresh session

- Local-first PWA, no backend, all data in `localStorage` (`escada:v5`,
  with `escada:v4`/`escada:v3`/`career-os:v2`/`career-os:v1` as legacy
  fallback keys, plus `escada:backup:*` and `escada:corrupt:*` from v34).
- Optional external AI endpoint (`ESCADA_AI_ENDPOINT`) with a mandatory
  local guidance fallback engine (`local-guidance.mjs`) — must never block
  the UX when offline. As of v42, the external path is now validated and
  timeout-bounded, matching the guarantees the local path always had.
- Deploy target: GitHub Pages, `saypavnik-code/career`, `basePath: /career`.
- No React test harness exists in this project (no testing-library/jsdom/
  vitest in `package.json`) — all test coverage is pure-logic `.mjs` tests
  via `node --test`. React/`.tsx` behavior needing regression coverage
  gets modeled as a plain-data state machine mirroring the real logic
  (see `tests/escada-v18.test.mjs`, `escada-v20.test.mjs`,
  `escada-v21.test.mjs` for the pattern — report state machine, unsaved-
  work selector, AI-response validation respectively).
