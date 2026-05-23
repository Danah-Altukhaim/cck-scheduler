#!/usr/bin/env python3
"""CCK Scheduler — Stage 2 timetabler, CP-SAT backend.

Reads the CP problem produced by src/solver/cp_export.ts, builds an OR-Tools
CP-SAT model, and writes schedule.json + cp-result.json.

Model (one "unit" = one section, or one collapsed merged group):
  placed[u]            unit is in the schedule
  opt[u][k]            unit uses slot-option k (day-pattern + start)
  useRoom[u][r]        unit uses room r
  useInst[u][i]        unit uses instructor i
  startVar[u]          start minute (= the chosen option's start)
  meets[u][d]          unit has a meeting on day d

Hard rules:
  H1/H2  per-(resource, day) NoOverlap of optional intervals
  H6     per-(cohort pair, day) NoOverlap
  H8/H10 linear daily / weekly minute caps per instructor
  H3/H4/H5/H7/H9/H12/H13/H14 already baked into the exported problem

Objective: maximise placed units (dominant weight), then minimise the sum of
option-local soft penalties (bucket spill, GE core hours, working-student
evening).
"""

import json
import sys
import time

from ortools.sat.python import cp_model

PLACE_WEIGHT = 1000  # each placed unit is worth far more than any soft penalty


class _ProgressLogger(cp_model.CpSolverSolutionCallback):
    """Logs placement count + elapsed time on every improving solution, so a
    single run reveals how fast the search converges."""

    def __init__(self, placed_vars):
        super().__init__()
        self._placed = list(placed_vars)
        self._t0 = time.time()

    def on_solution_callback(self):
        placed = sum(int(self.Value(v)) for v in self._placed)
        print(
            f"  [progress] {time.time() - self._t0:6.1f}s  "
            f"placed={placed}/{len(self._placed)}  obj={self.ObjectiveValue():.0f}",
            flush=True,
        )


def solve(problem_path, schedule_path, result_path, time_limit_s):
    with open(problem_path, "r", encoding="utf-8") as fh:
        prob = json.load(fh)

    term = prob["term"]
    days = list(term["operating_days"])
    day_index = {d: i for i, d in enumerate(days)}
    rooms = prob["rooms"]
    instructors = prob["instructors"]
    units = prob["units"]
    cohort_pairs = prob["cohort_pairs"]
    custom_rules = prob.get("custom_rules", [])

    # Lookups for resolving custom-rule references to model entities.
    inst_index = {ins["id"]: i for i, ins in enumerate(instructors)}
    room_index = {rm["code"]: i for i, rm in enumerate(rooms)}
    units_by_course = {}
    unit_by_id = {}
    for u in units:
        units_by_course.setdefault(u["course_code"], []).append(u["id"])
        unit_by_id[u["id"]] = u

    # Custom "courses must not overlap" rules become extra unit pairs handled
    # alongside the cohort no-conflict constraint.
    custom_no_overlap = []
    for rule in custom_rules:
        if rule["type"] != "no_overlap_pair":
            continue
        p = rule["params"]
        for ua in units_by_course.get(p.get("course_a"), []):
            for ub in units_by_course.get(p.get("course_b"), []):
                if ua != ub:
                    custom_no_overlap.append((ua, ub))

    model = cp_model.CpModel()

    placed = {}
    opt = {}            # u_id -> list[BoolVar] per option
    use_room = {}       # u_id -> {room_index: BoolVar}
    use_inst = {}       # u_id -> {inst_index: BoolVar}
    start_var = {}
    meets = {}          # u_id -> {day_index: BoolVar}

    # Room / instructor optional intervals, bucketed by (resource, day).
    room_intervals = {}   # (room_index, day_index) -> list[interval]
    inst_intervals = {}   # (inst_index, day_index) -> list[interval]
    inst_day_load = {}    # (inst_index, day_index) -> list[(BoolVar, minutes)]
    inst_week_load = {}   # inst_index -> list[(BoolVar, minutes)]
    cohort_intervals = {}  # (u_id, day_index) -> interval

    win_start = term["operating_window"]["start_min"]
    win_end = term["operating_window"]["end_min"]

    cohort_unit_ids = set()
    for a, b in cohort_pairs:
        cohort_unit_ids.add(a)
        cohort_unit_ids.add(b)
    for a, b in custom_no_overlap:
        cohort_unit_ids.add(a)
        cohort_unit_ids.add(b)

    for u in units:
        uid = u["id"]
        p = model.NewBoolVar(f"placed_{uid}")
        placed[uid] = p

        options = u["options"]
        room_idx = u["room_indices"]
        inst_idx = u["instructor_indices"]

        # A unit with no option / room / instructor can never be placed.
        if not options or not room_idx or not inst_idx:
            model.Add(p == 0)
            opt[uid] = []
            use_room[uid] = {}
            use_inst[uid] = {}
            start_var[uid] = model.NewConstant(0)
            meets[uid] = {}
            continue

        ovars = [model.NewBoolVar(f"opt_{uid}_{k}") for k in range(len(options))]
        opt[uid] = ovars
        model.Add(sum(ovars) == p)

        rvars = {r: model.NewBoolVar(f"room_{uid}_{r}") for r in room_idx}
        use_room[uid] = rvars
        model.Add(sum(rvars.values()) == p)

        ivars = {i: model.NewBoolVar(f"inst_{uid}_{i}") for i in inst_idx}
        use_inst[uid] = ivars
        model.Add(sum(ivars.values()) == p)

        sv = model.NewIntVar(0, win_end, f"start_{uid}")
        start_var[uid] = sv
        model.Add(sv == sum(ovars[k] * options[k]["start_min"] for k in range(len(options))))

        # meets[u][d] = OR of options that include day d.
        mvars = {}
        for d, di in day_index.items():
            opts_on_d = [ovars[k] for k, o in enumerate(options) if d in o["days"]]
            if not opts_on_d:
                continue
            mv = model.NewBoolVar(f"meets_{uid}_{di}")
            model.AddMaxEquality(mv, opts_on_d)
            mvars[di] = mv
        meets[uid] = mvars

        dur = u["per_meeting_min"]

        # Room intervals — H2.
        for r in room_idx:
            for di, mv in mvars.items():
                pr = model.NewBoolVar(f"prRoom_{uid}_{r}_{di}")
                model.Add(pr <= rvars[r])
                model.Add(pr <= mv)
                model.Add(pr >= rvars[r] + mv - 1)
                iv = model.NewOptionalFixedSizeIntervalVar(sv, dur, pr, f"ivRoom_{uid}_{r}_{di}")
                room_intervals.setdefault((r, di), []).append(iv)

        # Instructor intervals + cap bookkeeping — H1, H8, H10.
        for i in inst_idx:
            for di, mv in mvars.items():
                pi = model.NewBoolVar(f"prInst_{uid}_{i}_{di}")
                model.Add(pi <= ivars[i])
                model.Add(pi <= mv)
                model.Add(pi >= ivars[i] + mv - 1)
                iv = model.NewOptionalFixedSizeIntervalVar(sv, dur, pi, f"ivInst_{uid}_{i}_{di}")
                inst_intervals.setdefault((i, di), []).append(iv)
                inst_day_load.setdefault((i, di), []).append((pi, dur))
            inst_week_load.setdefault(i, []).append((ivars[i], u["weekly_min"]))

        # Cohort intervals — H6 (only for units involved in a cohort pair).
        if uid in cohort_unit_ids:
            for di, mv in mvars.items():
                iv = model.NewOptionalFixedSizeIntervalVar(sv, dur, mv, f"ivCohort_{uid}_{di}")
                cohort_intervals[(uid, di)] = iv

    # H1 / H2 — no double-booking.
    for ivs in room_intervals.values():
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)
    for ivs in inst_intervals.values():
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)

    # H8 — daily teaching cap.
    for (i, di), loads in inst_day_load.items():
        cap = instructors[i]["daily_cap_min"]
        model.Add(sum(b * m for b, m in loads) <= cap)

    # H10 — weekly teaching cap.
    for i, loads in inst_week_load.items():
        cap = instructors[i]["weekly_cap_min"]
        model.Add(sum(b * m for b, m in loads) <= cap)

    # H6 — cohort no-conflict (+ custom no_overlap_pair rules).
    for a, b in list(cohort_pairs) + custom_no_overlap:
        for di in day_index.values():
            iv_a = cohort_intervals.get((a, di))
            iv_b = cohort_intervals.get((b, di))
            if iv_a is not None and iv_b is not None:
                model.AddNoOverlap([iv_a, iv_b])

    # Custom rules — instructor unavailability, room holds, course time windows.
    def _overlaps(o, rs, re_):
        return o["start_min"] < re_ and rs < o["end_min"]

    prefer_soft = []  # (BoolVar, weight) — soft penalty terms from prefer_time
    for rule in custom_rules:
        rt = rule["type"]
        p = rule.get("params", {})
        if rt == "instructor_unavailable":
            i = inst_index.get(p.get("instructor_id"))
            if i is None:
                continue
            rdays, rs, re_ = set(p.get("days", [])), p.get("startMin", 0), p.get("endMin", 0)
            for u in units:
                uid = u["id"]
                if i not in use_inst.get(uid, {}):
                    continue
                for k, o in enumerate(u["options"]):
                    if rdays and not (rdays & set(o["days"])):
                        continue
                    if _overlaps(o, rs, re_) and k < len(opt[uid]):
                        model.AddBoolOr([opt[uid][k].Not(), use_inst[uid][i].Not()])
        elif rt == "room_reserved":
            r = room_index.get(p.get("room_code"))
            if r is None:
                continue
            rdays, rs, re_ = set(p.get("days", [])), p.get("startMin", 0), p.get("endMin", 0)
            for u in units:
                uid = u["id"]
                if r not in use_room.get(uid, {}):
                    continue
                for k, o in enumerate(u["options"]):
                    if rdays and not (rdays & set(o["days"])):
                        continue
                    if _overlaps(o, rs, re_) and k < len(opt[uid]):
                        model.AddBoolOr([opt[uid][k].Not(), use_room[uid][r].Not()])
        elif rt == "course_time_window":
            rs, re_ = p.get("startMin", 0), p.get("endMin", 24 * 60)
            for uid in units_by_course.get(p.get("course_code"), []):
                u = unit_by_id[uid]
                for k, o in enumerate(u["options"]):
                    if (o["start_min"] < rs or o["end_min"] > re_) and k < len(opt[uid]):
                        model.Add(opt[uid][k] == 0)
        elif rt == "prefer_time":
            rs, re_ = p.get("startMin", 0), p.get("endMin", 24 * 60)
            w = int(p.get("weight", 3) or 3)
            for uid in units_by_course.get(p.get("course_code"), []):
                u = unit_by_id[uid]
                for k, o in enumerate(u["options"]):
                    if (o["start_min"] < rs or o["end_min"] > re_) and k < len(opt[uid]):
                        prefer_soft.append((opt[uid][k], w))

    # Objective — maximise placements, then minimise soft penalties.
    soft_terms = []
    for u in units:
        uid = u["id"]
        for k, o in enumerate(u["options"]):
            if o["soft_penalty"] and k < len(opt[uid]):
                soft_terms.append(opt[uid][k] * o["soft_penalty"])
    model.Maximize(
        PLACE_WEIGHT * sum(placed.values())
        - sum(soft_terms)
        - sum(b * w for b, w in prefer_soft)
    )

    # Warm start — seed CP-SAT with the greedy solver's solution so it begins
    # from a known-good schedule and only ever improves on it.
    hint_count = 0
    for h in prob.get("hints", []):
        uid = h["unit_id"]
        if uid not in opt or not opt[uid]:
            continue
        k, r, i = h["option"], h["room"], h["instructor"]
        if k >= len(opt[uid]):
            continue
        model.AddHint(placed[uid], 1)
        model.AddHint(opt[uid][k], 1)
        if r in use_room[uid]:
            model.AddHint(use_room[uid][r], 1)
        if i in use_inst[uid]:
            model.AddHint(use_inst[uid][i], 1)
        hint_count += 1

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit_s)
    solver.parameters.num_search_workers = 8
    # Probing in presolve is pathologically slow on this model and never
    # finishes; disabling it lets the search actually run.
    solver.parameters.cp_model_probing_level = 0
    t0 = time.time()
    status = solver.Solve(model, _ProgressLogger(placed.values()))
    elapsed_ms = int((time.time() - t0) * 1000)

    status_name = solver.StatusName(status)
    feasible = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)

    assignments = []
    units_placed = 0
    sections_placed = 0
    sections_total = sum(len(u["member_section_ids"]) for u in units)
    soft_penalty = 0
    unplaced_units = []

    if feasible:
        for u in units:
            uid = u["id"]
            if not opt[uid] or solver.Value(placed[uid]) < 1:
                unplaced_units.append(uid)
                continue
            units_placed += 1
            chosen_opt = next(
                (o for k, o in enumerate(u["options"]) if solver.Value(opt[uid][k]) > 0),
                None,
            )
            chosen_room = next(
                (rooms[r]["code"] for r, v in use_room[uid].items() if solver.Value(v) > 0),
                None,
            )
            chosen_inst = next(
                (instructors[i]["id"] for i, v in use_inst[uid].items() if solver.Value(v) > 0),
                None,
            )
            if chosen_opt is None or chosen_room is None or chosen_inst is None:
                unplaced_units.append(uid)
                units_placed -= 1
                continue
            soft_penalty += chosen_opt["soft_penalty"]
            for sid in u["member_section_ids"]:
                sections_placed += 1
                for day in chosen_opt["days"]:
                    assignments.append({
                        "section_id": sid,
                        "day": day,
                        "start_min": chosen_opt["start_min"],
                        "end_min": chosen_opt["end_min"],
                        "room_code": chosen_room,
                        "instructor_id": chosen_inst,
                        "pinned": False,
                        "source": "solver",
                    })

    with open(schedule_path, "w", encoding="utf-8") as fh:
        json.dump({"term": term, "assignments": assignments}, fh, indent=2)

    result = {
        "status": status_name,
        "feasible": feasible,
        "units_total": len(units),
        "units_placed": units_placed,
        "sections_total": sections_total,
        "sections_placed": sections_placed,
        "assignments": len(assignments),
        "soft_penalty": soft_penalty,
        "objective": solver.ObjectiveValue() if feasible else 0,
        "best_bound": solver.BestObjectiveBound() if feasible else 0,
        "elapsed_ms": elapsed_ms,
        "unplaced_unit_ids": unplaced_units,
    }
    with open(result_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)

    print(
        f"CP-SAT {status_name}: {sections_placed}/{sections_total} sections, "
        f"{len(assignments)} assignments, soft={soft_penalty}, "
        f"{hint_count} hints, {elapsed_ms}ms"
    )
    return 0 if feasible else 1


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("usage: cp_solve.py <problem.json> <schedule.json> <result.json> <time_limit_s>")
        sys.exit(2)
    sys.exit(solve(sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])))
