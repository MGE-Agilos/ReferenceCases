create schema if not exists refcases;

create table if not exists refcases.reference_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  consultants jsonb not null default '[]'::jsonb,
  client_name text not null default '',
  client_confidential boolean not null default false,
  client_sector text,
  duration_start text,
  duration_end text,
  is_ongoing boolean not null default false,
  technologies jsonb not null default '[]'::jsonb,
  role text,
  team_size integer,
  context_challenge text,
  solution text,
  results text,
  testimonial text,
  language text not null default 'en',
  status text not null default 'draft',
  generated_markdown text
);

-- keep updated_at fresh
create or replace function refcases.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_updated_at on refcases.reference_cases;
create trigger trg_touch_updated_at before update on refcases.reference_cases
  for each row execute function refcases.touch_updated_at();

-- RLS: internal tool, anon key may read/write; the Edge Function uses service_role (bypasses RLS).
alter table refcases.reference_cases enable row level security;

drop policy if exists anon_all on refcases.reference_cases;
create policy anon_all on refcases.reference_cases
  for all to anon using (true) with check (true);

-- Expose the schema to PostgREST (also add "refcases" under
-- Settings -> API -> Exposed schemas in the dashboard).
grant usage on schema refcases to anon, authenticated, service_role;
grant all on refcases.reference_cases to anon, authenticated, service_role;
