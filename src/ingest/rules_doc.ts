// Extract prose rule snippets from 'Schedule Process and Rules.docx' for the
// AI explainer. NOT loaded as constraints — those live in rules/catalog.ts.

import mammoth from 'mammoth'
import type { IngestReport } from '../model/types.js'
import { warn } from '../lib/util.js'

const RULE_TAGS: { id: string; needles: string[] }[] = [
  { id: 'monday_block', needles: ['Monday from 11:00 to 12:00', 'fixed time slot reserved'] },
  { id: 'daily_cap', needles: ['maximum teaching load per academic per day is 6 hours'] },
  { id: 'student_credit_cap', needles: ['Maximum course load per student is 23 credits'] },
  { id: 'puc_min', needles: ['PUC students must register'] },
  { id: 'self_funded_range', needles: ['Self-funded students may register'] },
  { id: 'duration_3cr', needles: ['3-credit courses'] },
  { id: 'duration_4cr', needles: ['4-credit courses'] },
  { id: 'cp_iawd_split', needles: ['CP and IAWD'] },
  { id: 'merged_courses', needles: ['merged courses', 'dual codes'] },
  { id: 'cohort_no_conflict', needles: ['students following the major sheet plan'] },
  { id: 'room_capacity', needles: ['Match the number of students'] },
  { id: 'independent_sections', needles: ['independent sections'] },
]

export async function loadRulesDoc(path: string): Promise<{
  snippets: Record<string, string>
  report: IngestReport
}> {
  const report: IngestReport = {
    source: 'Schedule Process and Rules.docx',
    rows_in: 0,
    rows_out: 0,
    warnings: [],
    notes: ['Reference text for the AI explainer; not used directly by the solver.'],
  }
  const snippets: Record<string, string> = {}
  try {
    const { value: text } = await mammoth.extractRawText({ path })
    const paragraphs = text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
    report.rows_in = paragraphs.length
    for (const tag of RULE_TAGS) {
      const found = paragraphs.find((p) =>
        tag.needles.some((n) => p.toLowerCase().includes(n.toLowerCase())),
      )
      if (found) {
        snippets[tag.id] = found
      } else {
        report.warnings.push(
          warn('info', 'RULE_SNIPPET_MISSING', `No paragraph matched tag '${tag.id}'.`),
        )
      }
    }
    report.rows_out = Object.keys(snippets).length
  } catch (e) {
    report.warnings.push(
      warn('error', 'RULES_DOC_READ_FAIL', `Failed to read rules docx: ${String(e)}`),
    )
  }
  return { snippets, report }
}
