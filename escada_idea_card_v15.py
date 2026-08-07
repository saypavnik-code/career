#!/usr/bin/env python3
"""
escada_idea_card_v15.py

Эскада — patch v15.

Scope: Roadmap "AI First Product Roadmap" — Phase 4 ("Новая карточка
идеи"). Rebuilds the idea workspace so creating/editing an idea feels like
filling two fields, not a task-management form. Phase 5 (reformatting the
career-hint block's own content/logic) and Phase 6 (Win! confirmation
dialog, prefill table, duplicate-conversion guard) are explicitly OUT of
scope here and follow as v16/v17 — this patch repositions and keeps the
existing signal card and existing "Оформить win" behavior (renamed to
"Win!", moved into the top action row) unchanged in substance.

Steps, in order, stop on first failure:

  1. VERIFY — same git/deploy gate as v11-v14, plus a v14-applied sanity
     check (this patch's replacements assume the kanban-era IdeasView/
     ActiveIdeaStatus shape from v14).

  2. IDEA WORKSPACE REBUILD (CareerDashboard.tsx, career.module.css)
     - Top action row (roadmap 6.1): status <select> on the left (reuses
       ActiveIdeaStatus/KANBAN_COLUMNS from v14 — an idea already promoted
       to a win or archived is never opened through this workspace, so the
       dropdown only ever needs to offer the 4 active statuses), "Win!" on
       the right. Same height, same row, primaryButton weight (navy, not
       destructive-red) per roadmap 6.3 ("заметен, но не выглядит опасным").
       "Win!" calls the same onPromote the old "Оформить win" button called
       — full confirm-dialog/prefill-table behavior is Phase 6.
     - Exactly two primary fields (roadmap 6.2): "Название идеи" (input,
       placeholder inside, no label above) and "Смысл" (textarea, replaces
       "Контекст", placeholder inside: "В чём идея и почему она может быть
       полезна?").
     - Removed entirely from the UI: "Следующий шаг" field, and the whole
       internal work-item kanban ("Лёгкий канбан" / "Ход работы" / "Добавить
       этап" / column UI / move buttons). The underlying data fields
       (nextStep, workItems) stay on the Idea type and in storage — nothing
       is deleted, they're simply no longer editable from this screen,
       matching the roadmap's "сохранение legacy-данных без отображения".
     - Career-hint signal card repositioned directly after Название/Смысл
       (roadmap 7.2: "после полей «Название» и «Смысл»"). Its own content
       format is untouched here — that rewrite is Phase 5.
     - "Рабочие заметки" and "Доказательства" are kept (the roadmap's
       removal list names only next-step and the internal kanban) but
       become secondary, collapsed-by-default <details> sections rather
       than always-open panels, per 6.3's "вторичные элементы визуально
       спокойные".
     - Single-column layout replaces the previous two-column grid + sticky
       sidebar — a plain vertical flow reads simpler and matches "интерфейс
       должен быть заметно проще текущей версии" better than a dashboard-
       style split view.
     - Spacing: workspace sections gain visibly more vertical breathing
       room (roadmap 6.3: "не менее 24–32 px между смысловыми блоками").
     - Footer simplifies to "Закрыть" / "Сохранить идею" only ("Win!" lives
       in the top action row now, so the old separate "Оформить win" footer
       button is removed to avoid two win-entry-points on one screen).

  3. TESTS — no career-core.mjs logic changes in this patch (it's a pure UI
     rebuild), so no new unit tests are required beyond re-running the full
     suite to confirm nothing broke. This step is therefore a no-op kept
     for structural consistency with v11-v14 and to make that explicit in
     the run log rather than silently skipping it.

Запуск (в Codespaces, из корня репозитория, после того как v11, v12, v13, и
v14 уже применены и запушены в main):

    python3 escada_idea_card_v15.py
"""

import subprocess
import sys
import os
import re
import urllib.request
import urllib.error

REPO_ROOT = os.getcwd()
PATCH_NAME = "escada_idea_card_v15"
COMMIT_MESSAGE = (
    "feat(escada): v15 new idea workspace \u2014 2 fields, action row, no "
    "internal kanban (roadmap Phase 4)\n\n"
    "- top action row: idea status <select> + \u00abWin!\u00bb (same weight/"
    "height, same behavior as the old \u00abОформить win\u00bb, just "
    "repositioned)\n"
    "- exactly two primary fields: \u00abНазвание идеи\u00bb and \u00abСмысл"
    "\u00bb (renamed from \u00abКонтекст\u00bb), placeholders inside the "
    "inputs, no label-above-field duplication\n"
    "- remove \u00abСледующий шаг\u00bb field and the entire internal "
    "work-item kanban from the UI; underlying data fields are preserved, "
    "not deleted\n"
    "- career-hint signal card repositioned directly after Название/Смысл\n"
    "- \u00abРабочие заметки\u00bb / \u00abДоказательства\u00bb kept but "
    "collapsed by default as secondary sections\n"
    "- single-column layout, more vertical spacing between sections, "
    "simplified footer"
)

DEPLOYED_VERSION_URL = "https://saypavnik-code.github.io/career/deploy-version.txt"

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
            "v11, v12, v13 и v14 уже применены и запушены (v15 строится на "
            "них), затем проверьте вручную."
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


# ---------------------------------------------------------------------------
# step 1: verification
# ---------------------------------------------------------------------------


def verify_repository():
    step("STEP 1/3 — Верификация репозитория")

    if not os.path.isfile(os.path.join(REPO_ROOT, "package.json")):
        fail("package.json не найден. Запустите скрипт из корня репозитория.")

    run("git fetch origin")

    status = run("git status --porcelain").stdout.strip()
    if status:
        fail(f"Рабочее дерево не чистое:\n{status}\n\nЗакоммитьте/отмените изменения перед запуском.")

    branch = run("git rev-parse --abbrev-ref HEAD").stdout.strip()
    if branch != "main":
        fail(f"Текущая ветка '{branch}', а не 'main'.")

    head_sha = run("git rev-parse HEAD").stdout.strip()
    origin_sha = run("git rev-parse origin/main").stdout.strip()
    print(f"\nHEAD:         {head_sha}")
    print(f"origin/main:  {origin_sha}")
    if head_sha != origin_sha:
        fail("HEAD не совпадает с origin/main. Синхронизируйтесь: git pull --ff-only origin main")

    print("\n[OK] main синхронизирован с origin/main, рабочее дерево чистое.")

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
        if "KANBAN_COLUMNS" not in tsx_content:
            fail(
                "Похоже, патч v14 ещё не применён (не найден KANBAN_COLUMNS в "
                "CareerDashboard.tsx). Примените v11-v14 перед v15."
            )
    else:
        fail(f"Не найден файл: {tsx_path}")


# ---------------------------------------------------------------------------
# step 2: idea workspace rebuild
# ---------------------------------------------------------------------------


def rebuild_idea_workspace():
    step("STEP 2/3 — Карточка идеи: 2 поля, action row, без внутреннего канбана")

    tsx_path = os.path.join(REPO_ROOT, "app", "career", "CareerDashboard.tsx")
    css_path = os.path.join(REPO_ROOT, "app", "career", "career.module.css")
    for p in (tsx_path, css_path):
        if not os.path.isfile(p):
            fail(f"Не найден файл: {p}")

    # --- IdeaWorkspace: full rewrite -----------------------------------------
    old_workspace = (
        '  return <div className={styles.workspaceBackdrop}><section className={styles.ideaWorkspace}><header className={styles.workspaceHeader}><div><span className={styles.eyebrow}>Идея как рабочее пространство</span><h2>{draft.title || \'Новая идея\'}</h2><p>Детали остаются внутри. Карточка в списке будет минималистичной.</p></div><button type="button" onClick={onClose}>×</button></header><div className={styles.ideaWorkspaceGrid}><div className={styles.ideaMainColumn}><section className={styles.workspaceSection}><label className={styles.field}>Название идеи<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} autoFocus /></label><label className={styles.field}>Контекст<textarea className={styles.largeTextarea} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="Почему эта идея появилась, какую проблему или возможность вы заметили?" /></label><label className={styles.field}>Следующий шаг<textarea value={draft.nextStep} onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })} placeholder="Одно конкретное действие" /></label></section><section className={styles.workspaceSection}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Лёгкий канбан</span><h3>Ход работы</h3></div></div><div className={styles.addInline}><input value={workText} onChange={(event) => setWorkText(event.target.value)} placeholder="Добавить этап" /><button type="button" onClick={addWork}>Добавить</button></div><div className={styles.miniKanban}>{([\'backlog\', \'doing\', \'done\'] as WorkStatus[]).map((status) => {\n'
        '      const items = draft.workItems.filter((item) => item.status === status)\n'
        '      return <div className={styles.kanbanColumn} data-status={status} key={status}><header className={styles.kanbanHeader}><span className={styles.kanbanStatusDot} aria-hidden="true" /><strong>{workStatusLabels[status]}</strong><span className={styles.kanbanCount}>{items.length}</span></header><div className={styles.kanbanItems}>{items.length ? items.map((item) => <article className={styles.workItem} key={item.id}><p>{item.title}</p><div>{status !== \'backlog\' && <button className={styles.kanbanMoveButton} type="button" aria-label="Переместить этап назад" onClick={() => moveWork(item.id, status === \'done\' ? \'doing\' : \'backlog\')}>←</button>}{status !== \'done\' && <button className={styles.kanbanMoveButton} type="button" aria-label="Переместить этап вперёд" onClick={() => moveWork(item.id, status === \'backlog\' ? \'doing\' : \'done\')}>→</button>}</div></article>) : <small>Здесь пока нет этапов</small>}</div></div>\n'
        '    })}</div></section><section className={styles.workspaceSection}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Рабочие заметки</span><h3>Логика и наблюдения</h3></div></div><div className={styles.addInline}><input value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Решение, наблюдение, обратная связь…" /><button type="button" onClick={addNote}>Добавить</button></div><div className={styles.notesTimeline}>{draft.notes.map((note) => <article key={note.id}><span>{formatDate(note.createdAt.slice(0, 10))}</span><p>{note.text}</p></article>)}</div></section><section className={styles.workspaceSection}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Доказательства</span><h3>Что сохранить для будущего win</h3></div></div><div className={styles.addInline}><input value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} placeholder="Ссылка, артефакт, отзыв, метрика, решение…" /><button type="button" onClick={addEvidence}>Добавить</button></div><div className={styles.evidenceList}>{draft.evidenceNotes.map((item) => <article key={item.id}><span>◆</span><p>{item.text}</p></article>)}</div></section></div><aside className={styles.ideaSideColumn}><section className={styles.signalCard}><span className={styles.eyebrow}>Встроенная карьерная подсказка</span><h3>{levelLabels[inferred.level]}</h3><p>{inferred.reason}</p><details><summary>Ожидания текущего уровня</summary><ul>{currentExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>{target && <details><summary>Как выйти на {levelLabels[target]}</summary><ul>{nextExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>}</section><section className={styles.workspaceSection}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Компетенции</span><h3>Контекст идеи</h3></div></div><div className={styles.choiceChips}>{competencies.map((competency) => <button type="button" key={competency.id} className={draft.competencyIds.includes(competency.id) ? styles.choiceActive : \'\'} onClick={() => toggleCompetency(competency.id)}>{competency.shortTitle}</button>)}</div></section><section className={styles.aiPanel}><span className={styles.eyebrow}>Только по запросу</span><h3>Разобрать с Эскадой</h3><p>Эскада сопоставит карточку с релевантными пунктами шкалы и подскажет следующий шаг. Внешние карьерные фреймворки не используются.</p><button className={styles.primaryButton} type="button" disabled={busy === \'idea_review\'} onClick={() => void runAi()}>{busy === \'idea_review\' ? \'Разбираем…\' : \'Разобрать с Эскадой\'}</button>{error && <p className={styles.aiError}>{error}</p>}</section>{guidance && <AiGuidancePanel guidance={guidance} compact onSaveNextStep={() => setDraft({ ...draft, nextStep: guidance.nextStep })} />}</aside></div><footer className={styles.workspaceFooter}><button className={styles.secondaryButton} type="button" onClick={onClose}>Закрыть</button><div><button className={styles.secondaryButton} type="button" disabled={!draft.title.trim()} onClick={() => onPromote(draft)}>Оформить win</button><button className={styles.primaryButton} type="button" disabled={!draft.title.trim()} onClick={() => onSave(draft)}>Сохранить идею</button></div></footer></section></div>\n'
    )

    new_workspace = '''  return <div className={styles.workspaceBackdrop}><section className={`${styles.ideaWorkspace} ${styles.ideaWorkspaceSimple}`}>
    <header className={styles.workspaceHeader}>
      <div className={styles.ideaActionRow}>
        <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ActiveIdeaStatus })} aria-label="Статус идеи">
          {KANBAN_COLUMNS.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}
        </select>
        <button type="button" className={styles.primaryButton} disabled={!draft.title.trim()} onClick={() => onPromote(draft)}>Win!</button>
      </div>
      <button type="button" className={styles.workspaceCloseButton} aria-label="Закрыть" onClick={onClose}>×</button>
    </header>
    <div className={styles.ideaWorkspaceBody}>
      <section className={styles.workspaceSectionSpacious}>
        <input className={styles.ideaTitleInput} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Название идеи" autoFocus />
        <textarea className={styles.largeTextarea} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="В чём идея и почему она может быть полезна?" />
      </section>

      <section className={styles.signalCard}><span className={styles.eyebrow}>Карьерная подсказка</span><h3>{levelLabels[inferred.level]}</h3><p>{inferred.reason}</p><details><summary>Ожидания текущего уровня</summary><ul>{currentExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>{target && <details><summary>Как выйти на {levelLabels[target]}</summary><ul>{nextExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>}</section>

      <section className={styles.workspaceSectionSpacious}>
        <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Компетенции</span><h3>Контекст идеи</h3></div></div>
        <div className={styles.choiceChips}>{competencies.map((competency) => <button type="button" key={competency.id} className={draft.competencyIds.includes(competency.id) ? styles.choiceActive : ''} onClick={() => toggleCompetency(competency.id)}>{competency.shortTitle}</button>)}</div>
      </section>

      <section className={styles.aiPanel}><span className={styles.eyebrow}>Только по запросу</span><h3>Разобрать с Эскадой</h3><p>Эскада сопоставит карточку с релевантными пунктами шкалы и подскажет следующий шаг. Внешние карьерные фреймворки не используются.</p><button className={styles.primaryButton} type="button" disabled={busy === 'idea_review'} onClick={() => void runAi()}>{busy === 'idea_review' ? 'Разбираем…' : 'Разобрать с Эскадой'}</button>{error && <p className={styles.aiError}>{error}</p>}</section>
      {guidance && <AiGuidancePanel guidance={guidance} compact />}

      <details className={styles.secondarySection}>
        <summary>Рабочие заметки</summary>
        <div className={styles.addInline}><input value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Решение, наблюдение, обратная связь…" /><button type="button" onClick={addNote}>Добавить</button></div>
        <div className={styles.notesTimeline}>{draft.notes.map((note) => <article key={note.id}><span>{formatDate(note.createdAt.slice(0, 10))}</span><p>{note.text}</p></article>)}</div>
      </details>

      <details className={styles.secondarySection}>
        <summary>Доказательства</summary>
        <div className={styles.addInline}><input value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} placeholder="Ссылка, артефакт, отзыв, метрика, решение…" /><button type="button" onClick={addEvidence}>Добавить</button></div>
        <div className={styles.evidenceList}>{draft.evidenceNotes.map((item) => <article key={item.id}><span>◆</span><p>{item.text}</p></article>)}</div>
      </details>
    </div>
    <footer className={styles.workspaceFooter}><button className={styles.secondaryButton} type="button" onClick={onClose}>Закрыть</button><button className={styles.primaryButton} type="button" disabled={!draft.title.trim()} onClick={() => onSave(draft)}>Сохранить идею</button></footer>
  </section></div>
'''
    replace_or_fail(tsx_path, old_workspace, new_workspace, "IdeaWorkspace: full rewrite (2 fields, action row, no internal kanban)")

    # --- drop now-unused workText/addWork/moveWork (internal kanban control
    #     handlers) — the underlying workItems data field stays on Idea and
    #     in storage, only the UI to add/move items is removed.
    replace_or_fail(
        tsx_path,
        "  const [workText, setWorkText] = useState('')\n",
        "",
        "IdeaWorkspace: drop unused workText state (no internal-kanban input anymore)",
    )
    replace_or_fail(
        tsx_path,
        "  function addWork() { const title = workText.trim(); if (!title) return; setDraft((current) => ({ ...current, status: current.status === 'concept' || current.status === 'preparation' ? 'in_progress' : current.status, workItems: [...current.workItems, { id: createId('work'), title, status: 'backlog', createdAt: new Date().toISOString(), completedAt: null }] })); setWorkText('') }\n"
        "  function moveWork(id: string, status: WorkStatus) { setDraft((current) => ({ ...current, workItems: current.workItems.map((item) => item.id === id ? { ...item, status, completedAt: status === 'done' ? new Date().toISOString() : null } : item) })) }\n",
        "",
        "IdeaWorkspace: drop unused addWork/moveWork (internal kanban removed from UI)",
    )

    print("\n[OK] IdeaWorkspace переписан: 2 поля, action row, внутренний канбан убран из UI.")

    # --- CSS: action row, spacious sections, simplified header/close button,
    #     secondary <details> sections, single-column body -------------------
    idea_workspace_css = '''

/* escada-idea-card-v15: simplified single-column workspace (roadmap Phase 4) */
.ideaWorkspaceSimple { grid-template-rows: auto 1fr auto; }
.ideaWorkspaceSimple .workspaceHeader { align-items: center; }
.ideaActionRow {
  display: flex;
  align-items: stretch;
  gap: 12px;
  flex: 1;
}
.ideaActionRow select {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: white;
  color: var(--ink);
  font-weight: 800;
  font-size: 13px;
  padding: 0 16px;
  min-width: 160px;
}
.ideaActionRow .primaryButton { padding: 0 22px; }
.workspaceCloseButton {
  border: 0;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: white;
  font-size: 23px;
  margin-left: 16px;
  flex-shrink: 0;
}
.ideaWorkspaceBody {
  overflow: auto;
  padding: 28px 32px 32px;
  display: grid;
  gap: 28px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}
.workspaceSectionSpacious { display: grid; gap: 16px; }
.ideaTitleInput {
  border: 0;
  background: transparent;
  font-size: clamp(24px, 3.4vw, 34px);
  font-weight: 850;
  letter-spacing: -0.03em;
  color: var(--ink);
  padding: 4px 0;
}
.ideaTitleInput:focus { outline: none; }
.ideaTitleInput::placeholder { color: var(--muted); opacity: 0.6; }
.secondarySection {
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 16px 19px;
  background: var(--panel);
}
.secondarySection summary {
  cursor: pointer;
  font-weight: 750;
  font-size: 13px;
  color: var(--muted);
}
.secondarySection[open] summary { margin-bottom: 14px; color: var(--ink); }

@media (max-width: 780px) {
  .ideaWorkspaceBody { padding: 20px 18px 24px; gap: 22px; }
  .ideaActionRow select { min-width: 0; }
}'''
    with open(css_path, "r", encoding="utf-8") as f:
        css_content = f.read()
    if ".ideaWorkspaceSimple {" in css_content:
        fail("Похоже, .ideaWorkspaceSimple уже определён в career.module.css — v15 могла быть уже применена.")
    with open(css_path, "a", encoding="utf-8") as f:
        f.write(idea_workspace_css)
    print("  appended: .ideaActionRow / .ideaWorkspaceBody / .secondarySection CSS (design tokens only)")


# ---------------------------------------------------------------------------
# tests (no-op: pure UI rebuild, no career-core.mjs logic changed)
# ---------------------------------------------------------------------------


def confirm_no_new_unit_tests_needed():
    step("STEP 3/3 — Тесты")
    print(
        "  v15 — чисто UI-патч (CareerDashboard.tsx + career.module.css); "
        "career-core.mjs не менялся, новых unit-тестов не требуется. "
        "Полный набор тестов ниже подтверждает, что ничего не сломалось."
    )


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

    commit_message_file = os.path.join(REPO_ROOT, ".git", "COMMIT_EDITMSG_escada_v15")
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
    rebuild_idea_workspace()
    confirm_no_new_unit_tests_needed()
    run_verification_gate()
    git_commit_and_push()

    print("\nГотово. Патч v15 (Phase 4 roadmap) применён, протестирован, собран и запушен в main.")


if __name__ == "__main__":
    main()
