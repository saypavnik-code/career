# Career OS — product roadmap

Patch marker: `career-os-dashboard-v3`

## 1. Vision

Career OS is a personal career operating system that connects five things that are usually fragmented:

1. career context and goals;
2. a competency map;
3. tasks that intentionally develop those competencies;
4. wins that prove growth;
5. reflection that updates the next cycle.

The central product shift is:

> Old task logic -> a new task model where every meaningful action is linked to a competency and a potential win.

The source model contains 12 Digital Marketing competencies and three maturity levels:

- Specialist: reliable execution inside established strategy and processes;
- Senior Specialist: independent ownership, hypothesis-driven improvement and measurable results;
- Lead Specialist: systems, standards, long-term decisions, mentoring and regional responsibility.

## 2. Product model

### User

- profile, role, market and professional context;
- current career goal and review cycle;
- current and target competency scores.

### Competency

- stable identifier and domain;
- Specialist / Senior / Lead behavioural criteria;
- current score, target score and evidence;
- linked tasks and wins.

### Task

Types: learning, delivery, experiment, networking and leadership.

Every task has:

- competency link;
- status and due date;
- expected result;
- potential win.

### Win

A win is a first-class entity, not a completed-task label. It includes:

- what changed;
- business or team impact;
- evidence;
- related competencies;
- date and cycle.

### Reflection

A review closes the loop and updates the next plan:

`diagnosis -> plan -> execution -> win -> reflection -> new diagnosis`

## 3. Core flows

### Onboarding

Input: role, market, current context and career goal.

Steps: choose context -> assess the competency map -> set a target cycle.

Output: an initial competency profile and priorities.

### Diagnosis

Input: 12 competencies with behavioural criteria.

Steps: self-score -> compare against target -> identify gaps -> select focus areas.

Output: a prioritised competency roadmap.

### Planning

Input: priority gaps.

Steps: add tasks -> choose task type -> link competency -> define potential win -> set cadence.

Output: an executable development plan.

### Execution

Input: planned tasks.

Steps: move work through statuses -> create evidence -> record wins.

Output: observable progress and a growing evidence ledger.

### Reflection

Input: wins, incomplete tasks, score changes and blockers.

Steps: weekly review -> update scores -> remove low-value tasks -> create next actions.

Output: revised plan and competency levels.

## 4. Delivery phases

### Phase 1 — Foundations (implemented by this patch)

Outcomes:

- the 12-competency model is represented in product data;
- the old isolated task concept is replaced by competency-linked tasks;
- wins exist as a separate entity with impact and evidence;
- a coherent navigation and visual system is available at `/career`.

Acceptance:

- all screens use the same competency IDs;
- a task cannot be created without a competency and potential win;
- a win cannot be created without impact and evidence.

### Phase 2 — Core product MVP (front-end implemented, backend pending)

Outcomes:

- onboarding;
- competency diagnosis;
- task plan;
- wins ledger;
- weekly reflection;
- browser persistence.

Backend deliverables:

- authenticated user profiles;
- Postgres tables for profiles, competencies, assessments, tasks, wins and reviews;
- row-level security;
- server-side validation and audit history.

### Phase 3 — Intelligence

Outcomes:

- AI-generated tasks based on role, gap and target;
- evidence quality scoring;
- recommendations that distinguish learning from real responsibility expansion;
- manager review and calibration;
- growth analytics by cycle.

### Phase 4 — Ecosystem

Outcomes:

- Google Calendar / Outlook integration;
- task-manager integrations;
- shareable career review;
- team competency heatmaps;
- anonymised career patterns and role tracks.

## 5. Metrics

### User

- percentage of priority competencies with active tasks;
- score delta per cycle;
- wins with evidence;
- completed development tasks;
- ratio of delivery/experiment tasks to learning-only tasks.

### Product

- onboarding completion;
- completed diagnosis -> plan -> execution -> reflection cycles;
- weekly active users;
- time to first task and first win;
- reflection completion rate.

### Migration quality

- no legacy task form creates an unlinked task;
- all tests and forms use the shared competency IDs;
- all wins include evidence and impact;
- no competency-level criteria are duplicated in UI code.

## 6. Information architecture

Primary navigation:

- Overview;
- Competencies;
- Development plan;
- Wins;
- Reflection.

Dashboard outcomes:

- show the current career level and cycle;
- explain the three highest competency gaps;
- surface the current week's actions;
- show recent proof of impact;
- guide the next review.

## 7. Technical note

This patch intentionally ships as an isolated Next.js App Router module with no new dependencies. It stores data in `localStorage` so the complete product loop can be tested before schema and authentication decisions are made.

Production hardening should replace browser persistence with a typed server repository. The UI and domain vocabulary are already separated into `career-data.ts`, so the backend can be introduced without redesigning the screens.
