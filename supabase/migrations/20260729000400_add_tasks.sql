-- Calendar task management.
-- Safe to run multiple times and preserves existing records.

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null,
  recorded_date date,
  due_date date,
  assignee_id text,
  assignee_name text not null default '',
  title text not null default '',
  content text not null default '',
  status text not null default '未着手',
  priority text not null default '中',
  customer_id text,
  project_id text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.tasks add column if not exists user_id uuid;
alter table public.tasks add column if not exists recorded_date date;
alter table public.tasks add column if not exists due_date date;
alter table public.tasks add column if not exists assignee_id text;
alter table public.tasks add column if not exists assignee_name text not null default '';
alter table public.tasks add column if not exists title text not null default '';
alter table public.tasks add column if not exists content text not null default '';
alter table public.tasks add column if not exists status text not null default '未着手';
alter table public.tasks add column if not exists priority text not null default '中';
alter table public.tasks add column if not exists customer_id text;
alter table public.tasks add column if not exists project_id text;
alter table public.tasks add column if not exists created_by uuid;
alter table public.tasks add column if not exists created_by_name text;
alter table public.tasks add column if not exists created_at timestamptz not null default now();
alter table public.tasks add column if not exists updated_at timestamptz not null default now();
alter table public.tasks add column if not exists deleted_at timestamptz;

alter table public.tasks
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('未着手', '対応中', '完了', '保留'));

alter table public.tasks
  drop constraint if exists tasks_priority_check;

alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('高', '中', '低'));

create index if not exists idx_tasks_user_due_date on public.tasks (user_id, due_date);
create index if not exists idx_tasks_user_status on public.tasks (user_id, status);
create index if not exists idx_tasks_user_priority on public.tasks (user_id, priority);
create index if not exists idx_tasks_user_customer on public.tasks (user_id, customer_id);
create index if not exists idx_tasks_user_project on public.tasks (user_id, project_id);
create index if not exists idx_tasks_user_updated_at on public.tasks (user_id, updated_at desc);

alter table public.tasks enable row level security;

grant select, insert, update, delete on public.tasks to authenticated;

drop policy if exists "Allow authenticated read own tasks" on public.tasks;
drop policy if exists "Allow authenticated insert own tasks" on public.tasks;
drop policy if exists "Allow authenticated update own tasks" on public.tasks;
drop policy if exists "Allow authenticated delete own tasks" on public.tasks;

create policy "Allow authenticated read own tasks"
  on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Allow authenticated insert own tasks"
  on public.tasks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Allow authenticated update own tasks"
  on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Allow authenticated delete own tasks"
  on public.tasks
  for delete to authenticated
  using ((select auth.uid()) = user_id);
