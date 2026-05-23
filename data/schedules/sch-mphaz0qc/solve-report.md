# CCK Scheduler — Solve Report

Generated: 2026-05-23T10:47:50.723Z
Term: Fall 2026

## Stage 1 — Demand Planner

Sections opened: **229**

| Bucket | Count |
| --- | ---: |
| morning | 103 |
| midday | 70 |
| evening | 69 |

Notes:
- Collapsed 13 undersized sections across 13 (course, lang, bucket) groups.

## Stage 2 — Timetabler

Solver: **CP-SAT (OR-Tools)**

CP-SAT status: **FEASIBLE**

Sections placed: 229/229
Assignments placed: 458
Units placed: 219/219 (a unit = one section or one merged group)
Soft penalty: 217 (lower is better)
Solve time: 300959ms

Notes:
- Certification augmentation: +352 pairs (31 courses via baseline, 27 via department-prefix fallback).
- CP problem: 219 units, 43 cohort pairs, 128 warm-start hints from greedy (194/229).
- CP-SAT status: FEASIBLE in 300959ms.

## Section coverage

- **Sections placed:** 229/229 (100.0%)
- **Assignments placed:** 458 (each section = 2–3 day-meetings)

## Result

**All sections placed.** Every section opened by Stage 1 has a legal
(room, instructor, day-pattern, time-slot) assignment with no hard-rule violations.