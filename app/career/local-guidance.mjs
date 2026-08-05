// escada-ui-guidance-v10: deterministic guidance from the supplied competency scale only.
import { retrieveCriteria } from './ai-contract.mjs'
import { knowledgeBaseVersion, levelLabels } from './competency-knowledge.mjs'

function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function sourceFromCriterion(criterion) {
  return {
    id: criterion.id,
    competencyTitle: criterion.competencyTitle,
    level: criterion.level,
    text: criterion.text,
    sourcePage: criterion.sourcePage,
  }
}

function cited(text, criterion) {
  return criterion ? { text, criterionId: criterion.id } : null
}

function currentSignal(criterion, currentLabel) {
  return `Для уровня «${currentLabel}» здесь важно ожидание: «${criterion.text}». В записи уже есть подходящее направление; добавьте конкретное действие или результат, чтобы этот сигнал было легко увидеть.`
}

function stretchSignal(criterion, targetLabel) {
  return `Чтобы выйти за рамки текущих ожиданий, приблизьте работу к уровню «${targetLabel}»: «${criterion.text}». Превратите это в один проверяемый шаг внутри инициативы.`
}

function evidenceForIdea(artifact) {
  const evidenceNotes = asArray(artifact.evidenceNotes).map((item) => asText(item?.text)).filter(Boolean)
  const done = asArray(artifact.workItems).filter((item) => item?.status === 'done').map((item) => asText(item?.title)).filter(Boolean)
  const result = []
  if (!done.length) result.push('Отметьте, что именно вы сделали: один завершённый этап уже превращает идею в наблюдаемую работу.')
  if (!evidenceNotes.length) result.push('Сохраните артефакт: ссылку, скриншот, решение, отзыв, публикацию или значение метрики до и после.')
  if (!asText(artifact.nextStep)) result.push('Запишите ближайшее действие так, чтобы его можно было выполнить и проверить.')
  return result.slice(0, 3)
}

function evidenceForWin(artifact) {
  const result = []
  if (!asText(artifact.impact)) result.push('Допишите, почему этот результат важен для продукта, команды, канала или рынка.')
  if (!asText(artifact.evidence)) result.push('Добавьте подтверждение: число, ссылку, артефакт, отзыв или принятое решение.')
  if (!asText(artifact.metrics) && !asText(artifact.confirmedBy)) result.push('Если это уместно, укажите реальное изменение в цифрах или того, кто подтвердил результат.')
  return result.length ? result.slice(0, 3) : ['Формулировка уже содержит результат, его значение и подтверждение. Проверьте только точность фактов.']
}

function buildReportDraft(artifact, criteria) {
  const reportType = asText(artifact.reportType) || 'Отчёт'
  const period = [asText(artifact.periodStart), asText(artifact.periodEnd)].filter(Boolean).join(' — ')
  const wins = asArray(artifact.wins)
  const ideas = asArray(artifact.ideas)
  const lines = [`# ${reportType}`]
  if (period) lines.push('', `Период: ${period}`)

  lines.push('', '## Главное за период')
  if (!wins.length) {
    lines.push('', 'Выберите wins, которые должны войти в отчёт.')
  } else {
    for (const win of wins) {
      const title = asText(win?.title) || 'Результат'
      lines.push('', `### ${title}`)
      if (asText(win?.impact)) lines.push('', `**Почему это важно.** ${asText(win.impact)}`)
      if (asText(win?.evidence)) lines.push('', `**Подтверждение.** ${asText(win.evidence)}`)
      if (asText(win?.metrics)) lines.push('', `**Изменение в цифрах.** ${asText(win.metrics)}`)
      if (asText(win?.confirmedBy)) lines.push('', `**Кто подтвердил.** ${asText(win.confirmedBy)}`)
      const work = asArray(win?.workSummary).map(asText).filter(Boolean)
      if (work.length) lines.push('', '**Что было сделано.**', ...work.map((item) => `- ${item}`))
    }
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
    for (const criterion of criteria.slice(0, 3)) {
      lines.push(`- **${criterion.competencyTitle}.** ${criterion.text}`)
    }
  }

  lines.push('', '## Следующий фокус', '', 'Добавьте один конкретный следующий шаг после обсуждения отчёта.')
  return lines.join('\n')
}

function nextStepFor(action, artifact, targetCriterion, currentCriterion) {
  if (action === 'idea_review') {
    if (targetCriterion) return `Добавьте в карточку один проверяемый шаг, который поможет показать следующее ожидание: «${targetCriterion.text}».`
    if (!asText(artifact.nextStep)) return 'Сформулируйте одно ближайшее действие: что вы сделаете, для кого и какой сигнал результата сохраните.'
    return 'Выполните записанный следующий шаг и сразу сохраните артефакт или наблюдение в доказательствах идеи.'
  }
  if (action === 'win_rewrite') {
    if (!asText(artifact.impact)) return 'Одним предложением объясните, что изменилось благодаря вашей работе и для кого это важно.'
    if (!asText(artifact.evidence)) return 'Добавьте одно проверяемое подтверждение результата.'
    return 'Проверьте формулировку: в ней должны остаться только факты, которые можно подтвердить.'
  }
  if (action === 'report_review') return 'Проверьте каждый выбранный win: рядом с результатом должны быть его значение и подтверждение.'
  if (action === 'growth_guidance') {
    const criterion = targetCriterion ?? currentCriterion
    return criterion ? `Выберите одну рабочую инициативу на ближайший период и сделайте в ней наблюдаемым ожидание: «${criterion.text}».` : 'Выберите одну компетенцию и создайте для неё небольшую рабочую инициативу.'
  }
  return 'Выберите один следующий шаг и сохраните его в Эскаде.'
}

export function buildLocalGuidance(action, payload) {
  const profile = payload?.profile ?? {}
  const artifact = payload?.artifact ?? {}
  const competencyIds = payload?.competencyIds ?? []
  const retrieval = retrieveCriteria({ action, profile, artifact, competencyIds })
  const currentCriteria = retrieval.criteria.filter((item) => item.level === retrieval.currentLevel)
  const targetCriteria = retrieval.targetLevel ? retrieval.criteria.filter((item) => item.level === retrieval.targetLevel) : []
  const currentCriterion = currentCriteria[0] ?? retrieval.criteria[0] ?? null
  const targetCriterion = targetCriteria[0] ?? null
  const currentLabel = levelLabels[retrieval.currentLevel]
  const targetLabel = retrieval.targetLevel ? levelLabels[retrieval.targetLevel] : 'следующий масштаб влияния'

  let headline = 'Карьерная подсказка по вашей записи'
  let evidence = evidenceForIdea(artifact)
  let draftMarkdown = null
  let rewrite = null

  if (action === 'win_rewrite') {
    headline = 'Как сделать win убедительнее'
    evidence = evidenceForWin(artifact)
    rewrite = {
      title: asText(artifact.title),
      impact: asText(artifact.impact),
      evidence: asText(artifact.evidence),
    }
  } else if (action === 'report_draft') {
    headline = 'Черновик собран из выбранных записей'
    evidence = ['Проверьте цифры, ссылки и формулировки влияния перед отправкой.', 'Удалите любой вывод, который не подтверждается вашими записями.']
    draftMarkdown = buildReportDraft(artifact, retrieval.criteria)
  } else if (action === 'report_review') {
    headline = 'Что усилить перед отправкой отчёта'
    evidence = ['У каждого сильного тезиса должно быть подтверждение.', 'Отделяйте выполненную работу от её реального эффекта.', 'Не добавляйте причинную связь, если её нельзя подтвердить.']
  } else if (action === 'growth_guidance') {
    headline = retrieval.targetLevel ? `Как двигаться от уровня «${currentLabel}» к уровню «${targetLabel}»` : 'Как расширять системное влияние'
    evidence = ['Выберите одну инициативу, где ожидание можно проявить в реальной работе.', 'Сохраните действие, результат и подтверждение — не только намерение.']
  }

  const strengths = currentCriteria.slice(0, 2).map((criterion) => cited(currentSignal(criterion, currentLabel), criterion)).filter(Boolean)
  const stretch = targetCriteria.slice(0, 2).map((criterion) => cited(stretchSignal(criterion, targetLabel), criterion)).filter(Boolean)

  return {
    headline,
    strengths,
    stretch,
    evidence: evidence.slice(0, 3),
    nextStep: nextStepFor(action, artifact, targetCriterion, currentCriterion),
    rewrite,
    draftMarkdown,
    caveat: 'Подсказка собрана локально только по шкале компетенций и вашим записям. Это ориентир для рефлексии, а не формальная оценка.',
    sources: retrieval.criteria.slice(0, 8).map(sourceFromCriterion),
    knowledgeBaseVersion,
  }
}
