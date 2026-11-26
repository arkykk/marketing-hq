// Pure logic for the Home page: what needs Arcadie now, the 14-day timeline and the tool limits.
import type { Channel, PlanRow, Post, Tool } from './data'
import { dayKey } from './format'

export const VISUAL = new Set(['instagram', 'instagram_facebook', 'tiktok', 'facebook'])

/** Claude's own scheduled runs, shown on the timeline (Madrid time). 0 = Sunday. */
export const RUNS: { weekday: number; time: string; text: string }[] = [
  { weekday: 0, time: '17:31', text: 'Claude writes next week’s drafts. They land in Needs you.' },
  { weekday: 1, time: '11:56', text: 'Claude schedules everything you approved.' },
]

export function toolOf(p: Pick<Post, 'tool' | 'channel'>, chById: Record<string, Channel>): Tool | undefined {
  return p.tool ?? chById[p.channel]?.tool
}

// ───────── Needs you now ─────────

export interface Question { postId: string; text: string; options: string[] }

export interface NeedItem {
  key: string
  posts: Post[]                 // every post in the group (same pair_id)
  review: Post[]                // drafts to read and approve (no open question)
  questions: Question[]         // open questions from Claude, in change notes ending with "?"
  noPhoto: Post[]               // visual posts without a photo
  readyToPost: Post[]           // approved posts Arcadie posts himself, due within 2 days
  due: string | null            // earliest date in the group
}

/** A note asks something when it holds a "?". "Topic: a, b or c?" with single-word options becomes tap buttons. */
export function parseQuestions(postId: string, note: string | null): Question[] {
  if (!note || !note.includes('?')) return []
  // "Open: a; b; c?" lists open questions; otherwise only the parts that end in "?" are questions.
  const open = /^open:\s*/i.test(note)
  const parts = note.replace(/^open:\s*/i, '').split(/;\s*/).map((part) => part.trim()).filter(Boolean)
  return parts.filter((part) => open || part.includes('?')).map((t) => {
    const text = open && !t.endsWith('?') ? `${t}?` : t
    const m = text.match(/^[^:]+:\s*(.+)\?$/)
    let options: string[] = []
    if (m) {
      const opts = m[1].split(/,\s*|\s+or\s+/).map((o) => o.trim()).filter(Boolean)
      if (opts.length >= 2 && opts.every((o) => !/\s/.test(o))) options = opts
    }
    return { postId, text: text.charAt(0).toUpperCase() + text.slice(1), options }
  })
}

export function needsYou(posts: Post[], chById: Record<string, Channel>, now = new Date()): NeedItem[] {
  const groups = new Map<string, Post[]>()
  for (const p of posts) {
    if (p.status === 'skipped' || p.status === 'published') continue
    const k = p.pair_id ?? p.id
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  const soon = now.getTime() + 2 * 86400000
  const items: NeedItem[] = []
  for (const [key, list] of groups) {
    const questions = list.filter((p) => p.status === 'draft').flatMap((p) => parseQuestions(p.id, p.change_note))
    const asked = new Set(questions.map((q) => q.postId))
    const review = list.filter((p) => (p.status === 'draft' || p.show_again) && !asked.has(p.id))
    const noPhoto = list.filter((p) => p.status !== 'scheduled' && VISUAL.has(chById[p.channel]?.network ?? '') && !(p.post_photos?.length))
    const readyToPost = list.filter((p) => {
      const tool = toolOf(p, chById)
      return p.status === 'approved' && (tool === 'browser' || tool === 'manual') && (!p.scheduled_at || new Date(p.scheduled_at).getTime() < soon)
    })
    if (!questions.length && !review.length && !noPhoto.length && !readyToPost.length) continue
    const dates = list.map((p) => p.scheduled_at).filter(Boolean).sort() as string[]
    items.push({ key, posts: list, review, questions, noPhoto, readyToPost, due: dates[0] ?? null })
  }
  // Most urgent first; undated last.
  return items.sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
}

// ───────── Timeline ─────────

export interface DayRow { key: string; date: Date; isToday: boolean; posts: Post[]; runs: { time: string; text: string }[] }

export function timeline(posts: Post[], days = 14, now = new Date()): DayRow[] {
  const out: DayRow[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 86400000)
    const key = dayKey(d.toISOString())
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay()
    out.push({
      key, date: d, isToday: i === 0,
      posts: posts.filter((p) => p.scheduled_at && dayKey(p.scheduled_at) === key && p.status !== 'skipped')
        .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!)),
      runs: RUNS.filter((r) => r.weekday === weekday).map(({ time, text }) => ({ time, text })),
    })
  }
  return out
}

/** Phone list: empty days in a row fold into one "nothing planned" line. */
export type TimelineEntry = { kind: 'day'; day: DayRow } | { kind: 'gap'; from: DayRow; to: DayRow }
export function foldEmpty(days: DayRow[]): TimelineEntry[] {
  const out: TimelineEntry[] = []
  for (const day of days) {
    const empty = !day.posts.length && !day.runs.length && !day.isToday
    const last = out[out.length - 1]
    if (empty && last?.kind === 'gap') last.to = day
    else if (empty) out.push({ kind: 'gap', from: day, to: day })
    else out.push({ kind: 'day', day })
  }
  return out
}

// ───────── Tool limits ─────────

export interface Limit {
  tool: 'typefully' | 'metricool' | 'buffer'
  channels: string
  kind: 'month' | 'queue'
  limit: number
  sent: number
  scheduled: number
  waiting: number        // month: drafts / approved posts dated this month, not yet in the tool
  left: number
  nextMonth: number      // month: already scheduled for next month
  note?: string
}

export const TOOL_NOTE: Partial<Record<Limit['tool'], string>> = {
  metricool: 'Limit still to confirm in Metricool.',
  buffer: 'Buffer holds up to this many scheduled posts at once. A spot frees up when a post goes out.',
}

export function limits(channels: Channel[], rows: PlanRow[], monthStart: string, nextStart: string, nextEnd: string, now = new Date()): Limit[] {
  const chById = Object.fromEntries(channels.map((c) => [c.id, c]))
  const out: Limit[] = []
  for (const tool of ['typefully', 'metricool', 'buffer'] as const) {
    const chs = channels.filter((c) => c.tool === tool)
    const limit = Math.max(0, ...chs.map((c) => c.monthly_limit ?? 0))
    if (!chs.length || !limit) continue
    const mine = rows.filter((r) => (r.tool ?? chById[r.channel]?.tool) === tool && r.scheduled_at)
    const inMonth = mine.filter((r) => r.scheduled_at! >= monthStart && r.scheduled_at! < nextStart)
    const label = chs.map((c) => c.label).join(' + ')
    if (tool === 'buffer') {
      const queued = mine.filter((r) => r.status === 'scheduled' && new Date(r.scheduled_at!).getTime() > now.getTime()).length
      out.push({ tool, channels: label, kind: 'queue', limit, sent: 0, scheduled: queued, waiting: 0, left: Math.max(0, limit - queued), nextMonth: 0, note: TOOL_NOTE.buffer })
      continue
    }
    const sent = inMonth.filter((r) => r.status === 'published').length
    const scheduled = inMonth.filter((r) => r.status === 'scheduled').length
    const waiting = inMonth.filter((r) => ['draft', 'change', 'approved'].includes(r.status)).length
    const nextMonth = mine.filter((r) => r.status === 'scheduled' && r.scheduled_at! >= nextStart && r.scheduled_at! < nextEnd).length
    out.push({ tool, channels: label, kind: 'month', limit, sent, scheduled, waiting, left: Math.max(0, limit - sent - scheduled), nextMonth, note: TOOL_NOTE[tool] })
  }
  return out
}
