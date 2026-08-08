#!/usr/bin/env python3
"""
escada_win_confirm_and_note_edit_v18.py

Эскада — patch v18.

Scope: Roadmap "AI First Product Roadmap" — Phase 6 ("Преобразование идеи в
Win"), plus an out-of-roadmap request: editable notes from the "Сегодня"
pin board. Both are independent, low-risk changes bundled into one patch at
the person's request.

Before writing anything, this patch's design was checked against the live
v17 code, not assumed:
  - §8.4 ("судьба исходной идеи") was already fully correct: saveWin()
    already sets the source idea's status to 'won' (removing it from the
    active kanban, since IdeasView already filters won/archived), already
    stores sourceIdeaId on the win, and never deletes idea data. No changes
    needed there.
  - §8.2's prefill table was three-quarters done already (title -> "Что
    произошло", competencyIds -> competencyIds, idea id -> sourceIdeaId).
    The one gap: "Смысл" (idea.details) was never carried into the win as
    "Исходный контекст" — Win/WinDraft had no field for it at all.
  - §8.1's confirmation step and duplicate-conversion guard did not exist:
    "Win!" jumped straight into the win form, and nothing stopped clicking
    it twice on the same idea (in practice unreachable through the UI once
    an idea is 'won', since the kanban filters it out — but the roadmap
    asks for an explicit guard, not just an accidental one).

Steps, in order, stop on first failure:

  1. VERIFY — same git/deploy gate as v11-v17.

  2. IDEA -> WIN (career-core.mjs, CareerDashboard.tsx, career.module.css)
     - promoteIdeaToWin(): carries idea.details into the win as
       sourceContext (roadmap 8.2's missing "Смысл -> Исходный контекст"
       row). Win/WinDraft interfaces gain `sourceContext: string`.
     - IdeaWorkspace: "Win!" now asks for confirmation first ("Превратить
       идею в win?", the exact roadmap 8.1 wording) via window.confirm —
       the same lightweight pattern already used for the win-delete
       confirmation, not a new UI mechanism. Only calls onPromote after
       the person confirms.
     - IdeaWorkspace: "Win!" is disabled once the idea's own status is
       already 'won' (explicit duplicate-conversion guard per roadmap
       8.4, on top of the kanban already making a won idea unreachable
       in practice).
     - WinModal: shows sourceContext as a small read-only reference block
       (not an editable field — the roadmap lists it as prefilled
       reference, not something the person retypes) when the win came
       from an idea.

  3. EDITABLE NOTES (career-core.mjs, CareerDashboard.tsx, career.module.css)
     - updateNote(state, noteId, rawText): re-derives title/body via the
       same deriveNoteTitle() used at creation time, so an edited note's
       title stays consistent with the "first four words" rule rather than
       drifting out of sync with a hand-edited title.
     - NoteOverlay: the note's raw text becomes an editable <textarea>
       (seeded from note.rawText) instead of read-only text, with an
       explicit "Сохранить" button (matches every other editable surface
       in the app — no silent autosave). "Это идея!" and "Улучшить" stay
       as they were.

  4. TESTS — tests/escada-v10.test.mjs gains coverage for:
     - promoteIdeaToWin carrying details into sourceContext
     - updateNote re-deriving title/body and preserving convertedIdeaId
     - updateNote returning the state unchanged if the note id doesn't
       exist (no crash, no silent data loss elsewhere)

Запуск (в Codespaces, из корня репозитория, после того как v11-v17 уже
применены и запушены в main):

    python3 escada_win_confirm_and_note_edit_v18.py
"""

import subprocess
import sys
import os
import re
import fnmatch
import urllib.request
import urllib.error

REPO_ROOT = os.getcwd()
PATCH_NAME = "escada_win_confirm_and_note_edit_v18"
COMMIT_MESSAGE = (
    "feat(escada): v18 Idea\u2192Win confirmation/prefill/guard (roadmap "
    "Phase 6) + editable notes\n\n"
    "- promoteIdeaToWin() carries idea.details into the win as "
    "sourceContext (\u00abСмысл\u00bb \u2192 \u00abИсходный контекст\u00bb, "
    "the one missing row from the roadmap 8.2 prefill table)\n"
    "- \u00abWin!\u00bb now asks \u00abПревратить идею в win?\u00bb before "
    "opening the win form, and is disabled once the idea is already won "
    "(explicit duplicate-conversion guard)\n"
    "- WinModal shows sourceContext as a read-only reference block when "
    "the win came from an idea\n"
    "- add updateNote(): edit a note's raw text from the \u00abСегодня\u00bb "
    "pin board, re-deriving title/body the same way creation does\n"
    "- NoteOverlay: note text is now an editable textarea with an "
    "explicit Save button, not read-only\n"
    "- extend tests/escada-v10.test.mjs: sourceContext prefill, "
    "updateNote re-derivation and missing-id safety"
)

DEPLOYED_VERSION_URL = "https://saypavnik-code.github.io/career/deploy-version.txt"

IGNORED_UNTRACKED_PATTERNS = [
    "escada_*_v*.py",
    "escada_*_patch_v*.py",
]

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def run(cmd, check=True, capture=True, cwd=REPO_ROOT):
    print(f"$ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd, text=True, capture_output=capture)
    if capture:
        if result.stdout:
            print(result.stdout.rstrip())
        if result.stderr:
            print(result.stderr.rstrip())
    if check and result.returncode != 0:
        print(f"\n[FAIL] Command failed with exit code {result.returncode}: {cmd}")
        sys.exit(1)
    return result


def fail(message):
    print(f"\n[FAIL] {message}")
    sys.exit(1)


def step(title):
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


def replace_or_fail(path, old, new, description):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    count = content.count(old)
    if count == 0:
        fail(
            f"Не найдена ожидаемая строка для правки ({description}) в {path}. "
            "Файл мог измениться с момента подготовки патча — проверьте, что "
            "v11-v17 уже применены и запушены (v18 строится на них), "
            "затем проверьте вручную."
        )
    if count > 1:
        fail(
            f"Строка для правки ({description}) в {path} встречается {count} раз "
            "вместо одного — правка неоднозначна, нужна ручная проверка."
        )
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  fixed: {description}")


def is_ignored_untracked(filename):
    return any(fnmatch.fnmatch(filename, pattern) for pattern in IGNORED_UNTRACKED_PATTERNS)


# ---------------------------------------------------------------------------
# step 1: verification
# ---------------------------------------------------------------------------


def verify_repository():
    step("STEP 1/4 — Верификация репозитория")

    if not os.path.isfile(os.path.join(REPO_ROOT, "package.json")):
        fail("package.json не найден. Запустите скрипт из корня репозитория.")

    run("git fetch origin")

    status_lines = run("git status --porcelain").stdout.splitlines()
    blocking_lines = []
    ignored_lines = []
    for line in status_lines:
        code = line[:2]
        path = line[3:].strip()
        if code == "??" and is_ignored_untracked(os.path.basename(path)):
            ignored_lines.append(line)
        else:
            blocking_lines.append(line)

    if ignored_lines:
        print("Игнорирую untracked файлы патч-скриптов:")
        for line in ignored_lines:
            print(f"  {line}")

    if blocking_lines:
        fail(
            "Рабочее дерево не чистое:\n" + "\n".join(blocking_lines) +
            "\n\nЗакоммитьте/отмените изменения перед запуском."
        )

    branch = run("git rev-parse --abbrev-ref HEAD").stdout.strip()
    if branch != "main":
        fail(f"Текущая ветка '{branch}', а не 'main'.")

    head_sha = run("git rev-parse HEAD").stdout.strip()
    origin_sha = run("git rev-parse origin/main").stdout.strip()
    print(f"\nHEAD:         {head_sha}")
    print(f"origin/main:  {origin_sha}")
    if head_sha != origin_sha:
        fail("HEAD не совпадает с origin/main. Синхронизируйтесь: git pull --ff-only origin main")

    print("\n[OK] main синхронизирован с origin/main, рабочее дерево чистое (не считая патч-скриптов).")

    print(f"\nПроверка деплоя: {DEPLOYED_VERSION_URL}")
    try:
        with urllib.request.urlopen(DEPLOYED_VERSION_URL, timeout=15) as response:
            deployed_sha = response.read().decode("utf-8").strip()
        print(f"deploy-version.txt: {deployed_sha}")
        if deployed_sha == origin_sha:
            print("[OK] Прод соответствует origin/main.")
        else:
            print("[WARN] deploy-version.txt отличается от origin/main — прод отстаёт. Не блокирует патч.")
    except urllib.error.URLError as exc:
        print(f"[WARN] Не удалось получить deploy-version.txt ({exc}). Продолжаю без этой проверки.")

    tsx_path = os.path.join(REPO_ROOT, "app", "career", "CareerDashboard.tsx")
    if os.path.isfile(tsx_path):
        with open(tsx_path, "r", encoding="utf-8") as f:
            tsx_content = f.read()
        if "ideaActionRow" not in tsx_content:
            fail(
                "Похоже, патч v15/v16 ещё не применён (не найден "
                "ideaActionRow в CareerDashboard.tsx). Примените v11-v17 "
                "перед v18."
            )
    else:
        fail(f"Не найден файл: {tsx_path}")


# ---------------------------------------------------------------------------
# step 2: idea -> win (confirmation, prefill, duplicate guard)
# ---------------------------------------------------------------------------


def build_idea_to_win():
    step("STEP 2/4 — Idea → Win: подтверждение, «Исходный контекст», защита от повтора")

    core_path = os.path.join(REPO_ROOT, "app", "career", "career-core.mjs")
    tsx_path = os.path.join(REPO_ROOT, "app", "career", "CareerDashboard.tsx")
    css_path = os.path.join(REPO_ROOT, "app", "career", "career.module.css")
    for p in (core_path, tsx_path, css_path):
        if not os.path.isfile(p):
            fail(f"Не найден файл: {p}")

    # --- career-core.mjs: promoteIdeaToWin carries idea.details forward -----
    replace_or_fail(
        core_path,
        "  return {\n"
        "    id: patch.id ?? createId('win'),\n"
        "    title: patch.title ?? idea.title,\n"
        "    impact: patch.impact ?? '',\n"
        "    evidence: patch.evidence ?? evidenceNotes.join('\\n'),\n",
        "  return {\n"
        "    id: patch.id ?? createId('win'),\n"
        "    title: patch.title ?? idea.title,\n"
        "    impact: patch.impact ?? '',\n"
        "    evidence: patch.evidence ?? evidenceNotes.join('\\n'),\n"
        "    sourceContext: patch.sourceContext ?? idea.details ?? '',\n",
        "career-core.mjs: promoteIdeaToWin carries idea.details -> win.sourceContext",
    )

    # --- CareerDashboard.tsx: Win/WinDraft interfaces gain sourceContext ----
    replace_or_fail(
        tsx_path,
        "interface Win {\n"
        "  id: string\n"
        "  title: string\n"
        "  impact: string\n"
        "  evidence: string\n",
        "interface Win {\n"
        "  id: string\n"
        "  title: string\n"
        "  impact: string\n"
        "  evidence: string\n"
        "  sourceContext: string\n",
        "Win interface: add sourceContext",
    )

    # --- emptyWin() needs the new field too (fresh, non-idea-sourced wins) --
    replace_or_fail(
        tsx_path,
        "function emptyWin(): WinDraft {\n"
        "  return {\n"
        "    sourceIdeaId: null,\n",
        "function emptyWin(): WinDraft {\n"
        "  return {\n"
        "    sourceIdeaId: null,\n"
        "    sourceContext: '',\n",
        "emptyWin(): initialize sourceContext",
    )

    # --- captureToWinDraft (legacy helper) also needs the field for type
    #     consistency, even though it's no longer reachable from the UI.
    replace_or_fail(
        core_path,
        "export function captureToWinDraft(capture) {\n"
        "  return { sourceIdeaId: null, title: capture?.text ?? '', impact: '', evidence: '', metrics: '', confirmedBy: '', date: todayIso(), competencyIds: [], behaviorRefs: [], levelSignal: 'specialist', workSummary: [], noteSummary: [], reportReady: true }\n"
        "}",
        "export function captureToWinDraft(capture) {\n"
        "  return { sourceIdeaId: null, sourceContext: '', title: capture?.text ?? '', impact: '', evidence: '', metrics: '', confirmedBy: '', date: todayIso(), competencyIds: [], behaviorRefs: [], levelSignal: 'specialist', workSummary: [], noteSummary: [], reportReady: true }\n"
        "}",
        "captureToWinDraft: initialize sourceContext (legacy helper, kept for type consistency)",
    )

    # --- startWinFromIdea: no change needed — it spreads `promoted`, which
    #     now already includes sourceContext from promoteIdeaToWin(). Confirm
    #     by wiring the confirmation dialog at the call site instead: the
    #     "Win!" button in IdeaWorkspace now confirms before calling onPromote.

    replace_or_fail(
        tsx_path,
        '        <button type="button" className={styles.primaryButton} disabled={!draft.title.trim()} onClick={() => onPromote(draft)}>Win!</button>',
        '        <button type="button" className={styles.primaryButton} disabled={!draft.title.trim() || draft.status === \'won\'} onClick={() => { if (window.confirm(\'Превратить идею в win?\')) onPromote(draft) }}>Win!</button>',
        "IdeaWorkspace: 'Win!' confirms first, disabled once the idea is already won",
    )

    # --- WinModal: read-only sourceContext reference block ------------------
    replace_or_fail(
        tsx_path,
        '<label className={styles.field}>Что произошло?<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>',
        '<label className={styles.field}>Что произошло?<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>'
        '{draft.sourceContext && <div className={styles.sourceContextRef}><span>Исходный контекст идеи</span><p>{draft.sourceContext}</p></div>}',
        "WinModal: show sourceContext as a read-only reference block",
    )

    print("\n[OK] Idea → Win: подтверждение, prefill «Исходный контекст», защита от повторной конвертации.")

    # --- CSS: sourceContextRef block -----------------------------------------
    source_context_css = '''

/* escada-idea-to-win-v18: read-only "Исходный контекст" reference on WinModal */
.sourceContextRef {
  border-radius: 14px;
  padding: 12px 15px;
  background: var(--soft);
}
.sourceContextRef span {
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 9px;
  font-weight: 800;
  color: var(--muted);
  margin-bottom: 4px;
}
.sourceContextRef p {
  margin: 0;
  color: var(--ink);
  font-size: 12px;
  line-height: 1.55;
}'''
    with open(css_path, "r", encoding="utf-8") as f:
        css_content = f.read()
    if ".sourceContextRef {" in css_content:
        fail("Похоже, .sourceContextRef уже определён в career.module.css — v18 могла быть уже применена.")
    with open(css_path, "a", encoding="utf-8") as f:
        f.write(source_context_css)
    print("  appended: .sourceContextRef CSS")


# ---------------------------------------------------------------------------
# step 3: editable notes
# ---------------------------------------------------------------------------


def build_editable_notes():
    step("STEP 3/4 — Редактирование заметок с экрана «Сегодня»")

    core_path = os.path.join(REPO_ROOT, "app", "career", "career-core.mjs")
    core_dts_path = os.path.join(REPO_ROOT, "app", "career", "career-core.d.mts")
    tsx_path = os.path.join(REPO_ROOT, "app", "career", "CareerDashboard.tsx")
    for p in (core_path, core_dts_path, tsx_path):
        if not os.path.isfile(p):
            fail(f"Не найден файл: {p}")

    # --- career-core.mjs: updateNote() ---------------------------------------
    replace_or_fail(
        core_path,
        "export function noteToIdea(note, currentLevel = 'specialist') {",
        "export function updateNote(state, noteId, rawText) {\n"
        "  const notes = Array.isArray(state?.notes) ? state.notes : []\n"
        "  const text = String(rawText ?? '').trim()\n"
        "  if (!text) return state\n"
        "  const existing = notes.find((item) => item.id === noteId)\n"
        "  if (!existing) return state\n"
        "  const { title, body } = deriveNoteTitle(text)\n"
        "  const updated = {\n"
        "    ...existing,\n"
        "    title: title || text.slice(0, 40),\n"
        "    body,\n"
        "    rawText: text,\n"
        "    updatedAt: new Date().toISOString(),\n"
        "  }\n"
        "  return {\n"
        "    ...state,\n"
        "    notes: notes.map((item) => item.id === noteId ? updated : item),\n"
        "  }\n"
        "}\n"
        "\n"
        "export function noteToIdea(note, currentLevel = 'specialist') {",
        "career-core.mjs: add updateNote() (re-derives title/body, no-op on missing id)",
    )

    replace_or_fail(
        core_dts_path,
        "export function createNote(rawText: string, now?: Date): Record<string, unknown> | null\n",
        "export function createNote(rawText: string, now?: Date): Record<string, unknown> | null\n"
        "export function updateNote(state: Record<string, unknown>, noteId: string, rawText: string): Record<string, unknown>\n",
        "career-core.d.mts: declare updateNote",
    )

    # --- CareerDashboard.tsx: import updateNote ------------------------------
    replace_or_fail(
        tsx_path,
        "  createNote,\n"
        "  deleteWin as deleteWinFromState,\n",
        "  createNote,\n"
        "  deleteWin as deleteWinFromState,\n"
        "  updateNote as updateNoteFromState,\n",
        "import updateNote as updateNoteFromState",
    )

    # --- editNote() handler, next to convertNoteToIdea -----------------------
    replace_or_fail(
        tsx_path,
        "  function convertNoteToIdea(note: Note) {",
        "  function editNote(noteId: string, rawText: string) {\n"
        "    updateState((current) => asState(updateNoteFromState(current as unknown as Record<string, unknown>, noteId, rawText)))\n"
        "    setNotice('Мысль обновлена')\n"
        "  }\n"
        "\n"
        "  function convertNoteToIdea(note: Note) {",
        "add editNote() handler",
    )

    # --- wire onEdit into <NoteOverlay /> ------------------------------------
    replace_or_fail(
        tsx_path,
        "{openNote && <NoteOverlay note={openNote} busy={aiBusy} error={aiError} onClose={() => setOpenNote(null)} onConvert={convertNoteToIdea} onAi={(note) => requestAi('idea_review', { title: note.title, details: note.body || note.rawText } as unknown as Record<string, unknown>, [])} />}",
        "{openNote && <NoteOverlay note={openNote} busy={aiBusy} error={aiError} onClose={() => setOpenNote(null)} onConvert={convertNoteToIdea} onEdit={editNote} onAi={(note) => requestAi('idea_review', { title: note.title, details: note.body || note.rawText } as unknown as Record<string, unknown>, [])} />}",
        "wire onEdit into <NoteOverlay />",
    )

    # --- NoteOverlay: full rewrite (editable textarea + Сохранить) ----------
    old_note_overlay = (
        "function NoteOverlay({ note, busy, error, onClose, onConvert, onAi }: {\n"
        "  note: Note\n"
        "  busy: string\n"
        "  error: string\n"
        "  onClose: () => void\n"
        "  onConvert: (note: Note) => void\n"
        "  onAi: (note: Note) => Promise<AiResponse>\n"
        "}) {\n"
        "  const [guidance, setGuidance] = useState<AiResponse | null>(null)\n"
        "  async function runAi() { setGuidance(await onAi(note)) }\n"
        "  return <Modal title={note.title} subtitle={formatDate(note.createdAt.slice(0, 10))} onClose={onClose}>\n"
        "    <div className={styles.modalBody}>\n"
        "      <p className={styles.noteFullText}>{note.body || note.rawText}</p>\n"
        "      {error && <p className={styles.aiError}>{error}</p>}\n"
        "      {guidance && <div className={styles.guidanceBanner}>\n"
        "        <strong>{guidance.headline}</strong>\n"
        "        {guidance.strengths.length > 0 && <p>{guidance.strengths.map((item) => item.text).join(' ')}</p>}\n"
        "        {guidance.nextStep && <p><strong>Следующий шаг.</strong> {guidance.nextStep}</p>}\n"
        "      </div>}\n"
        "      <div className={styles.modalActions}>\n"
        "        <button className={styles.primaryButton} type=\"button\" onClick={() => onConvert(note)}>Это идея!</button>\n"
        "        <button className={styles.aiMiniButton} type=\"button\" disabled={busy === 'idea_review'} onClick={() => void runAi()}>{busy === 'idea_review' ? 'Думаем…' : '✦ Улучшить'}</button>\n"
        "      </div>\n"
        "    </div>\n"
        "  </Modal>\n"
        "}"
    )
    new_note_overlay = '''function NoteOverlay({ note, busy, error, onClose, onConvert, onEdit, onAi }: {
  note: Note
  busy: string
  error: string
  onClose: () => void
  onConvert: (note: Note) => void
  onEdit: (noteId: string, rawText: string) => void
  onAi: (note: Note) => Promise<AiResponse>
}) {
  const [text, setText] = useState(note.rawText)
  const [guidance, setGuidance] = useState<AiResponse | null>(null)
  const dirty = text.trim() !== note.rawText.trim()
  async function runAi() { setGuidance(await onAi(note)) }
  function save() { if (text.trim()) onEdit(note.id, text) }
  return <Modal title={note.title} subtitle={formatDate(note.createdAt.slice(0, 10))} onClose={onClose}>
    <div className={styles.modalBody}>
      <textarea className={styles.largeTextarea} value={text} onChange={(event) => setText(event.target.value)} aria-label="Текст мысли" autoFocus />
      {error && <p className={styles.aiError}>{error}</p>}
      {guidance && <div className={styles.guidanceBanner}>
        <strong>{guidance.headline}</strong>
        {guidance.strengths.length > 0 && <p>{guidance.strengths.map((item) => item.text).join(' ')}</p>}
        {guidance.nextStep && <p><strong>Следующий шаг.</strong> {guidance.nextStep}</p>}
      </div>}
      <div className={styles.modalActions}>
        <button className={styles.secondaryButton} type="button" disabled={!dirty || !text.trim()} onClick={save}>Сохранить</button>
        <button className={styles.primaryButton} type="button" onClick={() => onConvert(note)}>Это идея!</button>
        <button className={styles.aiMiniButton} type="button" disabled={busy === 'idea_review'} onClick={() => void runAi()}>{busy === 'idea_review' ? 'Думаем…' : '✦ Улучшить'}</button>
      </div>
    </div>
  </Modal>
}'''
    replace_or_fail(tsx_path, old_note_overlay, new_note_overlay, "NoteOverlay: editable textarea + explicit Save button")

    print("\n[OK] Заметки редактируются прямо из экрана «Сегодня».")


# ---------------------------------------------------------------------------
# tests
# ---------------------------------------------------------------------------

TEST_IMPORT_OLD = (
    "import { deleteWin, deriveNoteTitle, migrateIdeaStatus, migrateState } from '../app/career/career-core.mjs'"
)
TEST_IMPORT_NEW = (
    "import { deleteWin, deriveNoteTitle, migrateIdeaStatus, migrateState, promoteIdeaToWin, updateNote } from '../app/career/career-core.mjs'"
)

TEST_ADDITIONS = '''

test('promoteIdeaToWin carries idea.details into win.sourceContext', () => {
  const idea = {
    id: 'idea-1',
    title: 'Обучить региональные команды',
    details: 'Хочу выстроить процесс обучения новых аналитиков в трёх регионах.',
    competencyIds: ['analytics'],
    behaviorRefs: [],
    levelSignal: 'senior',
    workItems: [],
    notes: [],
    evidenceNotes: [],
  }
  const win = promoteIdeaToWin(idea, {})
  assert.equal(win.sourceContext, idea.details)
  assert.equal(win.sourceIdeaId, 'idea-1')
})

test('promoteIdeaToWin respects an explicit sourceContext override in patch', () => {
  const idea = { id: 'idea-2', title: 'X', details: 'original', competencyIds: [], behaviorRefs: [], levelSignal: 'senior', workItems: [], notes: [], evidenceNotes: [] }
  const win = promoteIdeaToWin(idea, { sourceContext: 'overridden' })
  assert.equal(win.sourceContext, 'overridden')
})

test('updateNote re-derives title/body from edited raw text', () => {
  const state = {
    notes: [
      { id: 'note-1', title: 'Старый заголовок', body: 'старое тело', rawText: 'Старый заголовок старое тело', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', convertedIdeaId: null },
    ],
  }
  const updated = updateNote(state, 'note-1', 'Новый подход к PR-рассылкам для локальных медиа')
  const note = updated.notes.find((item) => item.id === 'note-1')
  assert.equal(note.title, 'Новый подход к PR-рассылкам')
  assert.equal(note.body, 'для локальных медиа')
  assert.equal(note.rawText, 'Новый подход к PR-рассылкам для локальных медиа')
})

test('updateNote preserves convertedIdeaId and is a safe no-op for an unknown note id', () => {
  const state = {
    notes: [
      { id: 'note-1', title: 'X', body: '', rawText: 'X', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', convertedIdeaId: 'idea-9' },
    ],
  }
  const updated = updateNote(state, 'note-1', 'X переработано полностью')
  assert.equal(updated.notes[0].convertedIdeaId, 'idea-9')

  const untouched = updateNote(state, 'does-not-exist', 'irrelevant')
  assert.deepEqual(untouched, state)

  const emptyText = updateNote(state, 'note-1', '   ')
  assert.deepEqual(emptyText, state)
})
'''


def extend_tests():
    step("STEP 4/4 — Расширение тестов")

    test_path = os.path.join(REPO_ROOT, "tests", "escada-v10.test.mjs")
    if not os.path.isfile(test_path):
        fail(f"Не найден файл: {test_path}")

    replace_or_fail(test_path, TEST_IMPORT_OLD, TEST_IMPORT_NEW, "tests: import promoteIdeaToWin, updateNote")

    with open(test_path, "r", encoding="utf-8") as f:
        content = f.read()
    if "carries idea.details into win.sourceContext" in content:
        fail("Тесты для v18 уже похоже применены — повторный запуск не ожидается.")
    with open(test_path, "a", encoding="utf-8") as f:
        f.write(TEST_ADDITIONS)
    print("  appended: promoteIdeaToWin sourceContext (2 tests), updateNote (2 tests)")


# ---------------------------------------------------------------------------
# verification gate + commit
# ---------------------------------------------------------------------------


def run_verification_gate():
    step("Verification gate — npm ci / test / build")
    run("npm ci")
    run("npm run test:escada")
    run("npm run build")
    print("\n[OK] Тесты и билд прошли успешно.")


def git_commit_and_push():
    step("Git commit + push (main)")
    run("git add -A")

    staged = run("git diff --cached --name-only").stdout.strip()
    if not staged:
        fail("Нет застейдженных изменений — нечего коммитить.")

    print("Файлы в коммите:")
    for line in staged.splitlines():
        print(f"  {line}")

    forbidden = re.compile(r"^(node_modules|\.next|out|dist|build|coverage)(/|$)")
    bad = [line for line in staged.splitlines() if forbidden.match(line)]
    if bad:
        fail(f"В индекс попали запрещённые файлы: {bad}. Прерываю до коммита.")

    commit_message_file = os.path.join(REPO_ROOT, ".git", "COMMIT_EDITMSG_escada_v18")
    with open(commit_message_file, "w", encoding="utf-8") as f:
        f.write(COMMIT_MESSAGE)
    run(f'git commit -F "{commit_message_file}"')
    os.remove(commit_message_file)

    run("git push origin main")

    new_sha = run("git rev-parse HEAD").stdout.strip()
    print(f"\n[OK] Запушено в main. Новый коммит: {new_sha}")
    print(
        "\nПроверьте деплой через несколько минут:\n"
        f"  curl -fsSL {DEPLOYED_VERSION_URL}\n"
        "  git rev-parse origin/main\n"
        "Значения должны совпасть."
    )


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main():
    print(f"Patch: {PATCH_NAME}")
    print(f"Repo root: {REPO_ROOT}")

    verify_repository()
    build_idea_to_win()
    build_editable_notes()
    extend_tests()
    run_verification_gate()
    git_commit_and_push()

    print("\nГотово. Патч v18 (Phase 6 roadmap + редактирование заметок) применён, протестирован, собран и запушен в main.")


if __name__ == "__main__":
    main()
