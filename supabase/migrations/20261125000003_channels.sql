-- Channels become data, not a fixed list, so new accounts (Irina's IG / LinkedIn / FB,
-- a second Metricool, a page Claude posts to through the browser) are one INSERT.
--
-- How a channel goes out (channels.tool):
--   typefully | buffer | metricool  -> Monday run schedules it through the tool's API
--   browser                         -> "ready to post": when Arcadie/Irina is at the computer,
--                                      Claude opens post_url in their browser, fills caption +
--                                      photos, and they (or Claude, if they say so) press Publish
--   manual                          -> caption ready to copy; they post it themselves

create table public.channels (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  owner text not null check (owner in ('bigfish', 'arcadie', 'irina')),
  network text not null check (network in ('instagram', 'facebook', 'instagram_facebook', 'linkedin', 'tiktok', 'other')),
  label text not null,                 -- what the chip says, e.g. "BF IG + FB"
  tool text not null check (tool in ('typefully', 'buffer', 'metricool', 'browser', 'manual')),
  tool_ref text,                       -- the tool's own account/channel id
  post_url text,                       -- where to post by hand or in the browser
  connected boolean not null default false,
  monthly_limit int,                   -- plan limit for the status strip (null = none)
  notes text,
  active boolean not null default true,
  sort smallint not null default 0
);

alter table public.channels enable row level security;
create policy "team all" on public.channels for all to authenticated
  using ((select private.is_allowed())) with check ((select private.is_allowed()));

insert into public.channels (id, owner, network, label, tool, tool_ref, connected, monthly_limit, notes, sort) values
  ('bf_ig_fb',         'bigfish', 'instagram_facebook', 'BF IG + FB',       'metricool', null, true, 20, 'Metricool: 20 published/month on the plan', 10),
  ('bf_tiktok',        'bigfish', 'tiktok',             'BF TikTok',        'metricool', null, true, null, null, 20),
  ('bf_linkedin_page', 'bigfish', 'linkedin',           'BF LinkedIn',      'buffer',    null, true, 10, 'Big Fish Careers page; Buffer: 10 queued at a time', 30),
  ('arcadie_linkedin', 'arcadie', 'linkedin',           'Arcadie LinkedIn', 'typefully', '372499', true, 15, 'Typefully social set 372499', 40),
  ('arcadie_ig',       'arcadie', 'instagram',          'Arcadie IG',       'manual',    '6b06c7da8541f09ecb9bbee0', false, null, '@arkyk; Buffer IG channel may not auto-post (Creator account). Romanian.', 50),
  ('arcadie_fb',       'arcadie', 'facebook',           'Arcadie FB',       'manual',    null, false, null, 'Personal FB page. Romanian. Candidate for browser posting.', 60),
  ('irina_linkedin',   'irina',   'linkedin',           'Irina LinkedIn',   'manual',    null, false, null, 'Not connected yet', 70),
  ('irina_ig',         'irina',   'instagram',          'Irina IG',         'manual',    null, false, null, 'Not connected yet (maybe her own Metricool later)', 80),
  ('irina_fb',         'irina',   'facebook',           'Irina FB',         'manual',    null, false, null, 'Not connected yet', 90);

-- posts: brand → owner set now includes Irina; channel → channels table; tool may be 'browser'.
alter table public.posts drop constraint posts_brand_check;
alter table public.posts add constraint posts_brand_check check (brand in ('bigfish', 'arcadie', 'irina'));
alter table public.posts drop constraint posts_channel_check;
alter table public.posts add constraint posts_channel_fk foreign key (channel) references public.channels (id) on update cascade;
create index posts_channel_idx on public.posts (channel);
alter table public.posts drop constraint posts_tool_check;
alter table public.posts add constraint posts_tool_check check (tool in ('typefully', 'buffer', 'metricool', 'browser', 'manual'));

alter table public.ideas drop constraint ideas_brand_check;
alter table public.ideas add constraint ideas_brand_check check (brand in ('bigfish', 'arcadie', 'irina'));

-- "ready to post" queue for browser/manual channels: approved, due within 2 days.
create view public.ready_to_post with (security_invoker = true) as
  select p.*, c.label as channel_label, c.tool as channel_tool, c.post_url
  from public.posts p join public.channels c on c.id = p.channel
  where p.status = 'approved'
    and coalesce(p.tool, c.tool) in ('browser', 'manual')
    and (p.scheduled_at is null or p.scheduled_at < now() + interval '2 days');
