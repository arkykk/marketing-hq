import { useEffect, useMemo, useState } from 'react'
import {
  listChannels, listPlanRows, listPosts, markPublished, sendNote, setPostPhotos, uploadPhoto,
  type Channel, type Post,
} from '../lib/data'
import { dayKey, madridMonthStart, monthName, shortDay, time, TOOL_LABEL, whenLabel } from '../lib/format'
import { foldEmpty, limits, needsYou, timeline, type DayRow, type Limit, type NeedItem, type Question } from '../lib/home'
import { Eyebrow, Icon, StatusPill, errorText, toast } from '../ui'

function startOfTodayIso(): string {
  const k = dayKey(new Date().toISOString())
  return new Date(new Date(`${k}T00:00:00Z`).getTime() - 2 * 3600 * 1000).toISOString()
}

export default function Home() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [lims, setLims] = useState<Limit[]>([])
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    try {
      const m0 = madridMonthStart(0), m1 = madridMonthStart(1), m2 = madridMonthStart(2)
      const [c, p, rows] = await Promise.all([
        listChannels(),
        listPosts(startOfTodayIso(), new Date(Date.now() + 15 * 86400000).toISOString()),
        listPlanRows(m0 < startOfTodayIso() ? m0 : startOfTodayIso(), m2),
      ])
      setChannels(c); setPosts(p); setLims(limits(c, rows, m0, m1, m2)); setErr(null)
    } catch (e) { setErr(errorText(e)) }
  }
  useEffect(() => { load() }, [])

  const chById = useMemo(() => Object.fromEntries(channels.map((c) => [c.id, c])), [channels])
  const needs = useMemo(() => needsYou(posts ?? [], chById), [posts, chById])
  const days = useMemo(() => timeline(posts ?? []), [posts])
  const undated = (posts ?? []).filter((p) => !p.scheduled_at && p.status !== 'skipped' && p.status !== 'published')
  const today = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const firstDue = needs.find((n) => n.due)?.due ?? null

  return (
    <main className="page page-wide">
      <div className="home-top">
        <section className="stack" style={{ gap: 14 }} aria-labelledby="needs-h">
          <div className="head">
            <div className="stack" style={{ gap: 10 }}>
              <Eyebrow>{today}</Eyebrow>
              <h1 className="h1" id="needs-h">Needs you now</h1>
              {posts && <p className="muted">{needs.length === 0 ? 'Nothing. All clear.' : <>{needs.length} {needs.length === 1 ? 'thing' : 'things'}, about {Math.max(2, needs.length * 3)} minutes.{firstDue && <> The first one: <b style={{ fontWeight: 500, color: '#000' }}>{whenLabel(firstDue).replace(/^Goes out/, 'goes out')}</b>.</>}</>}</p>}
            </div>
            <a className="icon-btn filled" aria-label="Add a post" href="#/posts?new=1"><Icon name="plus" /></a>
          </div>
          {err && <p className="err">{err}</p>}
          {posts === null && !err && <p className="muted">Loading…</p>}
          {needs.length > 0 && (
            <div className="needs">
              {needs.map((n, i) => <NeedCard key={n.key} n={n} index={i + 1} chById={chById} onDone={load} />)}
            </div>
          )}
        </section>

        <aside className="stack" style={{ gap: 14 }} aria-labelledby="limits-h">
          <div className="stack" style={{ gap: 10 }}>
            <Eyebrow>{monthName(new Date().toISOString())}</Eyebrow>
            <h2 className="h1" id="limits-h">Tool limits</h2>
            <p className="muted"><b className="k">Sent</b> = already live. <b className="k">Scheduled</b> = waiting in the tool with a date.</p>
          </div>
          <div className="limits-list">
            {lims.map((l) => <LimitCard key={l.tool} l={l} />)}
            {posts && <Legend />}
          </div>
        </aside>
      </div>

      <section className="stack" style={{ gap: 14, marginTop: 28 }} aria-labelledby="tl-h">
        <div className="head" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="stack" style={{ gap: 10 }}>
            <Eyebrow>Next 14 days</Eyebrow>
            <h2 className="h1" id="tl-h">What goes out when</h2>
          </div>
          <div className="chips" aria-label="Statuses">
            {['draft', 'change', 'approved', 'scheduled', 'published'].map((s) => <StatusPill key={s} status={s} />)}
          </div>
        </div>
        {posts && <TimelineList days={days} chById={chById} />}
        {posts && <TimelineGrid days={days} chById={chById} />}
        {undated.length > 0 && (
          <div className="nodate">
            <div className="stack" style={{ gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 500 }}>No date yet · {undated.length} {undated.length === 1 ? 'post' : 'posts'}</span>
              <span className="muted">{undated.map((p) => `${chById[p.channel]?.label ?? p.channel}: ${firstLine(p.caption, 28)}`).join(' · ')}</span>
            </div>
            <a className="btn btn-outline" href={`#/post/${undated[0].id}`}>Pick dates</a>
          </div>
        )}
      </section>
    </main>
  )
}

function firstLine(s: string, n = 70): string {
  const line = (s || 'Empty caption').split('\n')[0].trim()
  return line.length > n ? `${line.slice(0, n - 1)}…` : line
}

function Thumb({ post, size = 44 }: { post: Post; size?: number }) {
  const ph = post.post_photos?.[0]?.photo
  if (ph?.public_url) return <img className="tthumb" style={{ width: size, height: size }} src={ph.public_url} alt="" loading="lazy" />
  return (
    <div className="tthumb text" style={{ width: size, height: size }} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h12M4 10h12M4 14h7" /></svg>
    </div>
  )
}

// ───────── Needs you now ─────────

function NeedCard({ n, index, chById, onDone }: { n: NeedItem; index: number; chById: Record<string, Channel>; onDone: () => void }) {
  const kinds = [
    n.review.length && 'Review', n.questions.length && 'Answer', n.noPhoto.length && 'Add a photo', n.readyToPost.length && 'Post it',
  ].filter(Boolean).join(' + ')
  const lead = n.review[0] ?? n.posts.find((p) => p.status === 'draft') ?? n.posts[0]
  const photos = n.posts.flatMap((p) => p.post_photos ?? []).map((pp) => pp.photo).filter((ph, i, a) => ph.public_url && a.findIndex((x) => x.id === ph.id) === i)
  const accounts = [...new Set(n.posts.map((p) => chById[p.channel]?.label ?? p.channel))].join(' + ')
  const soon = n.due && new Date(n.due).getTime() - Date.now() < 86400000

  return (
    <article className="need">
      <div className="need-top">
        <span className="status st-draft">{index} · {kinds}</span>
        <span className="small" style={soon ? { color: 'var(--orange-700)', fontWeight: 500 } : undefined}>{whenLabel(n.due)}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {photos.length === 1 && <img className="need-img" src={photos[0].public_url!} alt={photos[0].alt ?? ''} />}
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <span className="small">{accounts}{n.posts.length > 1 ? ` · ${n.posts.length} posts` : ''}</span>
          <span className="need-title">{firstLine(lead.caption, 90)}</span>
        </div>
      </div>
      {photos.length > 1 && (
        <div className="need-strip">{photos.map((ph) => <img key={ph.id} src={ph.public_url!} alt={ph.alt ?? ''} />)}</div>
      )}
      {n.questions.length > 0 && <Answer questions={n.questions} onDone={onDone} />}
      {n.noPhoto.length > 0 && <AddPhoto posts={n.noPhoto} chById={chById} onDone={onDone} />}
      {n.readyToPost.map((p) => <ReadyToPost key={p.id} post={p} channel={chById[p.channel]} onDone={onDone} />)}
      {n.review.length > 0 && (
        <a className="btn btn-blue btn-block" href={`#/post/${n.review[0].id}`}>
          {n.review.length > 1 ? `Read and approve (${n.review.length})` : 'Read and approve'}<Icon name="arrow" size={16} />
        </a>
      )}
    </article>
  )
}

function Answer({ questions, onDone }: { questions: Question[]; onDone: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  async function send(answer: string) {
    if (!answer.trim()) return
    setBusy(true)
    try {
      const byPost = new Map<string, string[]>()
      for (const q of questions) byPost.set(q.postId, [...(byPost.get(q.postId) ?? []), q.text])
      for (const [id, qs] of byPost) await sendNote(id, `Answer: ${answer.trim()}\nAsked: ${qs.join('; ')}`)
      toast('Sent to Claude'); onDone()
    } catch (e) { toast(errorText(e)); setBusy(false) }
  }
  const one = questions.length === 1 && questions[0].options.length > 0 ? questions[0] : null
  if (one) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <span className="need-q">{one.text.split(':')[0]}?</span>
        {one.options.map((o) => <button key={o} className="opt" disabled={busy} onClick={() => send(o)}>{o}</button>)}
        <span className="small">One tap answers. Claude fixes the text, then it comes back to you to approve.</span>
      </div>
    )
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <ul className="need-qs">{questions.map((q, i) => <li key={i}>{q.text}</li>)}</ul>
      <label className="field">
        <span className="small">Your answers, in any order</span>
        <textarea className="textarea" style={{ minHeight: 96 }} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <button className="btn btn-blue btn-block" disabled={busy || !text.trim()} onClick={() => send(text)}>
        Send {questions.length > 1 ? `${questions.length} answers` : 'answer'}<Icon name="arrow" size={16} />
      </button>
    </div>
  )
}

function AddPhoto({ posts, chById, onDone }: { posts: Post[]; chById: Record<string, Channel>; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  async function onFile(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      const added = []
      for (const f of Array.from(files)) added.push(await uploadPhoto(f))
      for (const p of posts) await setPostPhotos(p.id, added.map((x) => x.id))
      toast(added.length === 1 ? 'Photo added' : `${added.length} photos added`); onDone()
    } catch (e) { toast(errorText(e)) }
    setBusy(false)
  }
  const names = posts.map((p) => chById[p.channel]?.label ?? p.channel).join(', ')
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="small">No photo yet: {names}. The same photo goes on {posts.length > 1 ? 'all of them' : 'it'}.</span>
      <label className={`btn btn-outline btn-block${busy ? ' busy' : ''}`}>
        <Icon name="camera" size={18} />{busy ? 'Uploading…' : 'Add a photo'}
        <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => onFile(e.target.files)} />
      </label>
      <a className="btn btn-text" style={{ alignSelf: 'center' }} href={`#/post/${posts[0].id}`}>Pick from Photos instead</a>
    </div>
  )
}

function ReadyToPost({ post, channel, onDone }: { post: Post; channel?: Channel; onDone: () => void }) {
  async function copy() {
    try { await navigator.clipboard.writeText(post.caption); toast('Text copied') } catch { toast('Couldn’t copy') }
  }
  async function done() {
    const url = window.prompt('Link to the live post (optional)') ?? null
    try { await markPublished(post.id, url || null); toast('Marked as posted'); onDone() } catch (e) { toast(errorText(e)) }
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="small">Approved. Post it yourself on {channel?.label ?? post.channel}, then tap Posted.</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={copy}><Icon name="copy" size={16} />Copy text</button>
        <button className="btn btn-blue" style={{ flex: 1 }} onClick={done}><Icon name="check" size={16} />Posted</button>
      </div>
    </div>
  )
}

// ───────── Timeline ─────────

function OpenIn({ post, chById }: { post: Post; chById: Record<string, Channel> }) {
  const tool = post.tool ?? chById[post.channel]?.tool
  if (!post.external_url || !tool) return null
  return <a className="link" href={post.external_url} target="_blank" rel="noreferrer">open in {TOOL_LABEL[tool]}</a>
}

function TimelineList({ days, chById }: { days: DayRow[]; chById: Record<string, Channel> }) {
  return (
    <div className="tl-list">
      {foldEmpty(days).map((e) => e.kind === 'gap' ? (
        <div key={e.from.key} className="tl-gap">
          {shortDay(e.from.date.toISOString())}{e.to.key !== e.from.key ? ` – ${shortDay(e.to.date.toISOString())}` : ''} · nothing planned
        </div>
      ) : (
        <div key={e.day.key} className="stack" style={{ gap: 6 }}>
          <div className="tl-day">{e.day.isToday ? 'Today · ' : ''}{shortDay(e.day.date.toISOString())}</div>
          {rowsFor(e.day).map((r) => r.kind === 'run' ? (
            <div key={`r${r.time}`} className="tl-run"><span className="tl-time">{r.time}</span><span>{r.text}</span></div>
          ) : (
            <div key={r.post.id} className="tl-row">
              <span className="tl-time">{time(r.post.scheduled_at!)}</span>
              <Thumb post={r.post} />
              <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                <span className="small">{chById[r.post.channel]?.label ?? r.post.channel}{(r.post.post_photos?.length ?? 0) > 1 ? ` · ${r.post.post_photos!.length} photos` : ''} <OpenIn post={r.post} chById={chById} /></span>
                <a className="ell stretch" style={{ fontSize: 15 }} href={`#/post/${r.post.id}`}>{firstLine(r.post.caption)}</a>
              </span>
              <StatusPill status={r.post.status} />
            </div>
          ))}
          {e.day.isToday && !e.day.posts.length && !e.day.runs.length && <div className="tl-gap">Nothing goes out today</div>}
        </div>
      ))}
    </div>
  )
}

type Row = { kind: 'run'; time: string; text: string } | { kind: 'post'; time: string; post: Post }
function rowsFor(day: DayRow): Row[] {
  const rows: Row[] = [
    ...day.posts.map((post) => ({ kind: 'post' as const, time: time(post.scheduled_at!), post })),
    ...day.runs.map((r) => ({ kind: 'run' as const, ...r })),
  ]
  return rows.sort((a, b) => a.time.localeCompare(b.time))
}

function TimelineGrid({ days, chById }: { days: DayRow[]; chById: Record<string, Channel> }) {
  return (
    <div className="tl-grid">
      {days.map((d) => (
        <div key={d.key} className={`tl-cell${d.isToday ? ' today' : ''}`}>
          <div className="tl-day">{d.isToday ? 'Today · ' : ''}{shortDay(d.date.toISOString())}</div>
          {rowsFor(d).map((r) => r.kind === 'run' ? (
            <div key={`r${r.time}`} className="tl-run"><span><b>{r.time}</b> {r.text}</span></div>
          ) : (
            <a key={r.post.id} className="tl-chip" href={`#/post/${r.post.id}`}>
              <CellImage post={r.post} />
              <span className="small" style={{ color: '#000' }}><b style={{ fontWeight: 500 }}>{r.time}</b> · {chById[r.post.channel]?.label ?? r.post.channel}</span>
              <StatusPill status={r.post.status} />
            </a>
          ))}
          {!d.posts.length && !d.runs.length && <span className="small" style={{ color: 'var(--grey-600)' }}>Nothing planned</span>}
        </div>
      ))}
    </div>
  )
}

function CellImage({ post }: { post: Post }) {
  const phs = (post.post_photos ?? []).map((p) => p.photo).filter((p) => p.public_url)
  if (phs.length > 1) return <div className="cell-imgs">{phs.slice(0, 3).map((p) => <img key={p.id} src={p.public_url!} alt="" loading="lazy" />)}</div>
  if (phs.length === 1) return <img className="cell-img" src={phs[0].public_url!} alt="" loading="lazy" />
  return <div className="cell-img text">{firstLine(post.caption, 80)}</div>
}

// ───────── Tool limits ─────────

function LimitCard({ l }: { l: Limit }) {
  const cells: string[] = []
  if (l.kind === 'queue') {
    for (let i = 0; i < l.limit; i++) cells.push(i < l.scheduled ? 'sch' : 'left')
  } else {
    for (let i = 0; i < l.limit; i++) {
      if (i < l.sent) cells.push('sent')
      else if (i < l.sent + l.scheduled) cells.push('sch')
      else if (i < l.sent + l.scheduled + l.waiting) cells.push('wait')
      else cells.push('left')
    }
  }
  return (
    <div className="limit">
      <span className="small">{l.channels} · {TOOL_LABEL[l.tool]} · {l.kind === 'queue' ? 'a queue, not a month' : `${l.limit} a month`}</span>
      <span className="limit-big">{l.kind === 'queue' ? `${l.left} of ${l.limit} spots free` : `${l.left} left this month`}</span>
      <div className="cells" style={{ gridTemplateColumns: `repeat(${l.limit}, minmax(0, 1fr))` }} aria-hidden="true">
        {cells.map((c, i) => <span key={i} className={`cell ${c}`} />)}
      </div>
      <span style={{ fontSize: 15, lineHeight: 1.45 }}>
        {l.kind === 'queue' ? `${l.scheduled} waiting in the queue now` : `${l.sent} sent · ${l.scheduled} scheduled · ${l.left} left`}
      </span>
      {l.kind === 'month' && l.waiting > 0 && <span className="small">{l.waiting} more dated this month, not in the tool yet (needs you or approved).</span>}
      {l.kind === 'month' && l.nextMonth > 0 && <span className="small">{monthName(madridMonthStart(1))}: {l.nextMonth} already scheduled.</span>}
      {l.note && <span className="small">{l.note}</span>}
    </div>
  )
}

function Legend() {
  return (
    <div className="legend">
      <span><span className="cell sent" />Sent</span>
      <span><span className="cell sch" />Scheduled</span>
      <span><span className="cell wait" />Not in the tool yet</span>
      <span><span className="cell left" />Left</span>
    </div>
  )
}
