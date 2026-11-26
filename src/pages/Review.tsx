import { useEffect, useRef, useState } from 'react'
import { approve, listChannels, listToReview, sendNote, showAgain, type Channel, type Post } from '../lib/data'
import { dateTime } from '../lib/format'
import { Eyebrow, Icon, Sheet, errorText, toast } from '../ui'

export default function Review() {
  const [queue, setQueue] = useState<Post[] | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [i, setI] = useState(0)
  const [done, setDone] = useState(0)
  const [busy, setBusy] = useState(false)
  const [noting, setNoting] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const touch = useRef<number | null>(null)

  useEffect(() => {
    Promise.all([listToReview(), listChannels()])
      .then(([q, c]) => { setQueue(q); setChannels(c) })
      .catch((e) => setErr(errorText(e)))
  }, [])

  const close = () => { window.location.hash = '#/' }

  if (err) return <main className="page"><p className="err">{err}</p></main>
  if (!queue) return <main className="page"><p className="muted">Loading…</p></main>

  const total = queue.length + done
  const post = queue[i]

  if (!post) {
    return (
      <main className="page" style={{ minHeight: '100svh' }}>
        <div className="head"><div className="stack"><Eyebrow>All done</Eyebrow><h1 className="h1">Review</h1></div>
          <button className="icon-btn" aria-label="Close review" onClick={close}><Icon name="close" size={16} /></button></div>
        <div className="empty">Nothing left to review{done ? `: ${done} handled` : ''}. Claude picks this up on Monday at 12:00.</div>
        <a href="#/" className="btn btn-blue">Back to Home</a>
      </main>
    )
  }

  const ch = channels.find((c) => c.id === post.channel)
  const photo = post.post_photos?.[0]?.photo

  async function handle(fn: () => Promise<unknown>, msg: string) {
    setBusy(true)
    try {
      await fn()
      toast(msg)
      setQueue((q) => (q ? q.filter((p) => p.id !== post.id) : q))
      setDone((d) => d + 1)
      setI((x) => Math.min(x, Math.max(0, (queue?.length ?? 1) - 2)))
    } catch (e) { toast(errorText(e)) }
    setBusy(false)
  }

  function onTouchEnd(x: number) {
    if (touch.current === null) return
    const dx = x - touch.current
    touch.current = null
    if (dx < -60 && i < queue!.length - 1) setI(i + 1)
    if (dx > 60 && i > 0) setI(i - 1)
  }

  return (
    <main className="page" style={{ minHeight: '100svh', paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="head" style={{ alignItems: 'center' }}>
        <div className="stack" style={{ gap: 4 }}>
          <Eyebrow>{done + i + 1} of {total} to review</Eyebrow>
          <h1 className="h1">Review</h1>
        </div>
        <button className="icon-btn" aria-label="Close review" onClick={close}><Icon name="close" size={16} /></button>
      </div>

      <div className="bar" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
        <div style={{ width: `${total ? ((done + i + 1) / total) * 100 : 0}%` }} />
      </div>

      <div className="review-card" onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
        onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}>
        <article>
          <div className="img">{photo?.public_url ? <img src={photo.public_url} alt={photo.alt ?? ''} /> : (photo ? `${photo.source} (not uploaded yet)` : ch?.network === 'linkedin' ? 'Text post' : 'No photo yet')}</div>
          <div className="body">
            <div className="chips">
              <span className="chip chip-grey">{ch?.label ?? post.channel}</span>
              <span className="chip chip-grey">{post.language.toUpperCase()}</span>
              {post.scheduled_at && <span className="chip chip-grey">{dateTime(post.scheduled_at)}</span>}
            </div>
            {post.status === 'change' && post.change_note && <p className="small">Last note: {post.change_note}</p>}
            <p className="txt">{post.caption}</p>
            <a href={`#/post/${post.id}`} style={{ fontSize: 15, fontWeight: 500, color: 'var(--blue-500)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Open full post<Icon name="arrow" size={16} />
            </a>
          </div>
        </article>
      </div>

      {queue.length > 1 && (
        <div className="dots" aria-hidden="true">{queue.map((p, k) => <span key={p.id} className={k === i ? 'on' : ''} />)}</div>
      )}

      <div className="stack" style={{ marginTop: 'auto', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" style={{ flex: 1, height: 60 }} disabled={busy} onClick={() => { setNote(''); setNoting(true) }}>
            <Icon name="pencil" size={18} />Note
          </button>
          <button className="btn btn-yellow" style={{ flex: 1.4, height: 60 }} disabled={busy} onClick={() => handle(() => approve(post.id), 'Approved')}>
            <Icon name="check" size={18} stroke={2} />Approve
          </button>
        </div>
        <button className="btn btn-text" style={{ alignSelf: 'center' }} disabled={busy} onClick={() => handle(() => showAgain(post.id), 'Will show again')}>
          Show me again later
        </button>
      </div>

      {noting && (
        <Sheet title="What should change?" onClose={() => setNoting(false)}>
          <textarea className="textarea" autoFocus rows={4} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="E.g. shorter first line, use the camp photo instead" />
          <button className="btn btn-blue btn-block" disabled={!note.trim() || busy}
            onClick={() => { setNoting(false); handle(() => sendNote(post.id, note.trim()), 'Note sent') }}>Send note</button>
        </Sheet>
      )}
    </main>
  )
}
