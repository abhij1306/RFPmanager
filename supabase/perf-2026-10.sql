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
