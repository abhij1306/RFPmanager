create table if not exists rfps (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  status text not null default 'TBD' check (status in ('Yes', 'No', 'TBD')),
  closing_date date,
  tender_code text,
  tender_link text,
  gdrive_link text,
  notes text,
  pipeline_stage text not null default 'Prospects' check (pipeline_stage in ('Prospects', 'Active', 'Submitted', 'Won', 'Lost')),
  created_at timestamptz not null default now()
);

alter table rfps enable row level security;

drop policy if exists "team can read rfps" on rfps;
create policy "team can read rfps"
  on rfps for select
  to anon
  using (true);

drop policy if exists "team can insert rfps" on rfps;
create policy "team can insert rfps"
  on rfps for insert
  to anon
  with check (true);

drop policy if exists "team can update rfps" on rfps;
create policy "team can update rfps"
  on rfps for update
  to anon
  using (true)
  with check (true);

drop policy if exists "team can delete rfps" on rfps;
create policy "team can delete rfps"
  on rfps for delete
  to anon
  using (true);
