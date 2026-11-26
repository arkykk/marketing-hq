import { useEffect, useState } from 'react'
import { listDocs, saveDoc, type Doc } from '../lib/data'
import { Eyebrow, Icon, errorText, toast } from '../ui'

/** Strategy, tone of voice, rules and plans. Read-only on phones, editable on a laptop. */
export default function Rules({ email: _email }: { email: string }) {
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches
  void _email

  useEffect(() => { listDocs().then(setDocs).catch((e) => toast(errorText(e))) }, [])

  const doc = docs?.find((d) => d.slug === open)

  if (doc) {
    return (
      <main className="page">
        <div className="head" style={{ alignItems: 'center' }}>
          <button className="icon-btn" aria-label="Back" onClick={() => { setOpen(null); setEditing(false) }}><Icon name="back" size={18} /></button>
          {wide && !editing && <button className="btn btn-outline" onClick={() => { setDraft(doc.markdown); setEditing(true) }}><Icon name="pencil" size={16} />Edit</button>}
        </div>
        <h1 className="h1">{doc.title}</h1>
        {editing ? (
          <>
            <textarea className="textarea" style={{ minHeight: '60vh', fontSize: 15 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-blue" onClick={async () => {
                try { await saveDoc(doc.slug, draft); setDocs(docs!.map((d) => (d.slug === doc.slug ? { ...d, markdown: draft } : d))); setEditing(false); toast('Saved') } catch (e) { toast(errorText(e)) }
              }}>Save</button>
              <button className="btn btn-text" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </>
        ) : <div className="md">{doc.markdown}</div>}
      </main>
    )
  }

  return (
    <main className="page">
      <div className="stack"><Eyebrow>Marketing HQ</Eyebrow><h1 className="h1">Rules and plans</h1>
        <p className="muted">What every Claude thread reads before writing a post.</p>
        <a className="btn btn-outline" style={{ alignSelf: 'flex-start' }} href="#/account">Account and password</a></div>
      {docs === null ? <p className="muted">Loading…</p> : docs.length === 0 ? <div className="empty">No docs imported yet.</div> : (
        <div className="stack" style={{ gap: 10 }}>
          {docs.map((d) => (
            <button key={d.slug} className="card" style={{ border: 'none', textAlign: 'left', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setOpen(d.slug)}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>{d.title}</span><Icon name="right" size={18} />
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
