import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from '../ui'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) {
      setErr(/database error|not allowed|signups/i.test(error.message)
        ? 'This email isn’t on the Marketing HQ list.'
        : error.message)
      return
    }
    setSent(true)
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: 'linear-gradient(180deg, #696fe1 0%, #444bda 42%, #363cae 72%, #292d83 100%)',
        color: '#fff', padding: 'calc(env(safe-area-inset-top, 0px) + 56px) 24px 96px', textAlign: 'center',
      }}>
        <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 500, color: '#ffbd2f' }}>Big Fish</p>
        <h1 className="h1" style={{ color: '#fff' }}>Marketing HQ</h1>
      </div>
      <div style={{ padding: '0 16px', marginTop: -64 }}>
        <form onSubmit={submit} style={{
          maxWidth: 440, margin: '0 auto', background: '#fff', borderRadius: 32, padding: 28,
          boxShadow: '0 4px 24px rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {sent ? (
            <>
              <h2 className="h2">Check your email</h2>
              <p className="muted">We sent a sign-in link to <b style={{ color: '#000', fontWeight: 500 }}>{email}</b>. Open it on this device.</p>
              <button type="button" className="btn btn-text" onClick={() => setSent(false)}>Use another email</button>
            </>
          ) : (
            <>
              <label className="field">
                <span style={{ fontSize: 15 }}>Email</span>
                <input className="input" type="email" required autoComplete="email" inputMode="email"
                  placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              {err && <p className="err">{err}</p>}
              <button className="btn btn-blue btn-block" disabled={busy}>
                {busy ? 'Sending…' : 'Send me a sign-in link'}<Icon name="arrow" size={16} />
              </button>
              <p className="small" style={{ textAlign: 'center' }}>No password: the link signs you in.</p>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
