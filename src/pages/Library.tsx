import { useEffect, useRef, useState } from 'react'
import { listPhotos, uploadPhoto, type Photo } from '../lib/data'
import { Eyebrow, Icon, errorText, toast } from '../ui'

export default function Library() {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Photo[] | null>(null)
  const [uploading, setUploading] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  function load(search: string) { listPhotos(search).then(setList).catch((e) => { toast(errorText(e)); setList([]) }) }
  useEffect(() => { const t = setTimeout(() => load(q), 250); return () => clearTimeout(t) }, [q])

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(files.length)
    for (const f of Array.from(files)) {
      try { await uploadPhoto(f) } catch (e) { toast(errorText(e)) }
      setUploading((n) => n - 1)
    }
    if (fileRef.current) fileRef.current.value = ''
    load(q)
  }

  return (
    <main className="page">
      <div className="head">
        <div className="stack"><Eyebrow>Marketing HQ</Eyebrow><h1 className="h1">Photo library</h1>
          <p className="muted">{uploading ? `Uploading ${uploading}…` : `${list?.length ?? 0} photos`}</p></div>
        <button className="icon-btn filled" aria-label="Add photos" onClick={() => fileRef.current?.click()}><Icon name="plus" /></button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>
      <input className="input" placeholder="Search: ID (26-0519), tag or words" value={q} onChange={(e) => setQ(e.target.value)} />
      {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? (
        <div className="empty">No photos yet. Add them from your camera roll with +, or ask Claude to import the camp library.</div>
      ) : (
        <div className="grid3">
          {list.map((p) => (
            <div key={p.id}>
              {p.public_url && <img src={p.public_url} alt={p.alt ?? ''} loading="lazy" />}
              {p.source && p.source !== 'upload' && <span className="tag">{p.source}</span>}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
