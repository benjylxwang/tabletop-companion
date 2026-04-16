create table generation_jobs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  status       text        not null default 'pending'
                           check (status in ('pending', 'running', 'completed', 'failed')),
  campaign_id  uuid        references campaigns(id) on delete set null,
  counts       jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

alter table generation_jobs enable row level security;

create policy "users read own jobs"
  on generation_jobs for select
  using (user_id = auth.uid());

create index on generation_jobs (user_id, created_at desc);
