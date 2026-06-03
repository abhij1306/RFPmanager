create table if not exists rfps (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  status text not null default 'TBD' check (status in ('Yes', 'No', 'TBD')),
  closing_date date,
  tender_code text,
  tender_link text,
  gdrive_link text,
  description text,
  contact_person text,
  contact_phone text,
  contact_email text,
  document_links jsonb not null default '[]'::jsonb,
  summary text,
  summary_generated_at timestamptz,
  notes text,
  pipeline_stage text not null default 'Prospects' check (pipeline_stage in ('Prospects', 'Active', 'Submitted', 'Won', 'Lost')),
  created_at timestamptz not null default now()
);

alter table rfps add column if not exists description text;
alter table rfps add column if not exists contact_person text;
alter table rfps add column if not exists contact_phone text;
alter table rfps add column if not exists contact_email text;
alter table rfps add column if not exists document_links jsonb not null default '[]'::jsonb;
alter table rfps add column if not exists summary text;
alter table rfps add column if not exists summary_generated_at timestamptz;

insert into storage.buckets (id, name, public)
values ('rfp-files', 'rfp-files', false)
on conflict (id) do update set public = false;

create table if not exists rfp_files (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  kind text not null check (kind in ('source', 'response')),
  title text not null,
  original_filename text not null,
  mime_type text,
  storage_path text not null unique,
  file_size_bytes bigint,
  status text,
  notes text,
  created_by text not null default 'Team',
  created_at timestamptz not null default now()
);

create table if not exists rfp_documents (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  source_file_id uuid references rfp_files(id) on delete set null,
  title text not null,
  source_filename text,
  source_type text not null default 'markdown' check (source_type in ('docx', 'pdf', 'xlsx', 'csv', 'markdown')),
  markdown text not null,
  created_at timestamptz not null default now()
);

alter table rfp_documents add column if not exists source_file_id uuid references rfp_files(id) on delete set null;

create table if not exists rfp_comments (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  author_name text not null default 'Team',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists rfp_documents_rfp_id_created_at_idx
  on rfp_documents (rfp_id, created_at desc);

create index if not exists rfp_files_rfp_id_kind_created_at_idx
  on rfp_files (rfp_id, kind, created_at desc);

create index if not exists rfp_comments_rfp_id_created_at_idx
  on rfp_comments (rfp_id, created_at desc);

create or replace function list_document_counts_by_rfp()
returns table (rfp_id uuid, count bigint)
language sql
stable
as $$
  select rfp_documents.rfp_id, count(*)
  from rfp_documents
  group by rfp_documents.rfp_id;
$$;

create or replace function list_comment_counts_by_rfp()
returns table (rfp_id uuid, count bigint)
language sql
stable
as $$
  select rfp_comments.rfp_id, count(*)
  from rfp_comments
  group by rfp_comments.rfp_id;
$$;

create or replace function list_file_counts_by_rfp()
returns table (rfp_id uuid, count bigint)
language sql
stable
as $$
  select rfp_files.rfp_id, count(*)
  from rfp_files
  group by rfp_files.rfp_id;
$$;

alter table rfps enable row level security;
alter table rfp_files enable row level security;
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

drop policy if exists "team can read rfp files" on rfp_files;
create policy "team can read rfp files"
  on rfp_files for select
  to anon
  using (true);

drop policy if exists "team can insert rfp files" on rfp_files;
create policy "team can insert rfp files"
  on rfp_files for insert
  to anon
  with check (true);

drop policy if exists "team can update rfp files" on rfp_files;
create policy "team can update rfp files"
  on rfp_files for update
  to anon
  using (true)
  with check (true);

drop policy if exists "team can delete rfp files" on rfp_files;
create policy "team can delete rfp files"
  on rfp_files for delete
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

drop policy if exists "team can read rfp storage files" on storage.objects;
create policy "team can read rfp storage files"
  on storage.objects for select
  to anon
  using (bucket_id = 'rfp-files');

drop policy if exists "team can upload rfp storage files" on storage.objects;
create policy "team can upload rfp storage files"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'rfp-files');

drop policy if exists "team can update rfp storage files" on storage.objects;
create policy "team can update rfp storage files"
  on storage.objects for update
  to anon
  using (bucket_id = 'rfp-files')
  with check (bucket_id = 'rfp-files');

drop policy if exists "team can delete rfp storage files" on storage.objects;
create policy "team can delete rfp storage files"
  on storage.objects for delete
  to anon
  using (bucket_id = 'rfp-files');
