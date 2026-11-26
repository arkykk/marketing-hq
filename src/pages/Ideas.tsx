import { useEffect, useState } from 'react'
import { addIdea, listIdeas, type Idea, type Owner } from '../lib/data'
import { OWNER_LABEL } from '../lib/format'
import { Eyebrow, Icon, Sheet, errorText, toast } from '../ui'

export default function Ideas() {
  const [list, setList] = useState<Idea[] | null>(null)
  const [show, setShow] = useState<'open' | 'used'>('open')
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [brand, setBrand] = useState<Owner | ''>('')

  function load() { listIdeas().then(setList).catch((e) => toast(errorText(e))) }
  useEffect(load, [])

  async function save() {
    try { await addIdea(text.trim(), brand || null); setAdding(false); setText(''); toast('Idea saved'); load() } catch (e) { toast(errorText(e)) }
  }

  const visible = (list ?? []).filter((x) => (show === 'open' ? x.status === 'open' : x.status !== 'open'))

  return (
    <main className="page">
      <div className="head">
        <div className="stack"><Eyebrow>Marketing HQ</Eyebrow><h1 className="h1">Ideas</h1></div>
        <button className="icon-btn filled" aria-label="Add an idea" onClick={() => setAdding(true)}><Icon name="plus" /></button>
      </div>
      <div className="filters">
        <button className="filter" aria-pressed={show === 'open'} onClick={() => setShow('open')}>Open</button>
        <button className="filter" aria-pressed={show === 'used'} onClick={() => setShow('used')}>Used</button>
      </div>
      {list === null ? <p className="muted">Loading…</p> : visible.length === 0 ? <div className="empty">No ideas here yet.</div> : (
        <div className="stack" style={{ gap: 10 }}>
          {visible.map((x) => (
            <div key={x.id} className="card" style={{ flexDirection: 'column', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4 }}>{x.text}</p>
              <div className="chips">
                {x.brand && <span className="chip">{OWNER_LABEL[x.brand]}</span>}
                {x.pillar && <span className="chip">{x.pillar}</span>}
                {x.status !== 'open' && <span className="small">{x.status}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <Sheet title="New idea" onClose={() => setAdding(false)}>
          <textarea className="textarea" autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="A story, a question parents ask, a photo that needs a post…" />
          <div className="filters">
            {(['', 'bigfish', 'arcadie', 'irina'] as const).map((b) => (
              <button key={b} className="filter" aria-pressed={brand === b} onClick={() => setBrand(b)}>{b ? OWNER_LABEL[b] : 'Any'}</button>
            ))}
          </div>
          <button className="btn btn-blue btn-block" disabled={!text.trim()} onClick={save}>Save idea</button>
        </Sheet>
      )}
    </main>
  )
}
