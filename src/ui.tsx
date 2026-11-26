import { useEffect, useState, type ReactNode } from 'react'
import { STATUS_LABEL } from './lib/format'

type IconName =
  | 'plus' | 'arrow' | 'back' | 'close' | 'check' | 'pencil' | 'camera' | 'library' | 'week' | 'ideas' | 'rules'
  | 'left' | 'right' | 'copy' | 'external' | 'image' | 'home'

const PATHS: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  home: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M4 12.5l5 5L20 7" />,
  pencil: <path d="M4 20l1.5-5L16 4.5l3.5 3.5L9 18.5z" />,
  camera: <><rect x="3" y="6" width="18" height="14" rx="3" /><circle cx="12" cy="13" r="3.5" /><path d="M9 6l1.5-2h3L15 6" /></>,
  library: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 16l5-5 4 4 2-2 7 7" /></>,
  image: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 15l5-5 4 4 3-3 6 6" /></>,
  week: <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 10h18M8 2v4M16 2v4" /></>,
  ideas: <path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 21h5" />,
  rules: <path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7" />,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
}

export function Icon({ name, size = 20, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}

export function Flower({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <g fill="currentColor"><circle cx="6" cy="3" r="3" /><circle cx="6" cy="9" r="3" /><circle cx="3" cy="6" r="3" /><circle cx="9" cy="6" r="3" /></g>
    </svg>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow"><Flower />{children}</div>
}

export function StatusPill({ status, extra }: { status: string; extra?: string }) {
  return <span className={`status st-${status}`}>{STATUS_LABEL[status] ?? status}{extra ? ` · ${extra}` : ''}</span>
}

export function TabBar({ route }: { route: string }) {
  const tab = route.split('/')[1] || 'home'
  const items: [string, string, IconName][] = [
    ['home', 'Home', 'home'], ['posts', 'All posts', 'week'], ['library', 'Photos', 'library'], ['ideas', 'Ideas', 'ideas'], ['rules', 'Rules', 'rules'],
  ]
  return (
    <nav className="tabbar" aria-label="Sections">
      {items.map(([id, label, icon]) => (
        <a key={id} href={`#/${id === 'home' ? '' : id}`} aria-current={tab === id || (id === 'posts' && tab === 'post') ? 'page' : undefined}>
          <Icon name={icon} size={22} />{label}
        </a>
      ))}
    </nav>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="head" style={{ alignItems: 'center' }}>
          <h2 className="h2">{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

let toastSetter: ((s: string | null) => void) | null = null
export function toast(msg: string) { toastSetter?.(msg) }
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { toastSetter = setMsg; return () => { toastSetter = null } }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2200)
    return () => clearTimeout(t)
  }, [msg])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

export function errorText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
