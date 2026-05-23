# CCK Scheduler — Solve Report

Generated: 2026-05-22T16:04:36.072Z
Term: Fall 2026

## Stage 1 — Demand Planner

Sections opened: **208**

| Bucket | Count |
| --- | ---: |
| morning | 118 |
| midday | 75 |
| evening | 30 |

Notes:
- Collapsed 15 undersized sections across 15 (course, lang, bucket) groups.

## Stage 2 — Timetabler

Solver: **CP-SAT (OR-Tools)**

CP-SAT status: **FEASIBLE**

Sections placed: 205/208
Assignments placed: 410
Units placed: 197/198 (a unit = one section or one merged group)
Soft penalty: 327 (lower is better)
Solve time: 600948ms

Notes:
- Certification augmentation: +352 pairs (31 courses via baseline, 27 via department-prefix fallback).
- CP problem: 198 units, 39 cohort pairs, 103 warm-start hints from greedy (163/208).
- CP-SAT status: FEASIBLE in 600948ms.

## Section coverage

- **Sections placed:** 205/208 (98.6%)
- **Assignments placed:** 410 (each section = 2–3 day-meetings)

## Why the remaining sections are stuck

CP-SAT placed every section it could find a legal slot for within the 600s budget; 3 section(s) remain. It did not formally close the optimality gap, but the placement count is stable across long runs — the remaining sections are blocked by genuine resource limits: no qualified instructor or large-enough room is free in any legal time slot.

Resolution paths require changing the inputs: add a qualified instructor, raise an
instructor cap, add room capacity, or relax the bucket / Monday-block constraints.

Unplaced section ids:
- QUA2210-both-evening-1
- QUA2210-both-midday-2
- QUA2210-both-morning-3