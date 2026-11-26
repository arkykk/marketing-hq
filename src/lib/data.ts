import { supabase } from './supabase'

export type Status = 'draft' | 'change' | 'approved' | 'scheduled' | 'published' | 'skipped'
export type Owner = 'bigfish' | 'arcadie' | 'irina'
export type Tool = 'typefully' | 'buffer' | 'metricool' | 'browser' | 'manual'

export interface Channel {
  id: string
  owner: Owner
  network: string
  label: string
  tool: Tool
  tool_ref: string | null
  post_url: string | null
  connected: boolean
  monthly_limit: number | null
  active: boolean
  sort: number
}

export interface Photo {
  id: string
  storage_path: string | null
  public_url: string | null
  width: number | null
  height: number | null
  alt: string | null
  source: string | null
  tags: string[]
  rating: number | null
  year: number | null
}

export interface HistoryItem { at: string; by: string; event: string; status?: string; from?: string; to?: string; note?: string }

export interface Post {
  id: string
  brand: Owner
  channel: string
  language: string
  scheduled_at: string | null
  caption: string
  pillar: string | null
  status: Status
  change_note: string | null
  show_again: boolean
  tool: Tool | null
  external_id: string | null
  external_url: string | null
  pair_id: string | null
  created_by: string | null
  updated_at: string
  history: HistoryItem[]
  post_photos?: { position: number; photo: Photo }[]
}

export interface Idea { id: string; text: string; pillar: string | null; brand: Owner | null; status: string; source: string | null }
export interface Doc { slug: string; title: string; markdown: string; updated_at: string }

const POST_SELECT = '*, post_photos(position, photo:photos(*))'

function sortPhotos(p: Post): Post {
  p.post_photos = (p.post_photos ?? []).sort((a, b) => a.position - b.position)
  return p
}

export async function listChannels(): Promise<Channel[]> {
  const { data, error } = await supabase.from('channels').select('*').eq('active', true).order('sort')
  if (error) throw error
  return data as Channel[]
}

export async function listPosts(fromIso: string, toIso: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .or(`and(scheduled_at.gte.${fromIso},scheduled_at.lt.${toIso}),scheduled_at.is.null`)
    .neq('status', 'skipped')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data as Post[]).map(sortPhotos)
}

export async function listToReview(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .or('status.in.(draft,change),show_again.eq.true')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data as Post[]).map(sortPhotos)
}

export interface PlanRow { channel: string; tool: Tool | null; status: Status; scheduled_at: string | null }

/** Light rows for the tool-limit counts: every dated, not-skipped post between two instants. */
export async function listPlanRows(fromIso: string, toIso: string): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('channel, tool, status, scheduled_at')
    .gte('scheduled_at', fromIso)
    .lt('scheduled_at', toIso)
    .neq('status', 'skipped')
  if (error) throw error
  return data as PlanRow[]
}

export async function getPost(id: string): Promise<Post> {
  const { data, error } = await supabase.from('posts').select(POST_SELECT).eq('id', id).single()
  if (error) throw error
  return sortPhotos(data as Post)
}

/**
 * Linked copies of a post: same pair_id and the same text (e.g. one post for IG + FB and one for TikTok).
 * For Arcadie they are one post, so approving, notes, text and photo changes apply to all of them.
 * Copies already scheduled or posted are left alone.
 */
async function linkedCopies(id: string): Promise<string[]> {
  const { data: me, error } = await supabase.from('posts').select('pair_id, caption').eq('id', id).single()
  if (error || !me?.pair_id) return []
  const { data, error: e2 } = await supabase.from('posts').select('id')
    .eq('pair_id', me.pair_id).eq('caption', me.caption).neq('id', id)
    .not('status', 'in', '(scheduled,published,skipped)')
  if (e2) throw e2
  return (data as { id: string }[]).map((r) => r.id)
}

export async function updatePost(id: string, patch: Partial<Post>): Promise<Post> {
  const { post_photos: _omit, history: _h, ...clean } = patch
  void _omit; void _h
  const copies = await linkedCopies(id)
  const { data, error } = await supabase.from('posts').update(clean).eq('id', id).select(POST_SELECT).single()
  if (error) throw error
  if (copies.length) {
    // Dates and tools stay per channel; everything else follows.
    const { scheduled_at: _d, tool: _t, external_id: _x, external_url: _u, channel: _c, ...shared } = clean
    void _d; void _t; void _x; void _u; void _c
    if (Object.keys(shared).length) {
      const { error: e2 } = await supabase.from('posts').update(shared).in('id', copies)
      if (e2) throw e2
    }
  }
  return sortPhotos(data as Post)
}

export async function createPost(p: Pick<Post, 'brand' | 'channel' | 'language'> & { scheduled_at: string | null }): Promise<string> {
  const { data, error } = await supabase.from('posts').insert({ ...p, status: 'draft' }).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function approve(id: string) {
  return updatePost(id, { status: 'approved', show_again: false })
}
export async function sendNote(id: string, note: string) {
  return updatePost(id, { status: 'change', change_note: note, show_again: false })
}
export async function showAgain(id: string) {
  return updatePost(id, { show_again: true })
}
export async function markPublished(id: string, url: string | null) {
  return updatePost(id, { status: 'published', external_url: url })
}

// ───────── Photos ─────────

export async function listPhotos(search = ''): Promise<Photo[]> {
  let q = supabase.from('photos').select('*').order('created_at', { ascending: false }).limit(300)
  const s = search.trim().toLowerCase()
  if (s) q = q.or(`source.ilike.%${s.replace(/[%,()]/g, '')}%,alt.ilike.%${s.replace(/[%,()]/g, '')}%,tags.cs.{${s.replace(/[{},"]/g, '')}}`)
  const { data, error } = await q
  if (error) throw error
  return data as Photo[]
}

function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}

/** Upload one image from the phone into the public post-photos bucket and register it in the library. */
export async function uploadPhoto(file: File): Promise<Photo> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const now = new Date()
  const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage.from('post-photos').upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: '31536000',
  })
  if (upErr) throw upErr
  const { data: pub } = supabase.storage.from('post-photos').getPublicUrl(path)
  const size = await imageSize(file)
  const { data, error } = await supabase
    .from('photos')
    .insert({
      storage_path: path,
      public_url: pub.publicUrl,
      width: size?.width ?? null,
      height: size?.height ?? null,
      source: 'upload',
      year: now.getFullYear(),
      consent_ok: true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Photo
}

/** Replace a post's photo list with this order (on its linked copies too). */
export async function setPostPhotos(postId: string, photoIds: string[]) {
  const ids = [postId, ...(await linkedCopies(postId))]
  const { error: delErr } = await supabase.from('post_photos').delete().in('post_id', ids)
  if (delErr) throw delErr
  if (photoIds.length === 0) return
  const rows = ids.flatMap((post_id) => photoIds.map((photo_id, position) => ({ post_id, photo_id, position })))
  const { error } = await supabase.from('post_photos').insert(rows)
  if (error) throw error
}

// ───────── Ideas and docs ─────────

export async function listIdeas(): Promise<Idea[]> {
  const { data, error } = await supabase.from('ideas').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as Idea[]
}
export async function addIdea(text: string, brand: Owner | null) {
  const { error } = await supabase.from('ideas').insert({ text, brand, source: 'hq' })
  if (error) throw error
}
export async function listDocs(): Promise<Doc[]> {
  const { data, error } = await supabase.from('docs').select('*').order('title')
  if (error) throw error
  return data as Doc[]
}
export async function saveDoc(slug: string, markdown: string) {
  const { error } = await supabase.from('docs').update({ markdown }).eq('slug', slug)
  if (error) throw error
}
