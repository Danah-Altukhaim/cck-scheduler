// Canonical room registry, hardcoded from Classroom & Laboratory Capacity 2026.pdf.
// The schedule files use 3+ different naming conventions ('B2-04', 'B2-004',
// 'Lab B2-031', 'Maple Leaf'). We resolve all of them to this registry.
//
// PDF source rooms (verbatim spellings):
//   Ground floor classrooms: BG-023..BG-027 (capacities 35,35,35,32,35)
//   First floor classrooms:  B1-023..B1-027 (35,35,35,32,35)
//   Second floor classrooms: B2-023..B2-027 (35,35,35,32,35) + 2 nameless rooms (30,30)
//   Halls: Al Nuwair B1-004 (83), Al Jahra B2-004 (45), Al Wafra B2-006 (45),
//          Maple Leaf A2-147 (60)
//   Labs (1st floor): LAB-015..LAB-016, LAB-031..LAB-032 (each 24)
//   Labs (2nd floor): B2-015, B2-016, B2-031, B2-032 (each 40)

import type { Room, IngestReport } from '../model/types.js'
import { warn } from '../lib/util.js'

export function loadRooms(): { rooms: Room[]; report: IngestReport } {
  const report: IngestReport = {
    source: 'Classroom & Laboratory Capacity 2026.pdf (hardcoded)',
    rows_in: 0,
    rows_out: 0,
    warnings: [],
    notes: [
      'Room registry is hardcoded — rooms do not change term-to-term.',
      'Aliases capture every spelling observed in SIS schedules (B2-04 ≡ B2-004, "Maple Leaf" ≡ A2-147, etc).',
    ],
  }

  const rooms: Room[] = [
    // Ground floor classrooms
    room('BG-023', 35, 'ground', 'lecture'),
    room('BG-024', 35, 'ground', 'lecture'),
    room('BG-025', 35, 'ground', 'lecture', ['BG-25']),
    room('BG-026', 32, 'ground', 'lecture', ['BG-26']),
    room('BG-027', 35, 'ground', 'lecture'),

    // First floor classrooms
    room('B1-023', 35, 'first', 'lecture'),
    room('B1-024', 35, 'first', 'lecture'),
    room('B1-025', 35, 'first', 'lecture'),
    room('B1-026', 32, 'first', 'lecture'),
    room('B1-027', 35, 'first', 'lecture'),

    // Second floor classrooms
    room('B2-023', 35, 'second', 'lecture'),
    room('B2-024', 35, 'second', 'lecture'),
    room('B2-025', 35, 'second', 'lecture'),
    room('B2-026', 32, 'second', 'lecture'),
    room('B2-027', 35, 'second', 'lecture'),
    room('B2-028', 30, 'second', 'lecture', [], 'Unnamed second-floor room #1'),
    room('B2-029', 30, 'second', 'lecture', [], 'Unnamed second-floor room #2'),

    // Halls (special seating, large)
    room('B1-004', 83, 'first', 'special', ['Al Nuwair', 'Al Nuwair B1-004'], 'Al Nuwair'),
    room('B2-004', 45, 'second', 'special', ['Al Jahra', 'Al Jahra B2-004', 'B2-04'], 'Al Jahra'),
    room('B2-006', 45, 'second', 'special', ['Al Wafra', 'Al Wafra B2-006', 'B2-06'], 'Al Wafra'),
    room('A2-147', 60, 'second', 'special', ['Maple Leaf', 'Maple Leaf A2-147'], 'Maple Leaf'),

    // First-floor labs (24 each)
    room('LAB-015', 24, 'first', 'lab', ['Lab B1-015', 'B1-015']),
    room('LAB-016', 24, 'first', 'lab', ['Lab B1-016', 'B1-016']),
    room('LAB-031', 24, 'first', 'lab', ['Lab B1-031', 'B1-031']),
    room('LAB-032', 24, 'first', 'lab', ['Lab B1-032', 'B1-032']),

    // Second-floor labs (40 each) — schedule files use 'B2-031' for these
    room('LAB-B2-015', 40, 'second', 'lab', ['LAB B2-015', 'B2-015', 'Lab B2-015']),
    room('LAB-B2-016', 40, 'second', 'lab', ['LAB B2 - 016', 'LAB B2-016', 'B2-016', 'Lab B2-016']),
    room('LAB-B2-031', 40, 'second', 'lab', ['LAB B2 - 031', 'LAB B2-031', 'B2-031', 'Lab B2-031']),
    room('LAB-B2-032', 40, 'second', 'lab', ['LAB B2 - 032', 'LAB B2-032', 'B2-032', 'Lab B2-032']),
  ]

  // Sanity warn if duplicate codes
  const seen = new Set<string>()
  for (const r of rooms) {
    if (seen.has(r.code)) {
      report.warnings.push(warn('error', 'ROOM_DUPLICATE', `Duplicate room code ${r.code}`))
    }
    seen.add(r.code)
  }

  report.rows_in = rooms.length
  report.rows_out = rooms.length
  return { rooms, report }
}

function room(
  code: string,
  capacity: number,
  floor: Room['floor'],
  type: Room['type'],
  aliases: string[] = [],
  displayName?: string,
): Room {
  return {
    code,
    display_name: displayName ? `${displayName} (${code})` : code,
    aliases: [...new Set([code, ...aliases])],
    type,
    floor,
    capacity,
  }
}

// Look up a room by any alias or canonical code. Returns null if unmatched.
// This is exported so the schedule ingester can canonicalize 'Building one/B2-04'
// to 'B2-004'.
export function resolveRoom(rooms: Room[], rawKey: string): Room | null {
  if (!rawKey) return null
  const upper = rawKey.toUpperCase().trim()
  for (const r of rooms) {
    if (r.code.toUpperCase() === upper) return r
    for (const a of r.aliases) {
      if (a.toUpperCase() === upper) return r
    }
  }
  // Try aggressive normalization: drop spaces and dashes, then compare.
  const squash = (s: string) => s.toUpperCase().replace(/[\s\-]/g, '')
  const target = squash(upper)
  for (const r of rooms) {
    if (squash(r.code) === target) return r
    for (const a of r.aliases) if (squash(a) === target) return r
  }
  // Last-ditch: try padding short forms ('B2-04' → 'B2-004').
  const padded = upper.replace(/-(\d{1,2})$/, (_, n) => '-' + n.padStart(3, '0'))
  if (padded !== upper) return resolveRoom(rooms, padded)
  return null
}
