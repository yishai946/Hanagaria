-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists projects_user_created on public.projects (user_id, created_at desc);

-- Each user can only see and change their own rows.
alter table public.projects enable row level security;
create policy "own projects" on public.projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
