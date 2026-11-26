import { useEffect, useRef, useState } from 'react'
import {
  approve, getPost, listChannels, listPhotos, sendNote, setPostPhotos, showAgain, updatePost, uploadPhoto,
  type Channel, type Photo, type Post,
} from '../lib/data'
import { dateTime, fromLocalInput, historyLine, toLocalInput, TOOL_LABEL } from '../lib/format'
import { Eyebrow, Icon, Sheet, StatusPill, errorText, toast } from '../ui'

type View = 'edit' | 'instagram' | 'linkedin'

export default function PostPage({ id }: { id: string }) {
  const [post, setPost] = useState<Post | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [caption, setCaption] = useState('')
  const [note, setNote] = useState('')
  const [view, setView] = useState<View>('edit')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [picking, setPicking] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([getPost(id), listChannels()])
      .then(([p, c]) => { setPost(p); setCaption(p.caption); setNote(p.change_note ?? ''); setChannels(c) })
      .catch((e) => setErr(errorText(e)))
  }, [id])

  if (err) return <main className="page"><BackBtn /><p className="err">{err}</p></main>
  if (!post) return <main className="page"><p className="muted">Loading…</p></main>

  const ch = channels.find((c) => c.id === post.channel)
  const photos = post.post_photos?.map((pp) => pp.photo) ?? []
  const dirty = caption !== post.caption

  async function save(patch: Partial<Post>, msg?: string) {
    setBusy(true)
    try { const p = await updatePost(id, patch); setPost(p); if (msg) toast(msg) } catch (e) { toast(errorText(e)) }
    setBusy(false)
  }
  async function act(fn: () => Promise<Post>, msg: string) {
    setBusy(true)
    try {
      if (dirty) await updatePost(id, { caption })
      const p = await fn(); setPost(p); setCaption(p.caption); toast(msg)
    } catch (e) { toast(errorText(e)) }
    setBusy(false)
  }
  async function savePhotos(list: Photo[]) {
    try { await setPostPhotos(id, list.map((p) => p.id)); setPost(await getPost(id)) } catch (e) { toast(errorText(e)) }
  }
  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(files.length)
    const added: Photo[] = []
    for (const f of Array.from(files)) {
      try { added.push(await uploadPhoto(f)) } catch (e) { toast(errorText(e)) }
      setUploading((n) => n - 1)
    }
    if (added.length) await savePhotos([...photos, ...added])
    if (fileRef.current) fileRef.current.value = ''
  }
  function move(i: number, d: -1 | 1) {
    const list = [...photos]; const j = i + d
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    savePhotos(list)
  }

  return (
    <main className="page">
      <div className="head" style={{ alignItems: 'center' }}>
        <BackBtn />
        <StatusPill status={post.status} extra={post.show_again ? 'show again' : undefined} />
      </div>

      <div className="stack">
        <Eyebrow>{ch?.label ?? post.channel} · {TOOL_LABEL[post.tool ?? ch?.tool ?? ''] ?? ''}</Eyebrow>
        <h1 className="h1">{post.scheduled_at ? dateTime(post.scheduled_at) : 'No date yet'}</h1>
        {post.external_url && (
          <a href={post.external_url} target="_blank" rel="noreferrer" className="small" style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--blue-500)' }}>
            Open the live post<Icon name="external" size={14} />
          </a>
        )}
      </div>

      <div className="seg" role="tablist" aria-label="View">
        {(['edit', 'instagram', 'linkedin'] as View[]).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
            {v === 'edit' ? 'Edit' : v === 'instagram' ? 'Instagram' : 'LinkedIn'}
          </button>
        ))}
      </div>

      {view === 'instagram' && (
        <div className="ig">
          <div className="img">{photos[0]?.public_url && <img src={photos[0].public_url} alt="" />}</div>
          {photos.length > 1 && <div className="dots" style={{ paddingTop: 10 }}>{photos.map((p, i) => <span key={p.id} className={i === 0 ? 'on' : ''} />)}</div>}
          <div className="txt">{caption}</div>
        </div>
      )}
      {view === 'linkedin' && (
        <div className="li">
          <div className="txt">{caption}</div>
          {photos[0]?.public_url && <div className="img"><img src={photos[0].public_url} alt="" /></div>}
        </div>
      )}

      {view === 'edit' && (
        <>
          <section className="stack" style={{ gap: 10 }} aria-label="Photos">
            <div className="head" style={{ alignItems: 'baseline' }}>
              <h2 className="h2">Photos</h2>
              <span className="small">{uploading ? `Uploading ${uploading}…` : photos.length > 1 ? 'Arrows change the order' : ''}</span>
            </div>
            <div className="photos">
              {photos.map((ph, i) => (
                <div key={ph.id} className="photo">
                  {ph.public_url ? <img src={ph.public_url} alt={ph.alt ?? ''} /> : <span className="ph-label">{ph.source}<br />not uploaded yet</span>}
                  <span className="num">{i + 1}</span>
                  <button className="x" aria-label="Remove photo" onClick={() => savePhotos(photos.filter((p) => p.id !== ph.id))}><Icon name="close" size={14} /></button>
                  {photos.length > 1 && (
                    <div className="move">
                      <button aria-label="Move earlier" disabled={i === 0} style={{ visibility: i === 0 ? 'hidden' : 'visible' }} onClick={() => move(i, -1)}><Icon name="left" size={16} /></button>
                      <button aria-label="Move later" style={{ visibility: i === photos.length - 1 ? 'hidden' : 'visible' }} onClick={() => move(i, 1)}><Icon name="right" size={16} /></button>
                    </div>
                  )}
                </div>
              ))}
              <div className="addtiles">
                <button className="addtile" onClick={() => fileRef.current?.click()}>
                  <span style={{ color: 'var(--blue-500)' }}><Icon name="camera" size={24} /></span>Camera roll
                </button>
                <button className="addtile" onClick={() => setPicking(true)}>
                  <span style={{ color: 'var(--blue-500)' }}><Icon name="library" size={24} /></span>Library
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
            </div>
          </section>

          <section className="field">
            <label htmlFor="cap" className="label">Caption</label>
            <textarea id="cap" className="textarea" rows={14} value={caption} onChange={(e) => setCaption(e.target.value)}
              onBlur={() => { if (dirty) save({ caption }, 'Caption saved') }} />
            <span className="small">{caption.length} characters{ch?.network.startsWith('instagram') ? ' · Instagram max 2,200' : ch?.network === 'linkedin' ? ' · LinkedIn max 3,000' : ''}</span>
          </section>

          <section aria-label="Details">
            <div className="row"><span>When</span>
              <input type="datetime-local" className="input" style={{ width: 'auto', height: 40 }} value={toLocalInput(post.scheduled_at)}
                onChange={(e) => save({ scheduled_at: fromLocalInput(e.target.value) }, 'Time saved')} /></div>
            <div className="row"><span>Language</span><b style={{ fontWeight: 500 }}>{post.language.toUpperCase()}</b></div>
            <div className="row"><span>Pillar</span><b style={{ fontWeight: 500 }}>{post.pillar ?? '—'}</b></div>
            <div className="row"><span>Goes out via</span><b style={{ fontWeight: 500 }}>{TOOL_LABEL[post.tool ?? ch?.tool ?? ''] ?? '—'}</b></div>
          </section>
        </>
      )}

      <section className="field">
        <label htmlFor="note" className="label">Change note</label>
        <textarea id="note" className="textarea" style={{ minHeight: 80 }} rows={2} value={note}
          placeholder="What should change? Claude applies it on Monday" onChange={(e) => setNote(e.target.value)} />
      </section>

      <div className="stack" style={{ gap: 10 }}>
        <button className="btn btn-yellow btn-block" style={{ height: 56 }} disabled={busy} onClick={() => act(() => approve(id), 'Approved')}>
          <Icon name="check" size={18} stroke={2} />Approve
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} disabled={busy || !note.trim()} onClick={() => act(() => sendNote(id, note.trim()), 'Note sent')}>Send note</button>
          <button className="btn btn-outline" style={{ flex: 1 }} disabled={busy} onClick={() => act(() => showAgain(id), 'Will show again')}>Show me again</button>
        </div>
        {post.status !== 'skipped' && post.status !== 'published' && (
          <button className="btn btn-text" style={{ alignSelf: 'center' }} disabled={busy}
            onClick={() => { if (window.confirm('Skip this post? It stays in the history but won’t go out.')) save({ status: 'skipped' }, 'Skipped') }}>Skip this post</button>
        )}
      </div>

      <section className="panel stack" style={{ gap: 10 }}>
        <h2 className="h2">History</h2>
        {[...(post.history ?? [])].reverse().map((h, i) => <p key={i} className="small">{historyLine(h)}</p>)}
      </section>

      {picking && (
        <LibraryPicker exclude={photos.map((p) => p.id)} onClose={() => setPicking(false)}
          onPick={(p) => { setPicking(false); savePhotos([...photos, p]) }} />
      )}
    </main>
  )
}

function BackBtn() {
  return (
    <button className="icon-btn" aria-label="Back" onClick={() => (history.length > 1 ? history.back() : (window.location.hash = '#/'))}>
      <Icon name="back" size={18} />
    </button>
  )
}

export function LibraryPicker({ exclude, onPick, onClose }: { exclude: string[]; onPick: (p: Photo) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Photo[] | null>(null)
  useEffect(() => {
    const t = setTimeout(() => { listPhotos(q).then(setList).catch(() => setList([])) }, 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <Sheet title="Pick from the library" onClose={onClose}>
      <input className="input" placeholder="Search: ID, tag or words" value={q} onChange={(e) => setQ(e.target.value)} />
      {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? <div className="empty">No photos yet. Add them from the camera roll.</div> : (
        <div className="grid3">
          {list.filter((p) => !exclude.includes(p.id)).map((p) => (
            <button key={p.id} onClick={() => onPick(p)} aria-label={`Add photo ${p.source ?? ''}`}>
              {p.public_url && <img src={p.public_url} alt={p.alt ?? ''} loading="lazy" />}
              {p.source && p.source !== 'upload' && <span className="tag">{p.source}</span>}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
