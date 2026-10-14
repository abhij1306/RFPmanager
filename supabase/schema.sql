create table if not exists rfps (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  status text not null default 'TBD' check (status in ('Yes', 'No', 'TBD')),
  closing_date date,
  closing_date_text text,
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
  response_draft_title text,
  response_draft_content text,
  response_draft_saved_at timestamptz,
  notes text,
  pipeline_stage text not null default 'Prospects' check (pipeline_stage in ('Prospects', 'Active', 'Submitted', 'Won', 'Lost')),
  created_at timestamptz not null default now()
);

alter table rfps add column if not exists description text;
alter table rfps add column if not exists closing_date_text text;
alter table rfps add column if not exists contact_person text;
alter table rfps add column if not exists contact_phone text;
alter table rfps add column if not exists contact_email text;
alter table rfps add column if not exists document_links jsonb not null default '[]'::jsonb;
alter table rfps add column if not exists summary text;
alter table rfps add column if not exists summary_generated_at timestamptz;
alter table rfps add column if not exists response_draft_title text;
alter table rfps add column if not exists response_draft_content text;
alter table rfps add column if not exists response_draft_saved_at timestamptz;

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

-- ---------------------------------------------------------------------------
-- Performance (apply in Supabase SQL editor)
-- Idempotent: safe to run more than once. The app works without it (it falls
-- back to plain table queries) but MCP/API reads get faster once applied.
-- ---------------------------------------------------------------------------

-- Indexes -------------------------------------------------------------------

create index if not exists rfp_documents_created_at_idx
  on rfp_documents (created_at desc);

create index if not exists rfps_closing_date_created_at_idx
  on rfps (closing_date asc nulls last, created_at desc);

create index if not exists rfp_files_source_rfp_id_idx
  on rfp_files (rfp_id)
  where kind = 'source';

-- Helpers -------------------------------------------------------------------

-- Length in UTF-16 code units, i.e. JavaScript's String#length. Differs from
-- char_length() only for characters outside the Basic Multilingual Plane
-- (emoji, some math symbols), which count as 2 in JavaScript.
create or replace function rfp_utf16_length(value text)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when value ~ '[\U00010000-\U0010FFFF]'
      then char_length(value) + char_length(regexp_replace(value, '[^\U00010000-\U0010FFFF]', '', 'g'))
    else char_length(value)
  end;
$$;

-- RPCs ----------------------------------------------------------------------

-- One page of document summaries for an RFP without shipping Markdown bodies.
-- The page is chosen first (no Markdown touched), then lengths/previews are
-- computed only for the rows on that page.
create or replace function list_rfp_document_summaries(p_rfp_id uuid, p_limit integer default 10, p_offset integer default 0)
returns table (
  id uuid,
  rfp_id uuid,
  source_file_id uuid,
  title text,
  source_filename text,
  source_type text,
  created_at timestamptz,
  markdown_length integer,
  markdown_preview text,
  total_count bigint
)
language sql
stable
as $$
  with page as (
    select d.id, d.created_at, count(*) over () as total_count
    from rfp_documents d
    where d.rfp_id = p_rfp_id
    order by d.created_at desc, d.id
    limit greatest(p_limit, 0)
    offset greatest(p_offset, 0)
  )
  select
    d.id,
    d.rfp_id,
    d.source_file_id,
    d.title,
    d.source_filename,
    d.source_type,
    d.created_at,
    rfp_utf16_length(d.markdown),
    left(d.markdown, 500),
    page.total_count
  from page
  join rfp_documents d on d.id = page.id
  order by page.created_at desc, page.id;
$$;

-- A bounded slice of one document plus its metadata. Offsets are UTF-16 code
-- units (JavaScript semantics); for the rare document containing characters
-- outside the BMP the whole Markdown is returned (is_full_markdown = true) and
-- the app slices it, so results always match the JavaScript implementation.
create or replace function get_rfp_document_excerpt(
  p_rfp_id uuid,
  p_document_id uuid,
  p_offset integer default 0,
  p_limit integer default 45000
)
returns table (
  id uuid,
  rfp_id uuid,
  source_file_id uuid,
  title text,
  source_filename text,
  source_type text,
  created_at timestamptz,
  markdown_length integer,
  markdown_preview text,
  markdown text,
  is_full_markdown boolean
)
language sql
stable
as $$
  select
    d.id,
    d.rfp_id,
    d.source_file_id,
    d.title,
    d.source_filename,
    d.source_type,
    d.created_at,
    rfp_utf16_length(d.markdown),
    left(d.markdown, 500),
    case
      when d.has_astral then d.markdown
      else substr(d.markdown, greatest(p_offset, 0) + 1, greatest(p_limit, 0))
    end,
    d.has_astral
  from (
    select doc.*, doc.markdown ~ '[\U00010000-\U0010FFFF]' as has_astral
    from rfp_documents doc
    where doc.rfp_id = p_rfp_id and doc.id = p_document_id
  ) d;
$$;

create or replace function list_source_file_counts_by_rfp()
returns table (rfp_id uuid, count bigint)
language sql
stable
as $$
  select rfp_files.rfp_id, count(*)
  from rfp_files
  where rfp_files.kind = 'source'
  group by rfp_files.rfp_id;
$$;

-- Make the new functions visible to the API immediately.
notify pgrst, 'reload schema';

-- Optional sanity check after applying (expect 3 and 2):
--   select rfp_utf16_length('a' || chr(128512) || 'b'), char_length('a' || chr(128512));

-- One row per answered question. bot_message_ids holds every Telegram message
-- the answer was split into, so a reply to any part of it finds the exchange.
-- reply_to_bot_message_id links a follow-up to the bot message it replied to,
-- which is how reply threads are walked back.
create table if not exists telegram_exchanges (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  question_message_id bigint not null,
  reply_to_bot_message_id bigint,
  bot_message_ids bigint[] not null,
  asker_name text not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

create index if not exists telegram_exchanges_chat_id_created_at_idx
  on telegram_exchanges (chat_id, created_at desc);

create index if not exists telegram_exchanges_bot_message_ids_idx
  on telegram_exchanges using gin (bot_message_ids);

alter table telegram_exchanges enable row level security;

drop policy if exists "bot can read telegram exchanges" on telegram_exchanges;
create policy "bot can read telegram exchanges"
  on telegram_exchanges for select
  to anon
  using (true);

drop policy if exists "bot can insert telegram exchanges" on telegram_exchanges;
create policy "bot can insert telegram exchanges"
  on telegram_exchanges for insert
  to anon
  with check (true);

-- /clear: deletes only one chat's exchanges (the anon role has no delete policy).
create or replace function clear_telegram_memory(p_chat_id bigint)
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from telegram_exchanges where chat_id = p_chat_id returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function clear_telegram_memory(bigint) from public;
grant execute on function clear_telegram_memory(bigint) to anon;

-- Retention: nightly delete of exchanges older than 7 days (no anon delete policy).
create extension if not exists pg_cron;
select cron.schedule(
  'telegram-exchanges-retention',
  '17 3 * * *',
  $$delete from telegram_exchanges where created_at < now() - interval '7 days'$$
);

notify pgrst, 'reload schema';
