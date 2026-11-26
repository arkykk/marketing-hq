import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Eyebrow, Icon, errorText, toast } from '../ui'

/** Set or change your password, sign out. */
export default function Account({ email }: { email: string }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return }
    if (pw !== pw2) { setErr('The two passwords don’t match.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw, data: { password_set: true } })
    setBusy(false)
    if (error) { setErr(errorText(error)); return }
    setPw(''); setPw2('')
    toast('Password saved. Next time: email + password.')
  }

  return (
    <main className="page">
      <div className="stack"><Eyebrow>Marketing HQ</Eyebrow><h1 className="h1">Account</h1>
        <p className="muted">Signed in as <b style={{ color: '#000', fontWeight: 500 }}>{email}</b>. You stay signed in on this device.</p></div>
      <form onSubmit={save} className="stack" style={{ gap: 16, maxWidth: 440 }}>
        <h2 className="h2">Password</h2>
        <p className="muted" style={{ margin: 0 }}>Set it once, then sign in with email + password on any device. No more email links.</p>
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <label className="field"><span style={{ fontSize: 15 }}>New password</span>
          <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label className="field"><span style={{ fontSize: 15 }}>Same password again</span>
          <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn btn-blue" disabled={busy}>{busy ? 'Saving…' : 'Save password'}<Icon name="arrow" size={16} /></button>
      </form>
      <button className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  )
}
