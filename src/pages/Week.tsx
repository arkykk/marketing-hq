import { useEffect, useMemo, useState } from 'react'
import {
  createPost, listChannels, listPosts, markPublished, monthCounts,
  type Channel, type Owner, type Post,
} from '../lib/data'
import { dayKey, dayLabel, fromLocalInput, time, TOOL_LABEL } from '../lib/format'
import { Eyebrow, Icon, Sheet, StatusPill, errorText, toast } from '../ui'

type Filter = 'all' | Owner | 'review' | `ch:${string}`

const VISUAL = new Set(['instagram', 'instagram_facebook', 'tiktok'])

function startOfTodayMadridIso(): string {
  const k = dayKey(new Date().toISOString())
  // 00:00 Madrid is 22:00 or 23:00 UTC the day before; a 2-hour margin keeps today's early posts in.
  return new Date(new Date(`${k}T00:00:00Z`).getTime() - 2 * 3600 * 1000).toISOString()
}

export default function Week() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pickChannel, setPickChannel] = useState(false)

  async function load() {
    try {
      const from = startOfTodayMadridIso()
      const to = new Date(Date.now() + 15 * 86400000).toISOString()
      const [c, p, n] = await Promise.all([listChannels(), listPosts(from, to), monthCounts()])
      setChannels(c); setPosts(p); setCounts(n); setErr(null)
    } catch (e) { setErr(errorText(e)) }
  }
  useEffect(() => { load() }, [])

  const chById = useMemo(() => Object.fromEntries(channels.map((c) => [c.id, c])), [channels])

  const visible = useMemo(() => (posts ?? []).filter((p) => {
    if (filter === 'all') return true
    if (filter === 'review') return p.status === 'draft' || p.status === 'change' || p.show_again
    if (filter.startsWith('ch:')) return p.channel === filter.slice(3)
    return p.brand === filter
  }), [posts, filter])

  const ready = visible.filter((p) => {
    const tool = p.tool ?? chById[p.channel]?.tool
    return p.status === 'approved' && (tool === 'browser' || tool === 'manual')
      && (!p.scheduled_at || new Date(p.scheduled_at).getTime() < Date.now() + 2 * 86400000)
  })
  const readyIds = new Set(ready.map((p) => p.id))
  const rest = visible.filter((p) => !readyIds.has(p.id))
  const undated = rest.filter((p) => !p.scheduled_at)
  const groups: [string, Post[]][] = []
  for (const p of rest.filter((x) => x.scheduled_at)) {
    const k = dayKey(p.scheduled_at!)
    const g = groups.find(([key]) => key === k)
    if (g) g[1].push(p); else groups.push([k, [p]])
  }
  const toReview = (posts ?? []).filter((p) => p.status === 'draft' || p.status === 'change' || p.show_again).length

  // Plan limits per tool, counted per calendar month.
  const limits = (['typefully', 'buffer', 'metricool'] as const).map((tool) => {
    const chs = channels.filter((c) => c.tool === tool)
    const limit = Math.max(0, ...chs.map((c) => c.monthly_limit ?? 0))
    const used = chs.reduce((s, c) => s + (counts[c.id] ?? 0), 0)
    return { tool, limit, used }
  }).filter((l) => l.limit > 0)

  const today = new Date()
  const end = new Date(Date.now() + 13 * 86400000)
  const fmt = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short' }).format(d)

  const chFilterLabel = filter.startsWith('ch:') ? chById[filter.slice(3)]?.label ?? 'Channel' : 'Channel'

  return (
    <main className="page">
      <div className="head">
        <div className="stack">
          <Eyebrow>Marketing HQ</Eyebrow>
          <h1 className="h1">Next 14 days</h1>
          <p className="muted">{fmt(today)} – {fmt(end)}</p>
        </div>
        <button className="icon-btn filled" aria-label="Add a post" onClick={() => setAdding(true)}><Icon name="plus" /></button>
      </div>

      {limits.length > 0 && (
        <section className="panel limits" aria-label="Plan limits this month">
          {limits.map((l) => (
            <div key={l.tool} className="stack">
              <span className="small">{TOOL_LABEL[l.tool]}</span>
              <span style={{ fontSize: 18, fontWeight: 500 }}>{l.used} / {l.limit}</span>
              <div className={`bar${l.used > l.limit ? ' over' : ''}`}><div style={{ width: `${Math.min(100, (l.used / l.limit) * 100)}%` }} /></div>
            </div>
          ))}
        </section>
      )}

      <div className="filters" role="group" aria-label="Filters">
        {([['all', 'All'], ['bigfish', 'Big Fish'], ['arcadie', 'Arcadie'], ['irina', 'Irina'], ['review', 'To review']] as [Filter, string][]).map(([f, label]) => (
          <button key={f} className="filter" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
        ))}
        <button className="filter" aria-pressed={filter.startsWith('ch:')} onClick={() => setPickChannel(true)}>{chFilterLabel}</button>
      </div>

      {err && <p className="err">{err}</p>}
      {posts === null && !err && <p className="muted">Loading…</p>}
      {posts && visible.length === 0 && <div className="empty">Nothing here yet.</div>}

      {ready.length > 0 && (
        <section className="stack" style={{ gap: 10 }}>
          <h2 className="h2">Ready to post</h2>
          {ready.map((p) => <ReadyCard key={p.id} post={p} channel={chById[p.channel]} onDone={load} />)}
        </section>
      )}

      {undated.length > 0 && (
        <section className="stack" style={{ gap: 10 }}>
          <h2 className="h2">No date yet</h2>
          {undated.map((p) => <PostCard key={p.id} post={p} channel={chById[p.channel]} />)}
        </section>
      )}

      {groups.map(([k, list]) => (
        <section key={k} className="stack" style={{ gap: 10 }}>
          <h2 className="h2">{dayLabel(list[0].scheduled_at!)}</h2>
          {list.map((p) => <PostCard key={p.id} post={p} channel={chById[p.channel]} />)}
        </section>
      ))}

      {toReview > 0 && (
        <div className="actionbar">
          <span style={{ color: 'var(--blue-500)', display: 'flex' }}><Icon name="check" size={16} /></span>
          <span style={{ flex: 1, fontSize: 15 }}>{toReview} {toReview === 1 ? 'post' : 'posts'} to review</span>
          <a className="btn btn-blue" href="#/review">Review<Icon name="arrow" size={16} /></a>
        </div>
      )}

      {adding && <AddPost channels={channels} onClose={() => setAdding(false)} />}
      {pickChannel && (
        <Sheet title="Show one channel" onClose={() => setPickChannel(false)}>
          <div className="stack" style={{ gap: 8 }}>
            {channels.map((c) => (
              <button key={c.id} className="filter" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center', height: 52 }}
                aria-pressed={filter === `ch:${c.id}`} onClick={() => { setFilter(`ch:${c.id}`); setPickChannel(false) }}>
                <span>{c.label}</span><span className="small">{TOOL_LABEL[c.tool]}{c.connected ? '' : ' · not connected'}</span>
              </button>
            ))}
            <button className="btn btn-text" onClick={() => { setFilter('all'); setPickChannel(false) }}>Show all channels</button>
          </div>
        </Sheet>
      )}
    </main>
  )
}

function Thumb({ post, channel }: { post: Post; channel?: Channel }) {
  const first = post.post_photos?.[0]?.photo
  if (first?.public_url) return <img className="thumb" src={first.public_url} alt={first.alt ?? ''} loading="lazy" />
  if (first) return <div className="thumb">{first.source}</div>
  if (channel && VISUAL.has(channel.network)) {
    return <div className="thumb" style={{ background: 'var(--grey-100)', flexDirection: 'column', gap: 4 }}><Icon name="image" size={22} />Photos</div>
  }
  return <div className="thumb text">Text</div>
}

function statusExtra(p: Post, ch?: Channel): string | undefined {
  if (p.status === 'scheduled' || p.status === 'published') return TOOL_LABEL[p.tool ?? ch?.tool ?? ''] ?? undefined
  if (p.status === 'draft' && ch && VISUAL.has(ch.network) && !(p.post_photos?.length)) return 'photos needed'
  if (p.show_again) return 'show again'
  return undefined
}

function PostCard({ post, channel }: { post: Post; channel?: Channel }) {
  return (
    <a href={`#/post/${post.id}`} className="card">
      <Thumb post={post} channel={channel} />
      <div className="stack" style={{ gap: 8, minWidth: 0, flex: 1 }}>
        <div className="chips">
          <span className="chip">{channel?.label ?? post.channel}</span>
          <span className="chip">{post.language.toUpperCase()}</span>
          {post.scheduled_at && <span className="small">{time(post.scheduled_at)}</span>}
        </div>
        <p className="cap2">{post.caption || 'Empty caption'}</p>
        {post.status === 'change' && post.change_note ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
            <StatusPill status="change" />
            <span className="small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.change_note}</span>
          </div>
        ) : <StatusPill status={post.status} extra={statusExtra(post, channel)} />}
      </div>
    </a>
  )
}

function ReadyCard({ post, channel, onDone }: { post: Post; channel?: Channel; onDone: () => void }) {
  const tool = post.tool ?? channel?.tool
  async function copy() {
    try { await navigator.clipboard.writeText(post.caption); toast('Caption copied') } catch { toast('Couldn’t copy') }
  }
  async function done() {
    const url = window.prompt('Link to the published post (optional)') ?? null
    try { await markPublished(post.id, url || null); toast('Marked as published'); onDone() } catch (e) { toast(errorText(e)) }
  }
  return (
    <div className="card" style={{ flexDirection: 'column', background: 'var(--blue-50)' }}>
      <a href={`#/post/${post.id}`} style={{ display: 'flex', gap: 12 }}>
        <Thumb post={post} channel={channel} />
        <div className="stack" style={{ gap: 8, minWidth: 0, flex: 1 }}>
          <div className="chips">
            <span className="chip">{channel?.label ?? post.channel}</span>
            {post.scheduled_at && <span className="small">{time(post.scheduled_at)}</span>}
          </div>
          <p className="cap2">{post.caption}</p>
          <span className="small">{tool === 'browser' ? 'Say “post it” to Claude when you’re at your computer' : 'Post it yourself in the app'}</span>
        </div>
      </a>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-outline" style={{ flex: 1, height: 44 }} onClick={copy}><Icon name="copy" size={16} />Copy caption</button>
        <button className="btn btn-outline" style={{ flex: 1, height: 44 }} onClick={done}><Icon name="check" size={16} />Posted</button>
      </div>
    </div>
  )
}

function AddPost({ channels, onClose }: { channels: Channel[]; onClose: () => void }) {
  const [channel, setChannel] = useState(channels[0]?.id ?? '')
  const [when, setWhen] = useState('')
  const [language, setLanguage] = useState('en')
  const [busy, setBusy] = useState(false)
  async function create() {
    const ch = channels.find((c) => c.id === channel)
    if (!ch) return
    setBusy(true)
    try {
      const id = await createPost({ brand: ch.owner, channel: ch.id, language, scheduled_at: fromLocalInput(when) })
      window.location.hash = `#/post/${id}`
    } catch (e) { toast(errorText(e)); setBusy(false) }
  }
  return (
    <Sheet title="New post" onClose={onClose}>
      <label className="field"><span style={{ fontSize: 15 }}>Channel</span>
        <select className="select" value={channel} onChange={(e) => setChannel(e.target.value)}>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label className="field"><span style={{ fontSize: 15 }}>When (Barcelona time)</span>
        <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </label>
      <label className="field"><span style={{ fontSize: 15 }}>Language</span>
        <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
          {['en', 'ua+en', 'ro', 'ru', 'es', 'ua'].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </label>
      <button className="btn btn-blue btn-block" disabled={busy || !channel} onClick={create}>Create draft<Icon name="arrow" size={16} /></button>
    </Sheet>
  )
}
