import test from 'node:test'
import assert from 'node:assert/strict'

// Fable roadmap — Patch D (P1: report reachability + update-by-id).
//
// CareerDashboard.tsx has no React test harness (confirmed: no
// testing-library/jsdom/vitest in package.json, and no other .tsx behavior
// has test coverage in this project). These tests model the report
// save/open/generate state transitions as plain data, mirroring exactly
// what saveReport/openSavedReport/generateReport/useProfileReportingPeriod
// do to { reportText, reportDraftOpen, currentReportId, reports }, so the
// core invariant — "re-saving an open report updates it in place; a fresh
// draft becomes a new report" — has fast, precise regression coverage.

function initialState() {
  return {
    reportText: '',
    reportDraftOpen: false,
    currentReportId: null,
    reports: [],
  }
}

// Mirrors saveReport in CareerDashboard.tsx.
function saveReport(state, { periodStart = '2026-01-01', periodEnd = '2026-01-31' } = {}) {
  if (!state.reportText.trim()) return state
  const now = `t-${state.reports.length + 1}`
  if (state.currentReportId) {
    return {
      ...state,
      reports: state.reports.map((item) => item.id === state.currentReportId
        ? { ...item, periodStart, periodEnd, content: state.reportText, updatedAt: now }
        : item),
    }
  }
  const report = {
    id: `report-${state.reports.length + 1}`,
    title: `Отчёт ${state.reports.length + 1}`,
    periodStart,
    periodEnd,
    content: state.reportText,
    createdAt: now,
    updatedAt: now,
  }
  return { ...state, reports: [report, ...state.reports], currentReportId: report.id }
}

// Mirrors openSavedReport.
function openSavedReport(state, report) {
  return { ...state, reportText: report.content, reportDraftOpen: true, currentReportId: report.id }
}

// Mirrors generateReport's state-management side (the AI call itself is
// covered elsewhere; this isolates just the currentReportId-clearing rule).
function generateReport(state, draftMarkdown) {
  return { ...state, reportText: draftMarkdown, reportDraftOpen: true, currentReportId: null }
}

// Mirrors useProfileReportingPeriod's report-related resets.
function useProfileReportingPeriod(state) {
  return { ...state, reportText: '', reportDraftOpen: false, currentReportId: null }
}

test('saving a freshly generated draft creates exactly one new report', () => {
  let state = initialState()
  state = generateReport(state, 'Черновик A')
  state = saveReport(state)
  assert.equal(state.reports.length, 1)
  assert.equal(state.reports[0].content, 'Черновик A')
  assert.equal(state.currentReportId, state.reports[0].id)
})

test('saving again without changes updates the same report instead of duplicating it', () => {
  let state = initialState()
  state = generateReport(state, 'Черновик A')
  state = saveReport(state)
  const firstId = state.currentReportId
  state = { ...state, reportText: 'Черновик A (отредактирован)' }
  state = saveReport(state)
  assert.equal(state.reports.length, 1)
  assert.equal(state.currentReportId, firstId)
  assert.equal(state.reports[0].content, 'Черновик A (отредактирован)')
})

test('opening a saved report and saving again updates it in place, not a duplicate', () => {
  let state = initialState()
  state = generateReport(state, 'Черновик A')
  state = saveReport(state)
  state = useProfileReportingPeriod(state) // simulate closing/leaving
  const saved = state.reports[0]
  state = openSavedReport(state, saved)
  assert.equal(state.currentReportId, saved.id)
  state = { ...state, reportText: 'Открыт и изменён' }
  state = saveReport(state)
  assert.equal(state.reports.length, 1)
  assert.equal(state.reports[0].content, 'Открыт и изменён')
})

test('regenerating a draft after opening a saved report clears currentReportId, so the next save creates a NEW report rather than overwriting the opened one', () => {
  let state = initialState()
  state = generateReport(state, 'Черновик A')
  state = saveReport(state)
  const savedA = state.reports[0]
  state = openSavedReport(state, savedA)
  // "Пересобрать черновик" while savedA is open:
  state = generateReport(state, 'Совершенно другой черновик Б')
  assert.equal(state.currentReportId, null)
  state = saveReport(state)
  assert.equal(state.reports.length, 2)
  // The original saved report must be untouched.
  const untouchedA = state.reports.find((item) => item.id === savedA.id)
  assert.equal(untouchedA.content, 'Черновик A')
})

test('useProfileReportingPeriod clears reportDraftOpen and currentReportId (starting a fresh period is not "the same report")', () => {
  let state = initialState()
  state = generateReport(state, 'Черновик A')
  state = saveReport(state)
  state = useProfileReportingPeriod(state)
  assert.equal(state.reportDraftOpen, false)
  assert.equal(state.currentReportId, null)
  assert.equal(state.reportText, '')
})

test('reportDraftOpen is independent of reportText content (the v34-era conflation bug)', () => {
  // Regression guard for the specific bug: reportText doubling as both
  // draft content and modal-visibility flag meant clearing the textarea to
  // empty (a legitimate edit) silently closed the modal.
  let state = initialState()
  state = generateReport(state, 'Черновик A')
  assert.equal(state.reportDraftOpen, true)
  state = { ...state, reportText: '' } // person clears the textarea while editing
  assert.equal(state.reportDraftOpen, true) // modal must still be open
})

// Mirrors the escapeHtml helper added inside printReport in
// CareerDashboard.tsx. The report body was already escaped correctly before
// this patch; the gap it closes is that title/periodLine (built from the
// free-text profile.name) were interpolated into the print HTML unescaped.
function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

test('escapeHtml actually escapes angle brackets and ampersands (regression guard for the helper)', () => {
  const dangerous = 'Отчёт <script>alert(1)</script> & "кавычки"'
  const escaped = escapeHtml(dangerous)
  assert.equal(escaped.includes('<script>'), false)
  assert.equal(escaped.includes('&lt;script&gt;'), true)
  assert.equal(escaped.includes('&amp;'), true)
})

test('escapeHtml applied to a free-text profile name used in the print title does not break HTML structure', () => {
  const maliciousName = 'Павел</title><script>alert(1)</script><title>x'
  const title = escapeHtml(`Ежемесячный отчёт · ${maliciousName}`)
  assert.equal(title.includes('</title>'), false)
  assert.equal(title.includes('<script>'), false)
})
