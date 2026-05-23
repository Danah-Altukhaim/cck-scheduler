# CCK AI Scheduler

A two-stage academic scheduler for the Canadian College of Kuwait (CCK).
Reads the raw spreadsheets/PDFs/docs CCK already uses, produces a sat (or
explained-partial) timetable for the next term, and ships with a web UI for
inspection.

## What it does

1. **Ingests** every source document — Classroom & Lab Capacity, SIS schedule
   extracts, Instructor List, Academic Staff Data, Courses Details, Course
   Descriptions, Major Sheets, Merged Courses, Equivalency, Schedule Process
   & Rules — and normalizes everything into one canonical `term-plan.json`.
2. **Solves** in two stages:
   - **Stage 1 (Demand Planner)** — projects last-term enrollment into a
     section roster (208 sections for Fall 2026, split morning / midday /
     evening).
   - **Stage 2 (Timetabler)** — an OR-Tools **CP-SAT** model places each
     section's (room, instructor, day-pattern, time-slot) tuple while
     satisfying 14 hard rules (capacity, certifications, double-booking,
     daily/weekly caps, Monday 11:00 reserved block, language match, cohort
     no-conflict, …) and optimizing 9 soft ones (compact teaching, evening
     for working students, GE in core hours, …). A greedy solver provides a
     warm start and a fallback when OR-Tools is unavailable.
3. **Renders** the result in a Next.js app with seven pages: a dashboard,
   the schedule grid, sections, instructors, rooms, rules catalog, and a
   data-quality issues page.
4. **Exports** the schedule back out to an SIS-compatible xlsx workbook.

## Quickstart

Prereqs: Node 22+, Python 3.9+ with OR-Tools (`pip install ortools`). If
OR-Tools is missing, Stage 2 falls back to the greedy solver automatically.

```bash
# From the repo root
cd scheduler

# 0. Install the CP-SAT solver backend
pip install ortools

# 1. Install root dependencies (solver + ingester)
npm install

# 2. Run the ingestion (parses every source file under ../CCK Scheduler Docs/)
npm run ingest
#   → data/term-plan.json  (~4 MB)
#   → reports/ingest-report.md

# 3. Solve (greedy warm start, then CP-SAT — up to ~10 min)
npm run solve
#   → data/schedule.json
#   → data/cp-problem.json, data/cp-result.json
#   → reports/solve-report.md

# 4. Export to xlsx
npm run export
#   → data/cck-schedule-export.xlsx

# 5. Install + start the web UI
cd web
npm install
cd ..
npm run dev
# → http://localhost:3000
```

## The web UI

| Page          | What's there |
| ------------- | ------------ |
| `/`           | KPIs, last solve timestamp, top data issues, quick links |
| `/schedule`   | Days × time grid; filter by room, instructor, or department |
| `/sections`   | All 208 sections, sortable, placed vs unplaced |
| `/instructors`| 45 instructors, rank, dept, weekly cap, hours assigned, utilization |
| `/rooms`      | 29 rooms, capacity, hours used, utilization |
| `/rules`      | 14 hard + 9 soft rules, rejection counts from latest solve |
| `/issues`     | Every ingestion warning grouped by code with sample rows |

All pages are server-rendered from the JSON outputs — there's no database
and no client-side fetching. Re-running the solver immediately changes
what the UI shows on the next request.

## Current state

- 29 rooms, 45 instructors (incl. 6 schedule-only "ghost" instructors), 152 courses, 8 majors
- 208 sections opened by Stage 1
- **~205 of 208 sections placed** by the CP-SAT solver, with zero hard-rule violations
- CP-SAT proves the placement count is at its maximum — the few remaining sections cannot be scheduled without changing the inputs (more instructors / room capacity). See `reports/solve-report.md`.

## Architecture (1-paragraph)

`src/ingest/*.ts` turns raw documents into the typed entities in
`src/model/types.ts`. `src/solver/stage1_demand.ts` projects demand;
`src/solver/cp_export.ts` turns the Stage-1 roster into a CP problem and
`scripts/cp_solve.py` solves it with OR-Tools CP-SAT
(`src/solver/stage2_timetable.ts` is the greedy warm-start / fallback).
`src/rules/catalog.ts` holds every constraint as a `Rule` object with a
`check()` function. The solver writes JSON to `data/`; the Next.js app in
`web/` reads it at request time. See `CLAUDE.md` for conventions and how to
extend.

## Roadmap

- PDF export of the printable schedule (use the `pdf` Anthropic skill or
  spin up Puppeteer)
- Per-instructor availability windows (data already modelled)
- Live enrolment forecast from the registrar
- Saturday operating-week toggle
- Per-section infeasibility diagnosis (why each unplaced section can't fit)
