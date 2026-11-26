import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from '../ui'

/** Email + password; the emailed link stays as the way in for a first visit or a forgotten password. */
export default function SignIn() {
  const [mode, setMode] = useState<'password' | 'link'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function friendly(message: string) {
    if (/database error|not allowed|signups/i.test(message)) return 'This email isn’t on the Marketing HQ list.'
    if (/invalid login credentials/i.test(message)) return 'Wrong email or password. No password yet? Use “Email me a link” below, then set one in Account.'
    if (/rate limit/i.test(message)) return 'Too many sign-in emails in the last hour. Try again in an hour, or sign in with your password.'
    if (/email not confirmed/i.test(message)) return 'This email isn’t confirmed yet: use “Email me a link” once.'
    return message
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const addr = email.trim().toLowerCase()
    const { error } = mode === 'password'
      ? await supabase.auth.signInWithPassword({ email: addr, password })
      : await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: window.location.origin, shouldCreateUser: true } })
    setBusy(false)
    if (error) { setErr(friendly(error.message)); return }
    if (mode === 'link') setSent(true)
  }

  function switchMode() { setMode(mode === 'password' ? 'link' : 'password'); setErr(null) }

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
              <p className="muted">We sent a sign-in link to <b style={{ color: '#000', fontWeight: 500 }}>{email}</b>. Open it, then set a password in Account so you won’t need links again.</p>
              <button type="button" className="btn btn-text" onClick={() => { setSent(false); setMode('password') }}>Back to sign in</button>
            </>
          ) : (
            <>
              <label className="field">
                <span style={{ fontSize: 15 }}>Email</span>
                <input className="input" type="email" required autoComplete="username" inputMode="email"
                  placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              {mode === 'password' && (
                <label className="field">
                  <span style={{ fontSize: 15 }}>Password</span>
                  <input className="input" type="password" required autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
              )}
              {err && <p className="err">{err}</p>}
              <button className="btn btn-blue btn-block" disabled={busy}>
                {busy ? (mode === 'password' ? 'Signing in…' : 'Sending…') : (mode === 'password' ? 'Sign in' : 'Email me a sign-in link')}
                <Icon name="arrow" size={16} />
              </button>
              <button type="button" className="btn btn-text" onClick={switchMode}>
                {mode === 'password' ? 'No password yet, or forgot it? Email me a link' : 'I have a password'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
