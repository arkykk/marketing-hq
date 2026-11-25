# Marketing HQ

One place for Big Fish + Arcadie's posts, photos, ideas, tone and rules.
Phone first. Live at hq.bigfish.careers (Cloudflare Worker, deploy main → live).

- **Supabase** project `marketing-hq` (jlvwdgbhntmqujcfbhxx, eu-central-1, org Big Fish Group)
  - Tables: posts, post_photos, photos, ideas, docs, allowed_users
  - Login: email magic link. Only emails in `allowed_users` can sign up or see data (RLS + auth trigger).
  - Storage: public bucket `post-photos` (URLs go straight into Buffer / Metricool); only the team can upload.
- Migrations: `supabase/migrations/` (already applied to the project).
- Claude threads and scheduled tasks read/write through the Supabase connector.

## Build order
1. Repo + Supabase + schema + RLS + bucket ← this PR
2. Week / Post / Review screens (phone boards first)
3. Cloudflare deploy + magic-link login
4. Seed posts, import docs and ideas
5. Sunday drafting + Monday publishing scheduled tasks
