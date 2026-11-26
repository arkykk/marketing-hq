-- Move the security-definer helpers out of the exposed API schema (advisor 0028/0029).
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_allowed() set schema private;
alter function public.enforce_allowlist() set schema private;
revoke all on function private.is_allowed() from public, anon;
grant execute on function private.is_allowed() to authenticated;
revoke all on function private.enforce_allowlist() from public, anon, authenticated;
