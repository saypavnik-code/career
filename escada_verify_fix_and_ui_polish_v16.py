#!/usr/bin/env python3
"""
escada_verify_fix_and_ui_polish_v16.py

Эскада — patch v16.

Контекст: запуск v15 упал на самом первом шаге верификации — git status
показал сам файл escada_idea_card_v15.py как untracked, и скрипт (справедливо
по своей логике, но неудобно на практике) отказался работать на "грязном"
дереве. Из-за этого весь Phase 4 (новая карточка идеи) из v15 фактически
НЕ был применён. Этот патч:

  1. Чинит саму проблему верификации на будущее — untracked *.py файлы
     патчей (шаблон escada_*_patch_v*.py / escada_*_v*.py) в корне репозитория
     больше не считаются "грязным деревом". Что угодно ещё untracked, и
     любые modified/staged файлы по-прежнему блокируют запуск, как и раньше.
  2. Раз v15 не применился, этот патч включает в себя его содержимое
     целиком (перестройка карточки идеи: 2 поля, action row, без
     внутреннего канбана) — см. docstring escada_idea_card_v15.py для
     полного описания.
  3. Добавляет 3 точечных UI-фикса, о которых попросили после ревью:
     - экран «Сегодня»: под формой быстрой записи, когда заметок ещё нет,
       не показывается больше ничего (раньше — EmptyState-заглушка
       "Пока нет мыслей...").
     - экран «Идеи»: карточка кликабельна целиком (клик открывает
       карточку идеи), отдельная кнопка «Открыть» убрана.
     - dropdown статуса на карточке идеи теперь занимает всю ширину
       карточки (раньше делил её с кнопкой «Открыть», из-за чего длинные
       названия статусов обрезались).

Шаги, по порядку, останавливается на первой ошибке:

  1. VERIFY — тот же git/deploy гейт, что в v11-v15, с фиксом из пункта 1
     выше.
  2. IDEA WORKSPACE — содержимое v15 (см. выше), применяется только если
     ещё не применено (защита от повторного запуска).
  3. UI FIXES — три правки выше.

Запуск (в Codespaces, из корня репозитория, ветка main):

    python3 escada_verify_fix_and_ui_polish_v16.py
"""

import subprocess
import sys
import os
import re
import fnmatch
import urllib.request
import urllib.error

REPO_ROOT = os.getcwd()
PATCH_NAME = "escada_verify_fix_and_ui_polish_v16"
COMMIT_MESSAGE = (
    "feat(escada): v16 apply Phase 4 idea workspace (v15 retry) + UI "
    "polish\n\n"
    "- fix patch-runner verification: untracked escada_*_v*.py patch "
    "scripts in repo root no longer count as a dirty working tree\n"
    "- apply v15's idea workspace rebuild (2 fields, action row, no "
    "internal kanban) \u2014 v15's own run failed at the verification step "
    "before making any changes\n"
    "- \u00abСегодня\u00bb: no empty-state placeholder under the quick-"
    "thought form when there are no notes yet\n"
    "- \u00abИдеи\u00bb: whole kanban card is clickable (opens the idea); "
    "remove the separate \u00abОткрыть\u00bb button\n"
    "- \u00abИдеи\u00bb: status <select> now spans the full card width "
    "so status labels are never clipped"
)

DEPLOYED_VERSION_URL = "https://saypavnik-code.github.io/career/deploy-version.txt"

# Untracked files matching these patterns are ignored when checking for a
# dirty working tree — they're the patch scripts themselves, which are
# expected to sit in the repo root as untracked files when this runner is
# invoked (they're also already covered by .gitignore's escada_*_patch_v*.py
# rule, but earlier/differently-named scripts like escada_idea_card_v15.py
# and this file itself don't match that exact glob).
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
            "v11-v14 уже применены и запушены, затем проверьте вручную."
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
    step("STEP 1/3 — Верификация репозитория")

    if not os.path.isfile(os.path.join(REPO_ROOT, "package.json")):
        fail("package.json не найден. Запустите скрипт из корня репозитория.")

    run("git fetch origin")

    status_lines = run("git status --porcelain").stdout.splitlines()
    blocking_lines = []
    ignored_lines = []
    for line in status_lines:
        # porcelain format: "XY path" — untracked files are "?? path"
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
        if "KANBAN_COLUMNS" not in tsx_content:
            fail(
                "Похоже, патч v14 ещё не применён (не найден KANBAN_COLUMNS в "
                "CareerDashboard.tsx). Примените v11-v14 перед v16."
            )
    else:
        fail(f"Не найден файл: {tsx_path}")


# ---------------------------------------------------------------------------
# step 2: idea workspace rebuild (v15's content, retried)
# ---------------------------------------------------------------------------


def rebuild_idea_workspace():
    step("STEP 2/3 — Карточка идеи: 2 поля, action row, без внутреннего канбана (retry v15)")

    tsx_path = os.path.join(REPO_ROOT, "app", "career", "CareerDashboard.tsx")
    css_path = os.path.join(REPO_ROOT, "app", "career", "career.module.css")
    for p in (tsx_path, css_path):
        if not os.path.isfile(p):
            fail(f"Не найден файл: {p}")

    with open(tsx_path, "r", encoding="utf-8") as f:
        tsx_content = f.read()
    if "ideaWorkspaceSimple" in tsx_content:
        print("  v15 уже применён (найден ideaWorkspaceSimple) — пропускаю перестройку карточки идеи.")
        return

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
        print("  .ideaWorkspaceSimple CSS уже присутствует — пропускаю добавление.")
    else:
        with open(css_path, "a", encoding="utf-8") as f:
            f.write(idea_workspace_css)
        print("  appended: .ideaActionRow / .ideaWorkspaceBody / .secondarySection CSS")


# ---------------------------------------------------------------------------
# step 3: UI fixes
# ---------------------------------------------------------------------------


def apply_ui_fixes():
    step("STEP 3/3 — Точечные UI-фиксы (Сегодня, Идеи)")

    tsx_path = os.path.join(REPO_ROOT, "app", "career", "CareerDashboard.tsx")
    css_path = os.path.join(REPO_ROOT, "app", "career", "career.module.css")
    for p in (tsx_path, css_path):
        if not os.path.isfile(p):
            fail(f"Не найден файл: {p}")

    # --- Fix 1: "Сегодня" — no empty-state placeholder when there are no
    #     notes yet; just show nothing below the quick-thought form.
    replace_or_fail(
        tsx_path,
        "    {notes.length > 0 ? (\n"
        "      <section className={styles.pinBoard}>\n"
        "        {notes.map((note) => (\n"
        "          <article className={styles.noteCard} key={note.id} onClick={() => onOpenNote(note)} role=\"button\" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpenNote(note) }}>\n"
        "            <h4>{note.title}</h4>\n"
        "            <p>{noteExcerpt(note)}</p>\n"
        "            <span className={styles.noteCardDate}>{noteRelativeDate(note.createdAt)}</span>\n"
        "          </article>\n"
        "        ))}\n"
        "      </section>\n"
        "    ) : (\n"
        "      <EmptyState title=\"Пока нет мыслей\" text=\"Запишите первую мысль в форме выше — тип и детали можно добавить позже.\" action=\"Понятно\" onAction={() => {}} />\n"
        "    )}\n",
        "    {notes.length > 0 && (\n"
        "      <section className={styles.pinBoard}>\n"
        "        {notes.map((note) => (\n"
        "          <article className={styles.noteCard} key={note.id} onClick={() => onOpenNote(note)} role=\"button\" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpenNote(note) }}>\n"
        "            <h4>{note.title}</h4>\n"
        "            <p>{noteExcerpt(note)}</p>\n"
        "            <span className={styles.noteCardDate}>{noteRelativeDate(note.createdAt)}</span>\n"
        "          </article>\n"
        "        ))}\n"
        "      </section>\n"
        "    )}\n",
        "TodayView: no empty-state placeholder under the form when there are no notes yet",
    )

    # --- Fix 2 + 3: "Идеи" — whole card is clickable (remove "Открыть"
    #     button), status <select> spans the full card width.
    replace_or_fail(
        tsx_path,
        "                <article\n"
        "                  key={idea.id}\n"
        "                  className={styles.kanbanCard}\n"
        "                  draggable\n"
        "                  onDragStart={(event) => { event.dataTransfer.setData('text/escada-idea-id', idea.id); setDragIdeaId(idea.id) }}\n"
        "                  onDragEnd={() => setDragIdeaId(null)}\n"
        "                >\n"
        "                  <h4>{idea.title}</h4>\n"
        "                  <div className={styles.cardActions}>\n"
        "                    <select value={idea.status} onChange={(event) => onStatusChange(idea.id, event.target.value as ActiveIdeaStatus)} aria-label=\"Статус идеи\">\n"
        "                      {KANBAN_COLUMNS.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}\n"
        "                    </select>\n"
        "                    <button type=\"button\" className={styles.secondaryButton} onClick={() => onOpen(idea)}>Открыть</button>\n"
        "                  </div>\n"
        "                </article>\n",
        "                <article\n"
        "                  key={idea.id}\n"
        "                  className={styles.kanbanCard}\n"
        "                  draggable\n"
        "                  role=\"button\"\n"
        "                  tabIndex={0}\n"
        "                  onClick={() => onOpen(idea)}\n"
        "                  onKeyDown={(event) => { if (event.key === 'Enter') onOpen(idea) }}\n"
        "                  onDragStart={(event) => { event.dataTransfer.setData('text/escada-idea-id', idea.id); setDragIdeaId(idea.id) }}\n"
        "                  onDragEnd={() => setDragIdeaId(null)}\n"
        "                >\n"
        "                  <h4>{idea.title}</h4>\n"
        "                  <div className={styles.cardActions}>\n"
        "                    <select\n"
        "                      className={styles.kanbanCardStatusSelect}\n"
        "                      value={idea.status}\n"
        "                      onChange={(event) => onStatusChange(idea.id, event.target.value as ActiveIdeaStatus)}\n"
        "                      onClick={(event) => event.stopPropagation()}\n"
        "                      aria-label=\"Статус идеи\"\n"
        "                    >\n"
        "                      {KANBAN_COLUMNS.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}\n"
        "                    </select>\n"
        "                  </div>\n"
        "                </article>\n",
        "IdeasView: whole card clickable, remove Открыть button, status select stays full-width and doesn't trigger card open",
    )

    print("\n[OK] UI-фиксы применены.")

    # --- CSS: status select spans the full card width now that it's the
    #     only element in .cardActions (removes the old flex:1 rule that
    #     shared space with the now-removed Открыть button, and makes the
    #     intent explicit with its own class).
    replace_or_fail(
        css_path,
        ".kanbanCard .cardActions select { flex: 1; min-width: 0; }",
        ".kanbanCard .cardActions { justify-content: stretch; }\n"
        ".kanbanCard .cardActions .kanbanCardStatusSelect { width: 100%; min-width: 0; }",
        "kanbanCard status select: full width now that it's the only cardActions element",
    )

    print("[OK] CSS для карточки идеи обновлён (select на всю ширину).")


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

    commit_message_file = os.path.join(REPO_ROOT, ".git", "COMMIT_EDITMSG_escada_v16")
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
    apply_ui_fixes()
    run_verification_gate()
    git_commit_and_push()

    print("\nГотово. Патч v16 применён, протестирован, собран и запушен в main.")


if __name__ == "__main__":
    main()
