# CCK Scheduler — Ingestion Report

Generated: 2026-05-21T03:25:30.629Z

## Summary

| Source | Rows in | Rows out | Warnings |
| --- | ---: | ---: | ---: |
| Classroom & Laboratory Capacity 2026.pdf (hardcoded) | 29 | 29 | 0 |
| /sessions/gracious-beautiful-cerf/mnt/CCK Scheduler/CCK Scheduler Docs/Fall Schedule 25-26 - SIS version.xlsx | 199 | 329 | 120 |
| /sessions/gracious-beautiful-cerf/mnt/CCK Scheduler/CCK Scheduler Docs/Spring Schedule 25-26 - SIS version.xlsx | 227 | 380 | 103 |
| Instructor Lists.xlsx + Acadamic Staff Data.xlsx + past schedules | 61 | 45 | 6 |
| Courses Details.xlsx (+ Course Descriptions.docx as reference) | 199 | 152 | 0 |
| Course Descriptions.docx | 322 | 179 | 0 |
| List With Offered Courses By Staff.xlsx | 166 | 156 | 10 |
| Major Sheets.xlsx | 300 | 8 | 2 |
| Merged Courses.xlsx | 24 | 11 | 0 |
| Equivalency - Courses List.xlsx | 470 | 470 | 0 |
| Schedule Process and Rules.docx | 26 | 12 | 0 |

Rooms: **29** · Instructors: **45** (
6 schedule-only
) · Courses: **152** · Majors: **8** ·
Merged groups: **11** · Baseline assignments: **709**

## Classroom & Laboratory Capacity 2026.pdf (hardcoded)

Notes:
- Room registry is hardcoded — rooms do not change term-to-term.
- Aliases capture every spelling observed in SIS schedules (B2-04 ≡ B2-004, "Maple Leaf" ≡ A2-147, etc).

No warnings.

## /sessions/gracious-beautiful-cerf/mnt/CCK Scheduler/CCK Scheduler Docs/Fall Schedule 25-26 - SIS version.xlsx

Notes:
- Each schedule row may have multi-day pattern; expanded into one Assignment per day.
- Slots with non-canonical durations (anything outside {50,75,100,120}) are kept but flagged.

Warnings (120):
- **DURATION_DEVIATION** (83):
  - [info] Duration 110min for ACC0012 not in canonical {50,75,100,120}
  - [info] Duration 60min for ACC0012 not in canonical {50,75,100,120}
  - [info] Duration 110min for ACC2201 not in canonical {50,75,100,120}
  - [info] Duration 110min for ACC2201 not in canonical {50,75,100,120}
  - [info] Duration 80min for ACC2202 not in canonical {50,75,100,120}
  - ... and 78 more
- **SLOT_PARSE_FAIL** (26):
  - [warn] Slot '12:00-12:50 &lt;br/&gt;12:00-13:50 &lt;br/&gt;16:00-17:50' did not parse
  - [warn] Slot '16:00-17:15 &lt;br/&gt;17:00-18:15' did not parse
  - [warn] Slot '12:30-13:45 &lt;br/&gt;13:00-14:15' did not parse
  - [warn] Slot '12:30-13:45 &lt;br/&gt;13:00-14:15' did not parse
  - [warn] Slot '10:00-11:15 &lt;br/&gt;11:00-12:15' did not parse
  - ... and 21 more
- **DAY_FIVE_DAYS** (6):
  - [warn] Implausible 5+ day week for ENL001 (raw='Su,M,T,W,Th') — likely SIS typo.
  - [warn] Implausible 5+ day week for ENL002 (raw='Su,M,T,W,Th') — likely SIS typo.
  - [warn] Implausible 5+ day week for ENL002 (raw='Su,M,T,W,Th') — likely SIS typo.
  - [warn] Implausible 5+ day week for ENL002 (raw='Su,M,T,W,Th') — likely SIS typo.
  - [warn] Implausible 5+ day week for ENL002 (raw='Su,M,T,W,Th') — likely SIS typo.
  - ... and 1 more
- **DAY_DUPLICATE** (5):
  - [warn] Duplicate day 'Th' in 'M,Th,Th'
  - [warn] Duplicate day 'Th' in 'T,Th,Th'
  - [warn] Duplicate day 'T' in 'Su,T,T'
  - [warn] Duplicate day 'W' in 'W,W,Th'
  - [warn] Duplicate day 'Su' in 'Su,Su,T'

## /sessions/gracious-beautiful-cerf/mnt/CCK Scheduler/CCK Scheduler Docs/Spring Schedule 25-26 - SIS version.xlsx

Notes:
- Each schedule row may have multi-day pattern; expanded into one Assignment per day.
- Slots with non-canonical durations (anything outside {50,75,100,120}) are kept but flagged.

Warnings (103):
- **DURATION_DEVIATION** (67):
  - [info] Duration 110min for ACC0012 not in canonical {50,75,100,120}
  - [info] Duration 110min for ACC2201 not in canonical {50,75,100,120}
  - [info] Duration 110min for ACC2201 not in canonical {50,75,100,120}
  - [info] Duration 110min for ACC2202 not in canonical {50,75,100,120}
  - [info] Duration 110min for ACC2202 not in canonical {50,75,100,120}
  - ... and 62 more
- **DAY_MISSING** (21):
  - [warn] Day column empty for CST2234
  - [warn] Day column empty for CST2355
  - [warn] Day column empty for CST2355
  - [warn] Day column empty for CST8101
  - [warn] Day column empty for CST8101
  - ... and 16 more
- **SLOT_PARSE_FAIL** (10):
  - [warn] Slot '11:30-12:20 &lt;br/&gt;12:00-12:50' did not parse
  - [warn] Slot '12:00-13:15 &lt;br/&gt;12:30-13:45' did not parse
  - [warn] Slot '10:30-11:45 &lt;br/&gt;12:00-13:15' did not parse
  - [warn] Slot '10:30-11:45 &lt;br/&gt;12:00-13:15' did not parse
  - [warn] Slot '11:00-12:15 &lt;br/&gt;11:00-12:45' did not parse
  - ... and 5 more
- **DAY_SATURDAY** (1):
  - [warn] Saturday encountered in Spring 25-26 for CST8102; will be kept but flagged.
- **METHOD_STRAY** (3):
  - [warn] Teaching Method = 'ENL' (expected Lecture|Lab) row 166
  - [warn] Teaching Method = 'ICT' (expected Lecture|Lab) row 167
  - [warn] Teaching Method = 'MAT' (expected Lecture|Lab) row 168
- **DAY_FIVE_DAYS** (1):
  - [warn] Implausible 5+ day week for FEMC101 (raw='Su,M,T,W,Th') — likely SIS typo.

## Instructor Lists.xlsx + Acadamic Staff Data.xlsx + past schedules

Notes:
- Names normalized: honorifics stripped, &apos; → ', curly apostrophes folded.
- Two source rosters merged on nameKey; conflicting fields prefer Acadamic Staff Data (richer).
- Instructors found in past schedules but absent from both rosters are flagged status=missing-from-roster.

Warnings (6):
- **INSTRUCTOR_GHOST** (6):
  - [warn] Instructor 'Hussain Jassim Mohammad Alali' appears in past schedules but is absent from both rosters — added as missing-from-roster.
  - [warn] Instructor 'Sulaiman Mohammad Alraqum' appears in past schedules but is absent from both rosters — added as missing-from-roster.
  - [warn] Instructor 'Bshaier Jasem Mohamad Al-Buloshi' appears in past schedules but is absent from both rosters — added as missing-from-roster.
  - [warn] Instructor 'Farah Faisal Fahad Al-Yaqout' appears in past schedules but is absent from both rosters — added as missing-from-roster.
  - [warn] Instructor 'Mohamad Ahmad Yousuf Dawaoud' appears in past schedules but is absent from both rosters — added as missing-from-roster.
  - ... and 1 more

## Courses Details.xlsx (+ Course Descriptions.docx as reference)

Notes:
- Course rows deduplicated by course code; programs concatenated.
- Lecture pattern derived from credits + course-code prefix; CST/CP 4-cr courses default to lab+lecture.
- Languages: 'Bilangual' (sic) and 'English & Arabic' both map to ['en','ar'].

No warnings.

## Course Descriptions.docx

Notes:
- Reference text only; not used by the solver. Indexed by course code.

No warnings.

## List With Offered Courses By Staff.xlsx

Notes:
- Course names matched to codes via normalized lowercase keys.
- Rows where either the instructor or the course name fail to resolve are dropped with a warning.

Warnings (10):
- **CERT_COURSE_UNRESOLVED** (10):
  - [info] Course 'Technologies ,Cultures &Societies' not in catalog (instructor 'Mrs. Rana Khan Moh'd Ishaque').
  - [info] Course 'Technologies ,Cultures &Societies' not in catalog (instructor 'Mrs. Rana Khan Moh'd Ishaque').
  - [info] Course 'Cross-Platform Design' not in catalog (instructor 'Tareq Ahmad Ali Al-Zayyat').
  - [info] Course 'Cross-Platform Design' not in catalog (instructor 'Tareq Ahmad Ali Al-Zayyat').
  - [info] Course 'Intro to Comp Programming using Python' not in catalog (instructor 'Ms. Abrar Maneef  Al-Enezi').
  - ... and 5 more

## Major Sheets.xlsx

Notes:
- Each sheet parsed as two-column-pair layout (left semester, right semester).
- Course codes captured from the first column of each pair; titles from the second.
- Diploma sheets cover semesters 1–4; Bachelor sheets start at semester 5 (they assume a completed diploma).

Warnings (2):
- **MAJOR_MISSING** (2):
  - [warn] Program 'Diploma of Interactive Media Design (IMD)' has no plan-of-study sheet in source.
  - [warn] Program 'Bachelor of Applied Science - Computer Science (Programming)' has no plan-of-study sheet in source.

## Merged Courses.xlsx

Notes:
- Group string parsed on '+' (whitespace-tolerant) and uppercased.
- Duplicate groups (same member set) collapsed into one MergedGroup.

No warnings.

## Equivalency - Courses List.xlsx

Notes:
- Read shape only; not integrated into scheduler logic in V0.

No warnings.

## Schedule Process and Rules.docx

Notes:
- Reference text for the AI explainer; not used directly by the solver.

No warnings.

## Schedule-only instructors (missing from both rosters)

- Hussain Jassim Mohammad Alali
- Sulaiman Mohammad Alraqum
- Bshaier Jasem Mohamad Al-Buloshi
- Farah Faisal Fahad Al-Yaqout
- Mohamad Ahmad Yousuf Dawaoud
- Saad Ali Husain Kakouli
