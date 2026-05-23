# CCK Scheduler — Context for Claude Code

A two-stage academic scheduler for the Canadian College of Kuwait (CCK). Stage 1 (`stage1_demand.ts`) translates last-term enrollment +
working-student share into a section roster grouped by language and time
bucket. Stage 2 places (room, instructor, day-pattern, slot) tuples while
respecting 14 hard constraints and optimising 9 soft ones — it is an
OR-Tools **CP-SAT** model (`scripts/cp_solve.py`, fed by `cp_export.ts`),
with the hand-rolled greedy solver (`stage2_timetable.ts`) kept as a
warm-start hint source and a fallback. There is a Next.js 14 web UI in
`web/` that renders the schedule, sections, instructors, rooms, rules, and
data issues — all server-rendered from the JSON outputs.

## Stack

- **Node 22**, **TypeScript strict ESM** (`"type": "module"`) — root
- **tsx** for running TS scripts directly
- **Python 3.9+** + **OR-Tools CP-SAT** (`pip install ortools`) — Stage 2 solver
- Greedy fallback solver: hand-rolled greedy + multi-ordering + ejection-chain repair
- Ingestion: `xlsx` (SheetJS), `mammoth` (docx), `pdfjs-dist` (pdf)
- Web: **Next.js 14 App Router**, **React 18**, **Tailwind 3**, all SSR
- No database — JSON files in `data/` are the source of truth between stages

## Directory map

```
scheduler/
├── CLAUDE.md                 ← you are here
├── README.md
├── package.json              (root scripts: ingest / solve / export / dev)
├── tsconfig.json
├── scripts/
│   ├── run-ingest.ts         (parses raw spreadsheets → term-plan.json)
│   ├── run-solve.ts          (Stage 1 + Stage 2 → schedule.json + solve-report.md)
│   ├── cp_solve.py           (OR-Tools CP-SAT model — THE Stage 2 solver)
│   └── export-sis.ts         (schedule.json → cck-schedule-export.xlsx)
├── src/
│   ├── model/types.ts        ← DOMAIN MODEL, single source of truth
│   ├── ingest/               (per-source parsers; each emits an IngestReport)
│   ├── rules/catalog.ts      ← 14 hard + 9 soft rules; each has a check()
│   ├── solver/
│   │   ├── stage1_demand.ts  (enrolment forecast → Section[])
│   │   ├── cp_export.ts      (Section[] → CP problem JSON + greedy warm-start hints)
│   │   └── stage2_timetable.ts (greedy fallback / warm-start solver)
│   └── lib/                  (small helpers)
├── data/                     (generated; not committed in a real repo)
│   ├── term-plan.json        (ingestion output; ~ 4 MB)
│   ├── cp-problem.json       (CP problem handed to cp_solve.py)
│   ├── cp-result.json        (CP-SAT solve stats)
│   ├── schedule.json         (solver output; ~ 200 KB)
│   └── cck-schedule-export.xlsx
├── reports/
│   ├── ingest-report.md
│   └── solve-report.md
└── web/                      (Next.js app — its own package.json + node_modules)
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx          (dashboard)
    │   ├── schedule/         (the grid, with client-side filters)
    │   ├── sections/         (table)
    │   ├── instructors/      (table + utilization badges)
    │   ├── rooms/            (table + utilization badges)
    │   ├── rules/            (rule catalog + per-rule rejection counts)
    │   ├── issues/           (warnings grouped by code)
    │   └── globals.css       (Tailwind + CCK brand variables)
    ├── components/TopNav.tsx
    ├── lib/data.ts           (server-side JSON loader)
    ├── package.json
    ├── next.config.mjs
    ├── tailwind.config.ts
    └── tsconfig.json
```

## Key commands

From `scheduler/`:

| Command | What it does |
| --- | --- |
| `npm run ingest` | Parses every source spreadsheet/PDF/docx, writes `data/term-plan.json` + `reports/ingest-report.md` |
| `npm run solve` | Stage 1 → greedy warm start → CP-SAT (`cp_solve.py`); writes `data/schedule.json` + `reports/solve-report.md`. Up to ~10 min. |
| `npm run export` | Reads `schedule.json`, emits `data/cck-schedule-export.xlsx` matching SIS column layout |
| `npm run dev` | Proxies to `web/`; starts Next.js on http://localhost:3000 |
| `npm run typecheck` | TypeScript strict-mode check across `src/` and `scripts/` |

From `web/`:

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server, port 3000 |
| `npm run build && npm start` | Production build + serve |

## Domain model

All types live in `src/model/types.ts`. The shape is intentionally flat and
JSON-serialisable so it can round-trip through `data/term-plan.json`. Key
entities:

- `Term`, `Room`, `Instructor`, `Course`, `Section`, `Assignment`, `MajorSheet`, `MergedGroup`
- `Day = 'Sa' | 'Su' | 'M' | 'T' | 'W' | 'Th'` — Sunday is the start of the academic week
- `TimeBucket = 'morning' | 'midday' | 'evening'`
- `LecturePattern = '3x50' | '2x75' | '3x75' | '2x120' | 'lab+lecture' | 'irregular'`
- Time values are minutes since 00:00 (so `09:30` is `570`)
- `Rule` has `id`, `name`, `kind: 'hard'|'soft'`, `weight`, `check(proposed, schedule, ctx)`

Conventions:

- Slugs are `kebab-lowercase-ascii`. Instructor IDs are slugified canonical names.
- Course codes are uppercased (`ACC2201`). Room codes use the `B2-004` convention with `LAB-NNN` for labs.
- Rooms have an `aliases` array — always look up rooms via that map when matching SIS strings.
- Instructor `certifications` is an array of course codes; an empty array means **unrestricted** (H13 treats it as "can teach anything").

## Rules — adding a new one

1. Open `src/rules/catalog.ts`, add a new `Rule` after the last existing entry of the same kind.
2. The `check()` function returns `{ ok: boolean, violation?: string }`. For hard rules `ok=false` rejects; for soft rules `ok=true` always, but `violation` triggers a per-rule penalty `weight`.
3. Append the new rule to the exported `RULES` array.
4. Add a row to `web/app/rules/page.tsx`'s static `RULES` constant (it's mirrored — keeping it static avoids pulling solver code into the browser bundle).
5. Encode the rule in the CP model too — add it as a constraint in `scripts/cp_solve.py` (hard) or an objective term (soft). If it filters candidates structurally, instead bake it into `src/solver/cp_export.ts`.
6. Re-run `npm run solve` and check `reports/solve-report.md`.

## Known gaps (V0 → V1 backlog)

- **No live enrolment forecast** — Stage 1 synthesizes demand from baseline (past schedule). We need the registrar's actual Fall 2026 numbers to be more accurate.
- **No per-instructor availability windows** — the `availability_windows` field exists on `Instructor` but is empty for everyone. S1 already reads it; just needs data.
- **Two missing major sheets** — `MAJOR_MISSING` warnings for Diploma of IMD and Bachelor of Applied Science (Programming). The PDF/xlsx for these wasn't included in the source pack.
- **~150 duration deviations** in the SIS extracts (slot lengths outside the canonical {50, 75, 100, 120}). H9 currently passes them through as-is for `irregular` patterns.
- **~26 unparsed slot strings with `<br/>` separators** — these are SIS rows where one cell contains two slot strings (e.g. lab + lecture pair). We log and skip them. Fix would be a slot string splitter in `src/ingest/schedule.ts`.
- **Solver places ~205/208 sections** — the CP-SAT model proves this is the maximum; the few unplaced sections genuinely cannot fit without changing the inputs (more instructors / room capacity). The 600s `CP_TIME_LIMIT_S` in `run-solve.ts` is what reaches that ceiling — shorter limits place fewer (~185 at 90s).
- **PDF export deferred** — Use Anthropic's `docx`/`pdf` skill or wire `puppeteer` to print the schedule page when this becomes a real ask.

## Where to look first when iterating

1. **Solver issues** → `scripts/cp_solve.py` is the CP-SAT model (constraints, objective); `src/solver/cp_export.ts` builds the problem (candidate options, room/instructor compatibility, warm-start hints). `src/solver/stage2_timetable.ts` is only the greedy fallback. Note: CP-SAT presolve needs `cp_model_probing_level = 0` or it never starts searching.
2. **UI tweaks** → `web/app/<page>/page.tsx`. Every page is a Server Component; the only `'use client'` file is `web/app/schedule/ScheduleFilters.tsx`.
3. **Brand / styling** → `web/app/globals.css` (CSS variables `--cck-red`, `--cck-paper`, etc.) and `web/tailwind.config.ts` (extends with `cck` palette).
4. **Data drift** → `reports/ingest-report.md` and the `/issues` page in the UI both group every warning by code with sample rows.

## Tooling notes

- The root project is ESM (`"type": "module"`). When importing local `.ts` files in `scripts/*.ts`, use `.js` extension suffix in the import path — tsx resolves these at runtime.
- The web app is also TypeScript strict, but uses a separate `tsconfig.json` with Next's bundler resolution.
- Tailwind content paths are `app/**/*.{ts,tsx}`, `components/**/*.{ts,tsx}`, `lib/**/*.{ts,tsx}`. Add new top-level dirs there if you create them.
- The Next config has `experimental.outputFileTracingIncludes` set so the production build pulls in `../data/**` — that lets `getTermPlan()` etc. work outside of dev.
