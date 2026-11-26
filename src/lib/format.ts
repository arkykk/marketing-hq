const TZ = 'Europe/Madrid'

export function dayKey(iso: string): string {
  // YYYY-MM-DD in Madrid
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}
export function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(iso))
}
export function shortDay(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso))
}
export function time(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
export function dateTime(iso: string): string {
  return `${shortDay(iso)}, ${time(iso)}`
}

/** Value for <input type="datetime-local"> in Madrid time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** Madrid wall-clock "YYYY-MM-DDTHH:mm" → ISO UTC. */
export function fromLocalInput(v: string): string | null {
  if (!v) return null
  const [d, t] = v.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  // First guess treating it as UTC, then correct by Madrid's offset at that moment.
  const guess = Date.UTC(y, m - 1, day, hh, mm)
  const offsetMin = madridOffset(new Date(guess))
  return new Date(guess - offsetMin * 60000).toISOString()
}
function madridOffset(d: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  )
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  return Math.round((asUtc - d.getTime()) / 60000)
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Needs you', change: 'Claude is fixing', approved: 'Approved', scheduled: 'Scheduled', published: 'Posted', skipped: 'Skipped',
}
export const TOOL_LABEL: Record<string, string> = {
  typefully: 'Typefully', buffer: 'Buffer', metricool: 'Metricool', browser: 'Your browser', manual: 'By hand',
}
export const OWNER_LABEL: Record<string, string> = { bigfish: 'Big Fish', arcadie: 'Arcadie', irina: 'Irina' }

export function historyLine(h: { at: string; by: string; event: string; status?: string; from?: string; to?: string; note?: string }): string {
  const who = h.by === 'system' ? 'Claude' : h.by.split('@')[0]
  const when = dateTime(h.at)
  if (h.event === 'created') return `${when} · ${who} · created as ${STATUS_LABEL[h.status ?? ''] ?? h.status}`
  if (h.event === 'status') return `${when} · ${who} · ${STATUS_LABEL[h.from ?? ''] ?? h.from} to ${STATUS_LABEL[h.to ?? ''] ?? h.to}`
  if (h.event === 'note') return `${when} · ${who} · note: ${h.note}`
  return `${when} · ${who} · ${h.event}`
}

/** First instant of a Madrid calendar month, as ISO UTC. monthOffset 0 = this month. */
export function madridMonthStart(monthOffset = 0, now = new Date()): string {
  const [y, m] = dayKey(now.toISOString()).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + monthOffset, 1))
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01T00:00`
  return fromLocalInput(key)!
}
export function monthName(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: 'long' }).format(new Date(iso))
}
/** "Goes out in 6 hours", "Tomorrow 09:00", "Sat 28 Nov 11:00", "No date yet". */
export function whenLabel(iso: string | null, now = new Date()): string {
  if (!iso) return 'No date yet'
  const t = new Date(iso).getTime()
  const diffH = (t - now.getTime()) / 3600000
  if (diffH < 0) return `Was due ${dateTime(iso)}`
  const today = dayKey(now.toISOString())
  const tomorrow = dayKey(new Date(now.getTime() + 86400000).toISOString())
  const k = dayKey(iso)
  if (k === today) return diffH < 1 ? 'Goes out within the hour' : `Goes out in ${Math.round(diffH)} hours`
  if (k === tomorrow) return `Tomorrow ${time(iso)}`
  return `${shortDay(iso)} ${time(iso)}`
}
