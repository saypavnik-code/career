#!/usr/bin/env python3
"""
escada_ui_feedback_v20.py

Эскада — patch v20.

Scope: four UI fixes from direct product feedback, outside the AI-First
roadmap (which finished at v19). Each was traced to its exact cause in the
live code before writing anything — not guessed at from the symptom alone.

  1. NOTE EDITOR LOOKS UNSTYLED ("некрасивое и квадратное")
     Cause, confirmed by reading career.module.css: there is no global
     input/textarea styling anywhere in the stylesheet — every styled text
     field in the app relies on a specific parent selector (.field textarea,
     .quickThought textarea, etc). NoteOverlay's textarea used
     className={styles.largeTextarea} directly, which only sets min-height
     — no border, radius, padding, or background were ever defined for it,
     so it rendered as a bare browser-default square box. Fixed with a
     dedicated .noteEditor rule carrying the same visual language as the
     rest of the app (border, radius, padding, focus ring), and the overlay
     was reshaped a little further: the date now sits as a small caption
     instead of the modal subtitle, and the Save button moved to sit right
     under the textarea instead of being buried in the same row as
     "Это идея!" and "Улучшить".

  2. NOTE -> IDEA OPENS THE FULL WORKSPACE ("огромное окно")
     Cause, confirmed by reading the render tree: clicking "Это идея!" in
     NoteOverlay called convertNoteToIdea(), which set ideaDraft and
     rendered <IdeaWorkspace> — a near-fullscreen modal
     (width: min(1320px, 100%); height: min(94vh, 980px)) built in v15 for
     deliberate, full editing from the Идеи kanban. Using the same giant
     surface for "I just turned a quick note into an idea" is jarring.
     Fixed by adding a new, genuinely small NewIdeaModal (reuses the same
     compact <Modal> component WinModal/NoteOverlay already use — width:
     min(760px, 100%)) with just Название and Смысл, prefilled from the
     note, and a bottom action row with Win! on its own line below Save/
     Cancel, exactly as requested. The full IdeaWorkspace is unchanged and
     still what opens from the Идеи kanban for deliberate editing.

  3. REPORTS ARE MARKDOWN, NOT PLAIN TEXT
     Cause, confirmed by reading local-guidance.mjs: every report-drafting
     function (buildWeeklyDraft/buildMonthlyDraft/buildPerformanceDraft/
     buildPromotionDraft) built literal Markdown syntax (#, ##, **bold**,
     "- " bullets) into the string shown in a plain <textarea> — so the
     symbols appeared as literal characters, never rendered. Rewritten to a
     genuine plain-text convention: uppercase section headers (no #), "•"
     bullets (not Markdown-significant), "Label: value" instead of
     **Label.** for callouts. ai-contract.mjs's reportDraftInstruction()
     (used for the external-AI path) is updated to ask for the same plain-
     text convention instead of "Markdown draft", so both paths match. The
     draftMarkdown field name itself is left alone — renaming it would
     ripple through the whole AI JSON contract for no behavioral gain; only
     its *contents* change.

  4. PROFILE SCREEN: REMOVE "ТЕКУЩАЯ ДОЛЖНОСТЬ", KEEP ONLY LEVEL
     Confirmed profile.role is displayed in exactly two other places
     (profile chip subtitle, GrowthView's heading) and referenced in the
     external-AI prompt as optional context (already null-safe). The field
     stays in the Profile data type (existing stored values aren't
     destroyed, and removing a TypeScript field this deep would touch
     migration code for no reason) but the input is removed from both
     ProfileModal and Onboarding (a half-removed field — settable once at
     onboarding, never editable or clearable after — would be worse than
     removing it everywhere), and the two display sites now show the level
     label instead of the now-always-empty role.

Steps, in order, stop on first failure:

  1. VERIFY — same git/deploy gate as v11-v19.
  2. NOTE EDITOR — redesign NoteOverlay's editing surface.
  3. COMPACT NOTE-TO-IDEA MODAL — new NewIdeaModal, wired to replace
     IdeaWorkspace specifically for the note-conversion flow.
  4. PLAIN-TEXT REPORTS — rewrite all four report-drafting functions in
     local-guidance.mjs and the matching instruction in ai-contract.mjs.
  5. PROFILE — remove "Текущая должность" from ProfileModal and
     Onboarding; update the two display sites to show the level instead.
  6. TESTS — update the report-format tests to assert no Markdown syntax
     leaks into a generated draft (in addition to the existing content
     assertions, which still hold unchanged). Two pre-existing v12 tests
     that checked for exact-case Markdown heading text ("Сигналы по
     компетенциям", "Сильнейшие сигналы") are switched to case-insensitive
     matching, since heading() now uppercases section titles as part of the
     plain-text convention — an intentional visual change, not a content
     regression.

Запуск (в Codespaces, из корня репозитория, после того как v11-v19 уже
применены и запушены в main):

    python3 escada_ui_feedback_v20.py
"""

import subprocess
import sys
import os
import re
import fnmatch
import urllib.request
import urllib.error

REPO_ROOT = os.getcwd()
PATCH_NAME = "escada_ui_feedback_v20"
COMMIT_MESSAGE = (
    "fix(escada): v20 UI feedback \u2014 note editor, compact note\u2192idea "
    "modal, plain-text reports, profile\n\n"
    "- NoteOverlay: dedicated .noteEditor styling (was an unstyled bare "
    "textarea \u2014 no global input/textarea CSS exists in this app, every "
    "field relies on a parent selector this one never had)\n"
    "- new compact NewIdeaModal for the \u00abЭто идея!\u00bb flow instead of "
    "the full-size IdeaWorkspace; Win! sits on its own row at the bottom\n"
    "- local-guidance.mjs report drafts rewritten to genuine plain text "
    "(uppercase headers, \u2022 bullets, Label: value) instead of literal "
    "Markdown syntax; ai-contract.mjs instruction updated to match for the "
    "external-AI path\n"
    "- ProfileModal/Onboarding: remove \u00abТекущая должность\u00bb, keep "
    "only \u00abУровень по шкале\u00bb; profile chip and GrowthView heading "
    "show the level instead of the now-unused role\n"
    "- extend tests: generated drafts must not contain Markdown syntax"
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
            "v11-v19 уже применены и запушены (v20 строится на них), "
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
    step("STEP 1/6 — Верификация репозитория")

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
        if "sourceContext" not in tsx_content:
            fail(
                "Похоже, патч v18 ещё не применён (не найден sourceContext в "
                "CareerDashboard.tsx). Примените v11-v19 перед v20."
            )
    else:
        fail(f"Не найден файл: {tsx_path}")


# ---------------------------------------------------------------------------
# step 2: note editor redesign
# ---------------------------------------------------------------------------


def redesign_note_editor():
    step("STEP 2/6 — Редизайн редактора заметки")

    tsx_path = os.path.join(REPO_ROOT, "app", "career", "CareerDashboard.tsx")
    css_path = os.path.join(REPO_ROOT, "app", "career", "career.module.css")
    for p in (tsx_path, css_path):
        if not os.path.isfile(p):
            fail(f"Не найден файл: {p}")

    old_note_overlay = (
        "function NoteOverlay({ note, busy, error, onClose, onConvert, onEdit, onAi }: {\n"
        "  note: Note\n"
        "  busy: string\n"
        "  error: string\n"
        "  onClose: () => void\n"
        "  onConvert: (note: Note) => void\n"
        "  onEdit: (noteId: string, rawText: string) => void\n"
        "  onAi: (note: Note) => Promise<AiResponse>\n"
        "}) {\n"
        "  const [text, setText] = useState(note.rawText)\n"
        "  const [guidance, setGuidance] = useState<AiResponse | null>(null)\n"
        "  const dirty = text.trim() !== note.rawText.trim()\n"
        "  async function runAi() { setGuidance(await onAi(note)) }\n"
        "  function save() { if (text.trim()) onEdit(note.id, text) }\n"
        "  return <Modal title={note.title} subtitle={formatDate(note.createdAt.slice(0, 10))} onClose={onClose}>\n"
        "    <div className={styles.modalBody}>\n"
        "      <textarea className={styles.largeTextarea} value={text} onChange={(event) => setText(event.target.value)} aria-label=\"Текст мысли\" autoFocus />\n"
        "      {error && <p className={styles.aiError}>{error}</p>}\n"
        "      {guidance && <div className={styles.guidanceBanner}>\n"
        "        <strong>{guidance.headline}</strong>\n"
        "        {guidance.strengths.length > 0 && <p>{guidance.strengths.map((item) => item.text).join(' ')}</p>}\n"
        "        {guidance.nextStep && <p><strong>Следующий шаг.</strong> {guidance.nextStep}</p>}\n"
        "      </div>}\n"
        "      <div className={styles.modalActions}>\n"
        "        <button className={styles.secondaryButton} type=\"button\" disabled={!dirty || !text.trim()} onClick={save}>Сохранить</button>\n"
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
  return <Modal title={note.title} subtitle="" onClose={onClose}>
    <div className={styles.noteEditorWrap}>
      <span className={styles.noteEditorDate}>{formatDate(note.createdAt.slice(0, 10))}</span>
      <textarea className={styles.noteEditor} value={text} onChange={(event) => setText(event.target.value)} aria-label="Текст мысли" autoFocus />
      <div className={styles.noteEditorSaveRow}>
        <button className={styles.secondaryButton} type="button" disabled={!dirty || !text.trim()} onClick={save}>Сохранить</button>
      </div>
      {error && <p className={styles.aiError}>{error}</p>}
      {guidance && <div className={styles.guidanceBanner}>
        <strong>{guidance.headline}</strong>
        {guidance.strengths.length > 0 && <p>{guidance.strengths.map((item) => item.text).join(' ')}</p>}
        {guidance.nextStep && <p><strong>Следующий шаг.</strong> {guidance.nextStep}</p>}
      </div>}
      <div className={styles.modalActions}>
        <button className={styles.primaryButton} type="button" onClick={() => onConvert(note)}>Это идея!</button>
        <button className={styles.aiMiniButton} type="button" disabled={busy === 'idea_review'} onClick={() => void runAi()}>{busy === 'idea_review' ? 'Думаем…' : '✦ Улучшить'}</button>
      </div>
    </div>
  </Modal>
}'''
    replace_or_fail(tsx_path, old_note_overlay, new_note_overlay, "NoteOverlay: redesigned editor surface")

    old_note_full_text_css = (
        ".noteFullText {\n"
        "  white-space: pre-wrap;\n"
        "  line-height: 1.6;\n"
        "  color: var(--ink);\n"
        "}"
    )
    new_note_editor_css = '''.noteEditorWrap { display: grid; gap: 12px; }
.noteEditorDate {
  color: var(--muted);
  font-size: 11px;
  font-weight: 750;
}
.noteEditor {
  width: 100%;
  min-height: 220px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--soft);
  color: var(--ink);
  padding: 18px 20px;
  font: inherit;
  line-height: 1.6;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.6);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.noteEditor:focus {
  border-color: var(--purple);
  background: white;
  box-shadow: 0 0 0 3px rgba(110,92,246,0.1);
}
.noteEditorSaveRow { display: flex; justify-content: flex-end; }'''
    replace_or_fail(css_path, old_note_full_text_css, new_note_editor_css, "career.module.css: replace dead .noteFullText with .noteEditor styling")

    print("\n[OK] Редактор заметки переработан.")


# ---------------------------------------------------------------------------
# step 3: compact note-to-idea modal
# ---------------------------------------------------------------------------


def build_compact_note_to_idea_modal():
    step("STEP 3/6 — Компактное окно «Это идея!» вместо полного рабочего пространства")

    tsx_path = os.path.join(REPO_ROOT, "app", "career", "CareerDashboard.tsx")
    css_path = os.path.join(REPO_ROOT, "app", "career", "career.module.css")
    for p in (tsx_path, css_path):
        if not os.path.isfile(p):
            fail(f"Не найден файл: {p}")

    # --- new state: newIdeaFromNote, separate from ideaDraft -----------------
    replace_or_fail(
        tsx_path,
        "  const [openNote, setOpenNote] = useState<Note | null>(null)\n"
        "  const [ideaDraft, setIdeaDraft] = useState<Idea | null>(null)\n",
        "  const [openNote, setOpenNote] = useState<Note | null>(null)\n"
        "  const [ideaDraft, setIdeaDraft] = useState<Idea | null>(null)\n"
        "  const [newIdeaFromNote, setNewIdeaFromNote] = useState<Idea | null>(null)\n",
        "add newIdeaFromNote state (compact modal, separate from the full IdeaWorkspace draft)",
    )

    # --- convertNoteToIdea: open the compact modal, not the full workspace --
    replace_or_fail(
        tsx_path,
        "    setOpenNote(null)\n"
        "    setIdeaDraft(result.idea)\n"
        "  }",
        "    setOpenNote(null)\n"
        "    setNewIdeaFromNote(result.idea)\n"
        "  }",
        "convertNoteToIdea(): open the compact NewIdeaModal instead of the full IdeaWorkspace",
    )

    # --- render tree: mount <NewIdeaModal /> ----------------------------------
    replace_or_fail(
        tsx_path,
        "{ideaDraft && <IdeaWorkspace draft={ideaDraft} profile={state.profile} busy={aiBusy} error={aiError} onClose={() => setIdeaDraft(null)} onSave={saveIdea} onPromote={startWinFromIdea} onAi={(idea) => requestAi('idea_review', idea as unknown as Record<string, unknown>, idea.competencyIds)} />}",
        "{ideaDraft && <IdeaWorkspace draft={ideaDraft} profile={state.profile} busy={aiBusy} error={aiError} onClose={() => setIdeaDraft(null)} onSave={saveIdea} onPromote={startWinFromIdea} onAi={(idea) => requestAi('idea_review', idea as unknown as Record<string, unknown>, idea.competencyIds)} />}\n"
        "      {newIdeaFromNote && <NewIdeaModal idea={newIdeaFromNote} onClose={() => setNewIdeaFromNote(null)} onSave={(idea) => { saveIdea(idea, true); setNewIdeaFromNote(null) }} onPromote={(idea) => { setNewIdeaFromNote(null); startWinFromIdea(idea) }} />}",
        "mount <NewIdeaModal /> alongside the other modals",
    )

    # --- new component, placed right before IdeaWorkspace --------------------
    replace_or_fail(
        tsx_path,
        "function IdeaWorkspace({ draft: initial, profile, busy, error, onClose, onSave, onPromote, onAi }:",
        '''function NewIdeaModal({ idea, onClose, onSave, onPromote }: {
  idea: Idea
  onClose: () => void
  onSave: (idea: Idea) => void
  onPromote: (idea: Idea) => void
}) {
  const [draft, setDraft] = useState(idea)
  return <Modal title="Новая идея" subtitle="Название и смысл — остальное можно добавить позже, открыв идею из «Идеи»." onClose={onClose}>
    <form className={styles.modalForm} onSubmit={(event) => { event.preventDefault(); if (draft.title.trim()) onSave(draft) }}>
      <label className={styles.field}>Название идеи<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
      <label className={styles.field}>Смысл<textarea value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="В чём идея и почему она может быть полезна?" /></label>
      <div className={styles.modalActions}>
        <button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button>
        <button className={styles.primaryButton} type="submit">Сохранить идею</button>
      </div>
      <div className={styles.newIdeaWinRow}>
        <button type="button" className={styles.primaryButton} disabled={!draft.title.trim()} onClick={() => { if (window.confirm('Превратить идею в win?')) onPromote(draft) }}>Win!</button>
      </div>
    </form>
  </Modal>
}

function IdeaWorkspace({ draft: initial, profile, busy, error, onClose, onSave, onPromote, onAi }:''',
        "add NewIdeaModal component (compact, Win! on its own row at the bottom)",
    )

    print("\n[OK] «Это идея!» теперь открывает компактное окно, а не полноразмерное рабочее пространство.")

    # --- CSS: bottom Win! row, full width, clearly separated -----------------
    new_idea_win_row_css = '''

/* escada-ui-feedback-v20: compact note -> idea modal, Win! on its own row at the bottom */
.newIdeaWinRow {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  display: flex;
}
.newIdeaWinRow .primaryButton { width: 100%; }'''
    with open(css_path, "r", encoding="utf-8") as f:
        css_content = f.read()
    if ".newIdeaWinRow {" in css_content:
        fail("Похоже, .newIdeaWinRow уже определён в career.module.css — v20 могла быть уже применена.")
    with open(css_path, "a", encoding="utf-8") as f:
        f.write(new_idea_win_row_css)
    print("  appended: .newIdeaWinRow CSS")


# ---------------------------------------------------------------------------
# step 4: plain-text reports
# ---------------------------------------------------------------------------


def convert_reports_to_plain_text():
    step("STEP 4/6 — Отчёты: обычный текст вместо Markdown")

    guidance_path = os.path.join(REPO_ROOT, "app", "career", "local-guidance.mjs")
    contract_path = os.path.join(REPO_ROOT, "app", "career", "ai-contract.mjs")
    for p in (guidance_path, contract_path):
        if not os.path.isfile(p):
            fail(f"Не найден файл: {p}")

    old_helpers = '''function competencySignalLines(wins, ideas) {
  const counts = new Map()
  for (const item of [...wins, ...ideas]) {
    for (const id of asArray(item?.competencyIds)) {
      const title = asText(item?.competencyTitle) || id
      const entry = counts.get(id) ?? { title, count: 0 }
      entry.count += 1
      counts.set(id, entry)
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .map((entry) => `- **${entry.title}.** ${entry.count} ${entry.count === 1 ? 'подтверждённая запись' : 'подтверждённых записи'} за период`)
}

function winBlock(win, { withWork = true } = {}) {
  const title = asText(win?.title) || 'Результат'
  const lines = ['', `### ${title}`]
  if (asText(win?.impact)) lines.push('', `**Почему это важно.** ${asText(win.impact)}`)
  if (asText(win?.evidence)) lines.push('', `**Подтверждение.** ${asText(win.evidence)}`)
  if (asText(win?.metrics)) lines.push('', `**Изменение в цифрах.** ${asText(win.metrics)}`)
  if (asText(win?.confirmedBy)) lines.push('', `**Кто подтвердил.** ${asText(win.confirmedBy)}`)
  if (withWork) {
    const work = asArray(win?.workSummary).map(asText).filter(Boolean)
    if (work.length) lines.push('', '**Что было сделано.**', ...work.map((item) => `- ${item}`))
  }
  return lines
}'''
    new_helpers = '''function heading(text) {
  return text.toUpperCase()
}

function competencySignalLines(wins, ideas) {
  const counts = new Map()
  for (const item of [...wins, ...ideas]) {
    for (const id of asArray(item?.competencyIds)) {
      const title = asText(item?.competencyTitle) || id
      const entry = counts.get(id) ?? { title, count: 0 }
      entry.count += 1
      counts.set(id, entry)
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .map((entry) => `• ${entry.title}: ${entry.count} ${entry.count === 1 ? 'подтверждённая запись' : 'подтверждённых записи'} за период`)
}

function winBlock(win, { withWork = true } = {}) {
  const title = asText(win?.title) || 'Результат'
  const lines = ['', title]
  if (asText(win?.impact)) lines.push('', `Почему это важно: ${asText(win.impact)}`)
  if (asText(win?.evidence)) lines.push('', `Подтверждение: ${asText(win.evidence)}`)
  if (asText(win?.metrics)) lines.push('', `Изменение в цифрах: ${asText(win.metrics)}`)
  if (asText(win?.confirmedBy)) lines.push('', `Кто подтвердил: ${asText(win.confirmedBy)}`)
  if (withWork) {
    const work = asArray(win?.workSummary).map(asText).filter(Boolean)
    if (work.length) lines.push('', 'Что было сделано:', ...work.map((item) => `• ${item}`))
  }
  return lines
}'''
    replace_or_fail(guidance_path, old_helpers, new_helpers, "local-guidance.mjs: plain-text competencySignalLines/winBlock + heading() helper")

    old_weekly = '''function buildWeeklyDraft(reportType, period, wins, ideas) {
  const lines = [`# ${reportType}`]
  if (period) lines.push('', `Период: ${period}`)
  lines.push('', '## Коротко за неделю')
  if (!wins.length) {
    lines.push('', 'Выберите wins этой недели, которые стоит зафиксировать.')
  } else {
    for (const win of wins) {
      const title = asText(win?.title) || 'Результат'
      const impact = asText(win?.impact)
      lines.push(`- **${title}**${impact ? ` — ${impact}` : ''}`)
    }
  }
  if (ideas.length) {
    lines.push('', '## В работе')
    for (const idea of ideas) {
      const title = asText(idea?.title) || 'Идея'
      const nextStep = asText(idea?.nextStep)
      lines.push(`- **${title}**${nextStep ? ` — далее: ${nextStep}` : ''}`)
    }
  }
  lines.push('', '## На следующую неделю', '', 'Добавьте один конкретный фокус.')
  return lines.join('\\n')
}'''
    new_weekly = '''function buildWeeklyDraft(reportType, period, wins, ideas) {
  const lines = [reportType]
  if (period) lines.push('', `Период: ${period}`)
  lines.push('', heading('Коротко за неделю'))
  if (!wins.length) {
    lines.push('', 'Выберите wins этой недели, которые стоит зафиксировать.')
  } else {
    for (const win of wins) {
      const title = asText(win?.title) || 'Результат'
      const impact = asText(win?.impact)
      lines.push(`• ${title}${impact ? ` — ${impact}` : ''}`)
    }
  }
  if (ideas.length) {
    lines.push('', heading('В работе'))
    for (const idea of ideas) {
      const title = asText(idea?.title) || 'Идея'
      const nextStep = asText(idea?.nextStep)
      lines.push(`• ${title}${nextStep ? ` — далее: ${nextStep}` : ''}`)
    }
  }
  lines.push('', heading('На следующую неделю'), '', 'Добавьте один конкретный фокус.')
  return lines.join('\\n')
}'''
    replace_or_fail(guidance_path, old_weekly, new_weekly, "local-guidance.mjs: buildWeeklyDraft -> plain text")

    old_monthly = '''function buildMonthlyDraft(reportType, period, wins, ideas, criteria) {
  const lines = [`# ${reportType}`]
  if (period) lines.push('', `Период: ${period}`)
  lines.push('', '## Главное за период')
  if (!wins.length) {
    lines.push('', 'Выберите wins, которые должны войти в отчёт.')
  } else {
    for (const win of wins) lines.push(...winBlock(win))
  }
  if (ideas.length) {
    lines.push('', '## Инициативы в работе')
    for (const idea of ideas) {
      const title = asText(idea?.title) || 'Идея'
      const nextStep = asText(idea?.nextStep)
      lines.push(`- **${title}**${nextStep ? ` — следующий шаг: ${nextStep}` : ''}`)
    }
  }
  if (criteria.length) {
    lines.push('', '## Сигналы профессионального роста для проверки')
    for (const criterion of criteria.slice(0, 3)) lines.push(`- **${criterion.competencyTitle}.** ${criterion.text}`)
  }
  lines.push('', '## Следующий фокус', '', 'Добавьте один конкретный следующий шаг после обсуждения отчёта.')
  return lines.join('\\n')
}'''
    new_monthly = '''function buildMonthlyDraft(reportType, period, wins, ideas, criteria) {
  const lines = [reportType]
  if (period) lines.push('', `Период: ${period}`)
  lines.push('', heading('Главное за период'))
  if (!wins.length) {
    lines.push('', 'Выберите wins, которые должны войти в отчёт.')
  } else {
    for (const win of wins) lines.push(...winBlock(win))
  }
  if (ideas.length) {
    lines.push('', heading('Инициативы в работе'))
    for (const idea of ideas) {
      const title = asText(idea?.title) || 'Идея'
      const nextStep = asText(idea?.nextStep)
      lines.push(`• ${title}${nextStep ? ` — следующий шаг: ${nextStep}` : ''}`)
    }
  }
  if (criteria.length) {
    lines.push('', heading('Сигналы профессионального роста для проверки'))
    for (const criterion of criteria.slice(0, 3)) lines.push(`• ${criterion.competencyTitle}: ${criterion.text}`)
  }
  lines.push('', heading('Следующий фокус'), '', 'Добавьте один конкретный следующий шаг после обсуждения отчёта.')
  return lines.join('\\n')
}'''
    replace_or_fail(guidance_path, old_monthly, new_monthly, "local-guidance.mjs: buildMonthlyDraft -> plain text")

    old_performance = '''function buildPerformanceDraft(reportType, period, wins, ideas, criteria) {
  const lines = [`# ${reportType}`]
  if (period) lines.push('', `Период: ${period}`)
  lines.push(
    '',
    '## Резюме периода',
    '',
    `Зафиксировано ${wins.length} ${wins.length === 1 ? 'подтверждённый результат' : 'подтверждённых результата(ов)'} и ${ideas.length} ${ideas.length === 1 ? 'инициатива' : 'инициативы(в) в работе'}.`,
  )
  lines.push('', '## Результаты за период')
  if (!wins.length) {
    lines.push('', 'Выберите wins, которые должны войти в отчёт.')
  } else {
    for (const win of wins) lines.push(...winBlock(win))
  }
  if (ideas.length) {
    lines.push('', '## Инициативы в работе')
    for (const idea of ideas) {
      const title = asText(idea?.title) || 'Идея'
      const nextStep = asText(idea?.nextStep)
      lines.push(`- **${title}**${nextStep ? ` — следующий шаг: ${nextStep}` : ''}`)
    }
  }
  const signals = competencySignalLines(wins, ideas)
  lines.push('', '## Сигналы по компетенциям (только из ваших записей)')
  lines.push(...(signals.length ? signals : ['- Недостаточно данных: свяжите wins и идеи с компетенциями, когда связь очевидна.']))
  if (criteria.length) {
    lines.push('', '## Ожидания шкалы для проверки')
    for (const criterion of criteria.slice(0, 4)) lines.push(`- **${criterion.competencyTitle} · ${levelLabels[criterion.level]}.** ${criterion.text}`)
  }
  lines.push('', '## Следующий фокус', '', 'Добавьте один конкретный следующий шаг после обсуждения отчёта.')
  return lines.join('\\n')
}'''
    new_performance = '''function buildPerformanceDraft(reportType, period, wins, ideas, criteria) {
  const lines = [reportType]
  if (period) lines.push('', `Период: ${period}`)
  lines.push(
    '',
    heading('Резюме периода'),
    '',
    `Зафиксировано ${wins.length} ${wins.length === 1 ? 'подтверждённый результат' : 'подтверждённых результата(ов)'} и ${ideas.length} ${ideas.length === 1 ? 'инициатива' : 'инициативы(в) в работе'}.`,
  )
  lines.push('', heading('Результаты за период'))
  if (!wins.length) {
    lines.push('', 'Выберите wins, которые должны войти в отчёт.')
  } else {
    for (const win of wins) lines.push(...winBlock(win))
  }
  if (ideas.length) {
    lines.push('', heading('Инициативы в работе'))
    for (const idea of ideas) {
      const title = asText(idea?.title) || 'Идея'
      const nextStep = asText(idea?.nextStep)
      lines.push(`• ${title}${nextStep ? ` — следующий шаг: ${nextStep}` : ''}`)
    }
  }
  const signals = competencySignalLines(wins, ideas)
  lines.push('', heading('Сигналы по компетенциям (только из ваших записей)'))
  lines.push(...(signals.length ? signals : ['• Недостаточно данных: свяжите wins и идеи с компетенциями, когда связь очевидна.']))
  if (criteria.length) {
    lines.push('', heading('Ожидания шкалы для проверки'))
    for (const criterion of criteria.slice(0, 4)) lines.push(`• ${criterion.competencyTitle} · ${levelLabels[criterion.level]}: ${criterion.text}`)
  }
  lines.push('', heading('Следующий фокус'), '', 'Добавьте один конкретный следующий шаг после обсуждения отчёта.')
  return lines.join('\\n')
}'''
    replace_or_fail(guidance_path, old_performance, new_performance, "local-guidance.mjs: buildPerformanceDraft -> plain text")

    old_promotion = '''function buildPromotionDraft(reportType, period, wins, ideas, criteria, targetLabel) {
  const lines = [`# ${reportType}`]
  if (period) lines.push('', `Период: ${period}`)
  lines.push(
    '',
    '## Обоснование',
    '',
    `Материалы ниже собраны только из записей сотрудника и показывают сигналы уровня «${targetLabel}». Формулировки не содержат выводов, не подтверждённых записями — при необходимости усильте их реальными цифрами и подтверждениями до отправки.`,
  )
  const signals = competencySignalLines(wins, ideas)
  lines.push('', '## Сильнейшие сигналы по компетенциям')
  lines.push(...(signals.length ? signals.slice(0, 5) : ['- Недостаточно данных: свяжите ключевые wins с компетенциями перед отправкой.']))
  lines.push('', '## Ключевые результаты')
  if (!wins.length) {
    lines.push('', 'Выберите wins, которые лучше всего показывают готовность к следующему уровню.')
  } else {
    for (const win of wins) lines.push(...winBlock(win))
  }
  if (ideas.length) {
    lines.push('', '## Инициативы, показывающие масштаб')
    for (const idea of ideas) {
      const title = asText(idea?.title) || 'Идея'
      const nextStep = asText(idea?.nextStep)
      lines.push(`- **${title}**${nextStep ? ` — следующий шаг: ${nextStep}` : ''}`)
    }
  }
  if (criteria.length) {
    lines.push('', `## Соответствие ожиданиям уровня «${targetLabel}»`)
    for (const criterion of criteria.slice(0, 5)) lines.push(`- **${criterion.competencyTitle}.** ${criterion.text}`)
  }
  lines.push(
    '',
    '## Не забудьте перед отправкой',
    '',
    '- Проверить, что все цифры и метрики подтверждены и актуальны.',
    '- Указать реальных людей, подтвердивших результаты, если это уместно.',
    '- Убрать любой тезис, который нельзя обосновать записью в Эскаде.',
  )
  return lines.join('\\n')
}'''
    new_promotion = '''function buildPromotionDraft(reportType, period, wins, ideas, criteria, targetLabel) {
  const lines = [reportType]
  if (period) lines.push('', `Период: ${period}`)
  lines.push(
    '',
    heading('Обоснование'),
    '',
    `Материалы ниже собраны только из записей сотрудника и показывают сигналы уровня «${targetLabel}». Формулировки не содержат выводов, не подтверждённых записями — при необходимости усильте их реальными цифрами и подтверждениями до отправки.`,
  )
  const signals = competencySignalLines(wins, ideas)
  lines.push('', heading('Сильнейшие сигналы по компетенциям'))
  lines.push(...(signals.length ? signals.slice(0, 5) : ['• Недостаточно данных: свяжите ключевые wins с компетенциями перед отправкой.']))
  lines.push('', heading('Ключевые результаты'))
  if (!wins.length) {
    lines.push('', 'Выберите wins, которые лучше всего показывают готовность к следующему уровню.')
  } else {
    for (const win of wins) lines.push(...winBlock(win))
  }
  if (ideas.length) {
    lines.push('', heading('Инициативы, показывающие масштаб'))
    for (const idea of ideas) {
      const title = asText(idea?.title) || 'Идея'
      const nextStep = asText(idea?.nextStep)
      lines.push(`• ${title}${nextStep ? ` — следующий шаг: ${nextStep}` : ''}`)
    }
  }
  if (criteria.length) {
    lines.push('', heading(`Соответствие ожиданиям уровня «${targetLabel}»`))
    for (const criterion of criteria.slice(0, 5)) lines.push(`• ${criterion.competencyTitle}: ${criterion.text}`)
  }
  lines.push(
    '',
    heading('Не забудьте перед отправкой'),
    '',
    '• Проверить, что все цифры и метрики подтверждены и актуальны.',
    '• Указать реальных людей, подтвердивших результаты, если это уместно.',
    '• Убрать любой тезис, который нельзя обосновать записью в Эскаде.',
  )
  return lines.join('\\n')
}'''
    replace_or_fail(guidance_path, old_promotion, new_promotion, "local-guidance.mjs: buildPromotionDraft -> plain text")

    print("\n[OK] Все 4 типа отчёта теперь генерируются как обычный текст, без Markdown-синтаксиса.")

    # --- ai-contract.mjs: update external-AI instruction to match -----------
    old_instruction = '''function reportDraftInstruction(reportType) {
  const label = String(reportType ?? '').toLowerCase()
  if (label.includes('недел')) {
    return 'Create a short Russian Markdown weekly pulse from only the selected wins and ideas: a few bullet lines per win, one line per idea in progress, one next-week focus. No headline ceremony, no invented metrics or impact.'
  }
  if (label.includes('performance')) {
    return 'Create a thorough Russian Markdown performance-review draft covering the FULL period: every selected win in full detail, ideas in progress, and a competency-signal summary derived only from the competencyIds already present on the supplied wins/ideas (counts only, never invented scores or percentages). Do not invent metrics, impact, recognition, or causal claims.'
  }
  if (label.includes('promotion')) {
    return 'Create a Russian Markdown promotion case that presents the employee in the strongest honest light supported by the data: lead with the strongest competency signals mapped to the next-level criteria supplied, then the key results with full detail, then initiatives showing scope. Never invent a metric, stakeholder confirmation, or causal claim that is not already in the supplied facts — end with an explicit "не забудьте" checklist of what the user must still verify (numbers, confirmations) before submitting.'
  }
  return 'Create a concise Russian Markdown monthly draft from only the selected wins and ideas. Do not invent metrics, impact, recognition, or causal claims.'
}'''
    new_instruction = '''function reportDraftInstruction(reportType) {
  const label = String(reportType ?? '').toLowerCase()
  const plainTextRule = 'Output must be PLAIN TEXT, never Markdown: no #, no **bold**, no Markdown "- " list syntax. Use uppercase section headers on their own line, "\\u2022 " for bullet points, and "Label: value" instead of bold labels.'
  if (label.includes('недел')) {
    return `Create a short Russian weekly pulse from only the selected wins and ideas: a few bullet lines per win, one line per idea in progress, one next-week focus. No headline ceremony, no invented metrics or impact. ${plainTextRule}`
  }
  if (label.includes('performance')) {
    return `Create a thorough Russian performance-review draft covering the FULL period: every selected win in full detail, ideas in progress, and a competency-signal summary derived only from the competencyIds already present on the supplied wins/ideas (counts only, never invented scores or percentages). Do not invent metrics, impact, recognition, or causal claims. ${plainTextRule}`
  }
  if (label.includes('promotion')) {
    return `Create a Russian promotion case that presents the employee in the strongest honest light supported by the data: lead with the strongest competency signals mapped to the next-level criteria supplied, then the key results with full detail, then initiatives showing scope. Never invent a metric, stakeholder confirmation, or causal claim that is not already in the supplied facts — end with an explicit "не забудьте" checklist of what the user must still verify (numbers, confirmations) before submitting. ${plainTextRule}`
  }
  return `Create a concise Russian monthly draft from only the selected wins and ideas. Do not invent metrics, impact, recognition, or causal claims. ${plainTextRule}`
}'''
    replace_or_fail(contract_path, old_instruction, new_instruction, "ai-contract.mjs: reportDraftInstruction asks for plain text, not Markdown")

    print("[OK] Инструкция для внешнего AI обновлена под обычный текст.")


# ---------------------------------------------------------------------------
# step 5: profile — remove role, keep only level
# ---------------------------------------------------------------------------


def simplify_profile():
    step("STEP 5/6 — Профиль: убрать «Текущая должность», оставить только уровень")

    tsx_path = os.path.join(REPO_ROOT, "app", "career", "CareerDashboard.tsx")
    if not os.path.isfile(tsx_path):
        fail(f"Не найден файл: {tsx_path}")

    # --- ProfileModal: remove the role field ---------------------------------
    replace_or_fail(
        tsx_path,
        "<label className={styles.field}>Текущая должность<input value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })} required /></label><label className={styles.field}>Уровень по шкале<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>",
        "<label className={styles.field}>Уровень по шкале<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>",
        "ProfileModal: remove 'Текущая должность' field, keep only the level select",
    )

    # --- Onboarding: remove the role field (same reasoning — half-removed
    #     would be worse than fully removed) ------------------------------
    replace_or_fail(
        tsx_path,
        "<label>Текущая должность<input value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })} required /></label><label>Уровень по шкале<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>",
        "<label>Уровень по шкале<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>",
        "Onboarding: remove 'Текущая должность' field, keep only the level select",
    )

    # --- profile chip subtitle: show the level instead of the (now empty)
    #     role, so the chip still shows something meaningful --------------
    replace_or_fail(
        tsx_path,
        "<button type=\"button\" className={styles.profileChip} onClick={() => setProfileOpen(true)}><span>{state.profile.name.slice(0, 1) || 'Э'}</span><div><strong>{state.profile.name || 'Мой профиль'}</strong><small>{state.profile.role}</small></div></button>",
        "<button type=\"button\" className={styles.profileChip} onClick={() => setProfileOpen(true)}><span>{state.profile.name.slice(0, 1) || 'Э'}</span><div><strong>{state.profile.name || 'Мой профиль'}</strong><small>{levelLabels[state.profile.currentLevel]}</small></div></button>",
        "profile chip subtitle: show level label instead of role",
    )

    # --- GrowthView heading: show the level instead of role ------------------
    replace_or_fail(
        tsx_path,
        "<section className={styles.progressHero}><div><span className={styles.eyebrow}>Ваш контекст</span><h2>{profile.role}</h2><p>{profile.market || 'Рынок или команда не указаны'}</p></div>",
        "<section className={styles.progressHero}><div><span className={styles.eyebrow}>Ваш контекст</span><h2>{levelLabels[profile.currentLevel]}</h2><p>{profile.market || 'Рынок или команда не указаны'}</p></div>",
        "GrowthView: heading shows level label instead of role",
    )

    print("\n[OK] «Текущая должность» убрана из UI; везде, где раньше показывалась должность, теперь показывается уровень.")


# ---------------------------------------------------------------------------
# step 6: tests
# ---------------------------------------------------------------------------

TEST_ADDITIONS = '''

test('generated report drafts contain no Markdown syntax (plain text only)', () => {
  const markdownPattern = /(^|\\n)#{1,6}\\s|\\*\\*[^*]+\\*\\*|(^|\\n)-\\s/

  const weekly = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager', market: 'Brazil', currentLevel: 'specialist' },
    competencyIds: [],
    artifact: { reportType: 'Недельный отчёт', periodStart: '2026-08-03', periodEnd: '2026-08-09', wins: [{ title: 'X', impact: 'Y' }], ideas: [{ title: 'Z', nextStep: 'W' }] },
  })
  assert.doesNotMatch(weekly.draftMarkdown, markdownPattern)

  const monthly = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager', market: 'Brazil', currentLevel: 'senior' },
    competencyIds: [],
    artifact: { reportType: 'Ежемесячный отчёт', periodStart: '2026-07-01', periodEnd: '2026-07-31', wins: [{ title: 'X', impact: 'Y', evidence: 'Z' }], ideas: [] },
  })
  assert.doesNotMatch(monthly.draftMarkdown, markdownPattern)

  const performance = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager', market: 'Brazil', currentLevel: 'senior' },
    competencyIds: ['content-marketing'],
    artifact: { reportType: 'Performance review', periodStart: '2026-01-01', periodEnd: '2026-06-30', wins: [{ title: 'X', impact: 'Y', evidence: 'Z', competencyIds: ['content-marketing'], competencyTitle: 'Контент-маркетинг' }], ideas: [] },
  })
  assert.doesNotMatch(performance.draftMarkdown, markdownPattern)

  const promotion = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager', market: 'Brazil', currentLevel: 'senior' },
    competencyIds: ['results-proactivity'],
    artifact: { reportType: 'Promotion case', periodStart: '2026-01-01', periodEnd: '2026-06-30', wins: [{ title: 'X', impact: 'Y', evidence: 'Z', competencyIds: ['results-proactivity'], competencyTitle: 'Ориентация на результат' }], ideas: [] },
  })
  assert.doesNotMatch(promotion.draftMarkdown, markdownPattern)
})
'''


def fix_preexisting_report_tests_for_case_change():
    step("Обновление регистро-зависимых проверок в существующих report-тестах (v12)")

    test_path = os.path.join(REPO_ROOT, "tests", "escada-v10.test.mjs")
    if not os.path.isfile(test_path):
        fail(f"Не найден файл: {test_path}")

    # These two assertions predate v20 and checked for exact-case Markdown
    # heading text ("## Сигналы по компетенциям"). The plain-text rewrite
    # uppercases section headers (heading() helper), which is an intentional
    # visual change, not a content regression — switch to case-insensitive
    # matching so the assertion checks for the right content regardless of
    # case, instead of hardcoding one specific casing.
    replace_or_fail(
        test_path,
        "assert.match(result.draftMarkdown, /Сигналы по компетенциям/)",
        "assert.match(result.draftMarkdown, /Сигналы по компетенциям/i)",
        "performance-review test: case-insensitive match (heading() now uppercases section titles)",
    )
    replace_or_fail(
        test_path,
        "assert.match(result.draftMarkdown, /Сильнейшие сигналы/)",
        "assert.match(result.draftMarkdown, /Сильнейшие сигналы/i)",
        "promotion-case test: case-insensitive match (heading() now uppercases section titles)",
    )
    replace_or_fail(
        test_path,
        "assert.match(result.draftMarkdown, /Не забудьте перед отправкой/)",
        "assert.match(result.draftMarkdown, /Не забудьте перед отправкой/i)",
        "promotion-case test: case-insensitive match for the checklist heading too",
    )

    print("  updated 3 pre-existing assertions to be case-insensitive")


def extend_tests():
    step("STEP 6/6 — Тест: сгенерированные отчёты не содержат Markdown-синтаксиса")

    test_path = os.path.join(REPO_ROOT, "tests", "escada-v10.test.mjs")
    if not os.path.isfile(test_path):
        fail(f"Не найден файл: {test_path}")

    with open(test_path, "r", encoding="utf-8") as f:
        content = f.read()
    if "contain no Markdown syntax" in content:
        fail("Тесты для v20 уже похоже применены — повторный запуск не ожидается.")
    with open(test_path, "a", encoding="utf-8") as f:
        f.write(TEST_ADDITIONS)
    print("  appended: Markdown-syntax absence check for all 4 report types")


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

    commit_message_file = os.path.join(REPO_ROOT, ".git", "COMMIT_EDITMSG_escada_v20")
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
    redesign_note_editor()
    build_compact_note_to_idea_modal()
    convert_reports_to_plain_text()
    simplify_profile()
    fix_preexisting_report_tests_for_case_change()
    extend_tests()
    run_verification_gate()
    git_commit_and_push()

    print("\nГотово. Патч v20 применён, протестирован, собран и запушен в main.")


if __name__ == "__main__":
    main()
