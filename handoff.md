# Escada — Handoff

**Last updated:** after v38 (consolidation pass, this patch).
**This file is a snapshot, not a changelog.** Previous sessions appended a
new section per patch (v34 → v38), which is how this project's baseline
drifted out of sync with `origin/main` once before (confirmed against
`git log` on 2026-09-04, documented in the v34 patch commit). Going forward,
`handoff.md` should be *rewritten* to reflect current state at natural
pause points (like this one), not appended to indefinitely.

## Confirmed baseline

Always verify with `git log --oneline -1 origin/main` before trusting this
file or any other doc in this repo. As of this consolidation, the confirmed
chain is:

```
v34 → v35 → v36 → v37 → v38
```

All five are applied and pushed to `origin/main`.

## What v34–v38 did (Fable Architectural Review roadmap)

Source: Deep Architectural & GUI Review from Claude Fable, delivered
2026-09-04 (`fable-roadmap.md`). All P0 items (critical, data/trust) and
one P1 item are shipped:

- **v34 — Guarded import + hydration safety (Fable P0-1).**
  `isEscadaState(raw)` structural gate in `career-core.mjs`; `migrateState`
  refuses garbage input instead of merging unknown keys into live state.
  Corrupt primary storage key preserved under `escada:corrupt:<iso>` rather
  than silently falling back to an older key. `escada:backup:<iso>`
  rotation (last 3) before hydration/import overwrites. `importData`
  requires explicit confirm with idea/win/report counts. `localStorage`
  persistence wrapped in try/catch with a recovery banner on quota errors.

- **v35 — Retrieval admission filter + provenance (Fable P0-2).**
  `retrieveCriteria`'s admission bug fixed: a criterion was previously
  admitted into AI/local-guidance results whenever `currentBoost` alone
  cleared the score threshold, with zero real text overlap and zero
  explicit competency match. Confirmed concretely: an unrelated artifact
  ("bought bread and milk") got 2 confident "strengths" citing career
  criteria. Fixed: admission now requires `overlap > 0 || explicitMatch`.
  `retrieveCriteria` returns a new `matches: {criterion, overlap,
  explicit}[]` field (backward-compatible — `criteria` bare-array
  unchanged). `buildLocalGuidance` gates `strengths`/`stretch` on real
  matches only; empty is now a valid, honest result.

- **v36 — Level-signal tie-break + behavior-ref fallback (Fable P0-3, math
  half).** `inferLevelSignal`: on a genuine score tie between levels
  (verified: a 3-way tie is reproducible), the old code always picked the
  *higher* level regardless of the person's actual profile level — silently
  inflating inferred growth. Fixed: ties resolve to whichever tied level is
  closest to the profile's current level. `suggestBehaviorRefs`: the
  zero-overlap fallback ranked by insertion order, not score — fixed to
  sort by score before slicing.

- **v37 — Accept-chip for AI-suggested level signal (Fable P0-3, UI half).**
  New `levelSignalConfirmed: boolean` on `Idea`/`Win`, defaulting to `false`
  everywhere a record is constructed or migrated. `saveIdea`/`saveWin`
  previously overwrote `levelSignal` unconditionally on every save — any
  future confirmation would have been silently discarded. Fixed: a
  confirmed value survives save unless the record's current text no longer
  supports it (then it resets — no stale confirmations). One-click
  "Подтвердить" / "✓ Подтверждено" chip added to `IdeaWorkspace`'s existing
  "Карьерный сигнал" panel. `WinModal` intentionally not touched (no
  level-signal UI there today — out of scope, not forgotten).

- **v38 — Report reachability + update-by-id save + real HTML escaping
  (Fable P1, Patch D).** Closes the long-standing product priority: the
  "Записал → Развил → Подтвердил → Оформил" funnel used to end with saved
  reports being unreachable — `state.reports` was never shown on the
  Reports page at all, only inside the open draft modal, capped at 5.
  Fixed with a full, uncapped "Сохранённые отчёты" section + type filter.
  `reportText` no longer doubles as the modal-visibility flag (new
  `reportDraftOpen: boolean`). `saveReport` now updates in place by
  `currentReportId` (single "Сохранить" button, per product decision — the
  roadmap's original two-button "save as new version" design was **not**
  implemented; Pavel chose single-button update-by-id instead).
  `generateReport`/`useProfileReportingPeriod` clear `currentReportId` so
  regenerating or restarting a period never silently overwrites an
  unrelated saved report. Print/PDF: the report body was already escaped correctly; only title/periodLine (from free-text profile.name) lacked escaping, now fixed.
  **Dropped from this patch, confirmed with Pavel:** the roadmap's claim
  that `window.open(..., 'noopener')` returns `null` and print "never
  worked" — checked against the current MDN `Window.open()` reference,
  `noopener` nulls the new window's `.opener`, not the return value of
  `open()` itself. The existing `if (!printWindow)` guard already handles
  the real failure case (popup blocker) correctly. No change was made
  there.

Test count after v38: **121/121 passing**
(`tests/escada-v{8,10,11,12,13,14,15,16,17,18}.test.mjs`).

## Fable roadmap — what's left

See `fable-roadmap.md` for full detail (kept as the working plan document,
status header updated). Remaining, roughly in dependency order:

- **Patch E** — editor identity: id instead of snapshot (P1-5, part of P1-6)
- **Patch F** — unsaved-work guard + PWA reload safety (P1-6)
- **Patch G** — AI response validation + payload budget (P1-1, P1-2) — note:
  `parseAndValidateAiResponse` already exists in `ai-contract.mjs`; verify
  what it actually covers before assuming this patch is a green-field build
- **Patch H** — migration normalization + error boundary (P1-4) — note:
  `career-core.mjs`'s `migrateState` currently does `reports:
  Array.isArray(raw.reports) ? raw.reports : []` with **no**
  `normalizeReport` equivalent (unlike `normalizeIdea`/`normalizeWin`) —
  confirmed while working on v38; this is real, not hypothetical
- **Patch I** — multi-tab safety (P1-7)
- **Patch J** — contract cleanup: enums, types, unify inference (P1-9)
- **Patch K** — scoped AI state per view (P1-10)
- **Product decision (P1-8, not yet made):** Idea → Work definition —
  needed before whichever patch touches that surface

Next patch number: **v39** (Fable Patch E, tentatively — confirm against
`git log origin/main` before starting, per the mandatory protocol).

## Separate, pre-Fable feature track (also relevant, not forgotten)

This roadmap is distinct from the Fable architectural-review work above.
Status as of this consolidation:

- **v31 — Custom scale upload (mock parser).** Shipped (before the Fable
  work started; confirmed present in the codebase — `custom-scale.mjs`,
  `active-scale.mjs`). `parseCustomScaleMock` is a deterministic offline
  parser, **not** real AI parsing.
- **v32 — AI retrieval on active scale.** Shipped — `ai-contract.mjs`/
  `local-guidance.mjs` read the scale through `active-scale.mjs` instead of
  a static import.
- **v33 — Personal focus per cycle.** Shipped — `focusCompetencyIds`,
  `onSetFocus`, narrows "Мой путь" to 1–3 chosen competencies.
- **Real AI parsing for the custom scale** (replacing `parseCustomScaleMock`
  with an actual model call) — **still not done**. This was the standing
  "next priority" noted before the Fable review started; it got superseded
  in urgency by the Fable P0 items but was never actually completed.
  `parseCustomScaleMock` is still a mock as of v38.
- **"Шкала" as answer, not encyclopedia** (collapse the 149-criteria list
  behind a disclosure by default) — not started.
- **Soft return-rhythm reminders** (local PWA push, no server) — not
  started.

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

## Known project-level facts worth restating for a fresh session

- Local-first PWA, no backend, all data in `localStorage`
  (`escada:v5`, with `escada:v4`/`escada:v3`/`career-os:v2`/`career-os:v1`
  as legacy fallback keys, plus `escada:backup:*` and `escada:corrupt:*`
  added in v34).
- Optional external AI endpoint (`ESCADA_AI_ENDPOINT`) with a mandatory
  local guidance fallback engine (`local-guidance.mjs`) — must never block
  the UX when offline.
- Deploy target: GitHub Pages, `saypavnik-code/career`, `basePath: /career`.
- No React test harness exists in this project (no testing-library/jsdom/
  vitest in `package.json`) — all test coverage is pure-logic `.mjs` tests
  via `node --test`. React/`.tsx` behavior that needs regression coverage
  gets modeled as a plain-data state machine mirroring the real logic (see
  `tests/escada-v18.test.mjs` for the pattern).


## v40 -- Stale note-conversion + import editor-clearing (Fable Patch E, scoped / P1-5, part of P1-6)

- **Scope note:** the roadmap's literal ask for Patch E was a full id-based `useMemo` rewrite of `ideaDraft`/`winDraft`/`openNote` (currently full entity snapshots). Checked the actual UI layering first: `IdeaWorkspace`/`WinModal` render as overlays ON TOP OF `IdeasView`/`WinsView` (both mounted simultaneously) -- the specific failure mode the roadmap worried about (Kanban drag mutating an idea while its own editor is open) is not practically reachable, since the editor modal covers the list behind it. Scoped this patch to the two concrete, everyday-reachable bugs instead of the full architectural rewrite.
- **Stale note-conversion bug (confirmed exactly):** editing a note's text, then clicking "Это идея!" without first clicking "Сохранить", silently used the pre-edit text -- `NoteOverlay` kept local edit state but passed the original stale `note` prop through to `convertNoteToIdea`. Fixed: `convertNoteToIdea(noteId, pendingText?)` looks the note up fresh from `state.notes`; `NoteOverlay` passes its pending text through atomically in the same call (calling `onEdit` then `onConvert` separately would still race, since `setState` is not synchronous).
- **Import doesn't clear open editors (confirmed exactly):** `importData` replaced the entire dataset but never cleared `ideaDraft`/`winDraft`/`openNote`/`newIdeaFromNote`. Fixed: all four cleared on successful import.
- tests/escada-v19.test.mjs exercises the real `noteToIdea`/`deriveNoteTitle` logic against the stale-vs-pending-text scenario concretely (a bought-bread note vs. pending lead-level text).
- Next: Fable roadmap Patch F -- unsaved-work guard + PWA reload safety (P1-6).


## v41 -- Unified unsaved-work guard + PWA reload safety (Fable Patch F / P1-6)

- `useDialogBehavior`/`Modal`/`ArtifactEditorShell` gained an `isDirty` prop: Escape, backdrop-click, and the header close button all confirm via `window.confirm` before discarding input when dirty. Wired into `IdeaWorkspace`, `WinModal`, `NewIdeaModal`, `ProfileModal` (compare `JSON.stringify(draft)` vs `initial`), `NoteOverlay` (reused its v40 `dirty` variable), and `ReportDraftModal` (new `reportBaseline` state, since the report editor is a controlled component).
- New `hasUnsavedWork` unified selector covering ideaDraft, winDraft, reportDraftOpen, openNote, newIdeaFromNote, profileOpen, non-empty quickText, and incomplete onboarding.
- **Found a worse bug than the roadmap described while reviewing the old SW-reload gate**: it only checked `ideaDraft || winDraft || reportDraftOpen` -- `openNote` was never included, so a pending service-worker update could silently `window.location.reload()` while a note overlay was open with unsaved text, with zero warning and without the person closing anything. Fixed by removing the auto-reload entirely: a persistent, dismissible banner ("Доступно обновление Эскады." / "Перезагрузить" / "Позже") replaces it -- the person decides when, matching the roadmap's explicit ask.
- `beforeunload` handler added (previously did not exist at all, confirmed by grep before implementing).
- `generateReport` ("Пересобрать черновик") now confirms before overwriting an edited draft, via the new `reportBaseline` tracking.
- tests/escada-v20.test.mjs covers `hasUnsavedWork`, the `isDirty` comparison, the `reportBaseline` lifecycle, and the regenerate-confirm gate as plain-data logic, including a regression test for the openNote gap specifically.
- Next: Fable roadmap Patch G -- AI response validation + payload budget (P1-1, P1-2). Note: `parseAndValidateAiResponse` already exists in `ai-contract.mjs` -- verify what it actually covers before assuming this is a green-field build.
