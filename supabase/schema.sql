create table if not exists rfps (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  status text not null default 'TBD' check (status in ('Yes', 'No', 'TBD')),
  closing_date date,
  tender_code text,
  tender_link text,
  gdrive_link text,
  description text,
  document_links jsonb not null default '[]'::jsonb,
  summary text,
  summary_generated_at timestamptz,
  notes text,
  pipeline_stage text not null default 'Prospects' check (pipeline_stage in ('Prospects', 'Active', 'Submitted', 'Won', 'Lost')),
  created_at timestamptz not null default now()
);

alter table rfps add column if not exists description text;
alter table rfps add column if not exists document_links jsonb not null default '[]'::jsonb;
alter table rfps add column if not exists summary text;
alter table rfps add column if not exists summary_generated_at timestamptz;

create table if not exists rfp_documents (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  title text not null,
  source_filename text,
  source_type text not null default 'markdown' check (source_type in ('docx', 'pdf', 'xlsx', 'csv', 'markdown')),
  markdown text not null,
  created_at timestamptz not null default now()
);

create table if not exists rfp_comments (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  author_name text not null default 'Team',
  body text not null,
  created_at timestamptz not null default now()
);

alter table rfps enable row level security;
alter table rfp_documents enable row level security;
alter table rfp_comments enable row level security;

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

drop policy if exists "team can read rfp documents" on rfp_documents;
create policy "team can read rfp documents"
  on rfp_documents for select
  to anon
  using (true);

drop policy if exists "team can insert rfp documents" on rfp_documents;
create policy "team can insert rfp documents"
  on rfp_documents for insert
  to anon
  with check (true);

drop policy if exists "team can update rfp documents" on rfp_documents;
create policy "team can update rfp documents"
  on rfp_documents for update
  to anon
  using (true)
  with check (true);

drop policy if exists "team can delete rfp documents" on rfp_documents;
create policy "team can delete rfp documents"
  on rfp_documents for delete
  to anon
  using (true);

drop policy if exists "team can read rfp comments" on rfp_comments;
create policy "team can read rfp comments"
  on rfp_comments for select
  to anon
  using (true);

drop policy if exists "team can insert rfp comments" on rfp_comments;
create policy "team can insert rfp comments"
  on rfp_comments for insert
  to anon
  with check (true);

drop policy if exists "team can update rfp comments" on rfp_comments;
create policy "team can update rfp comments"
  on rfp_comments for update
  to anon
  using (true)
  with check (true);

drop policy if exists "team can delete rfp comments" on rfp_comments;
create policy "team can delete rfp comments"
  on rfp_comments for delete
  to anon
  using (true);
