import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { TabBar, Toaster } from './ui'
import SignIn from './pages/SignIn'
import Home from './pages/Home'
import Week from './pages/Week'
import PostPage from './pages/Post'
import Review from './pages/Review'
import Library from './pages/Library'
import Ideas from './pages/Ideas'
import Rules from './pages/Rules'
import Account from './pages/Account'

function useRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const route = useRoute()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <SignIn />

  const [path, query = ''] = route.split('?')
  const parts = path.split('/').filter(Boolean)
  let page
  if (parts[0] === 'post' && parts[1]) page = <PostPage id={parts[1]} />
  else if (parts[0] === 'review') page = <Review />
  else if (parts[0] === 'library') page = <Library />
  else if (parts[0] === 'ideas') page = <Ideas />
  else if (parts[0] === 'account') page = <Account email={session.user.email ?? ''} />
  else if (parts[0] === 'rules') page = <Rules email={session.user.email ?? ''} />
  else if (parts[0] === 'posts') page = <Week openNew={query.includes('new=1')} />
  else page = <Home />

  const needsPassword = !session.user.user_metadata?.password_set && parts[0] !== 'account'
  return (
    <>
      {needsPassword && (
        <a href="#/account" style={{ display: 'block', background: '#ffbd2f', color: '#000', padding: '12px 16px', fontSize: 15, fontWeight: 500, textAlign: 'center', textDecoration: 'none' }}>
          Set a password once, so you never need an email link again →
        </a>
      )}
      {parts[0] !== 'review' && <TabBar route={path} />}
      {page}
      <Toaster />
    </>
  )
}
