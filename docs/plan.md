# RFP Manager — App Plan
**Simple, free, team-shareable | Vercel + Supabase**

---

## What it does (no more, no less)

1. **RFP tracker** — shared table your team can all see and edit (replaces the Google Sheet)
2. **Document converter** — upload a PDF/DOCX → get Markdown → copy to clipboard for Claude

That's it. No auth complexity, no file storage, no comments system.

---

## Stack decision

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) | You already use it |
| Hosting | Vercel free tier | Zero config deploy from GitHub |
| Database | Supabase free tier | Shared across team, simple Postgres, no backend to maintain |
| Doc conversion | `mammoth.js` (DOCX) + `pdf.js` + `turndown` (PDF) | Client-side only, no server needed |

**Why not GitHub Pages:** It's static only. Supabase calls work from GitHub Pages too, but you'd lose the serverless option later. Vercel is the right default given your stack.

**Why client-side conversion:** Avoids a Python serverless function entirely. `mammoth.js` produces very clean Markdown from DOCX. PDF is messier client-side but good enough for copy-to-clipboard use.

---

## Data model (Supabase, one table)

```sql
create table rfps (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  status text default 'TBD',        -- 'Yes' | 'No' | 'TBD'
  closing_date date,
  tender_code text,
  tender_link text,
  gdrive_link text,
  notes text,
  pipeline_stage text default 'Prospects',  -- 'Prospects' | 'Active' | 'Submitted' | 'Won' | 'Lost'
  created_at timestamptz default now()
);
```

Five extra minutes: enable Row Level Security → share a single anon key with the team. No login needed for now.

---

## App structure (4 pages / components)

```
/                   → RFP table (sortable, filterable by status/stage)
/rfp/[id]           → RFP detail + edit form
/rfp/new            → Add new RFP (same form)
/convert            → Document → Markdown converter
```

### Page 1: RFP Dashboard `/`
- Table columns from your sheet: Client Name | Status | Closing Date | Tender Code | Links | Pipeline Stage
- "Add RFP" button → `/rfp/new`
- Click row → `/rfp/[id]`
- Filter pills: All / Active / Submitted / Closing Soon (≤7 days)
- Closing date turns **red** if overdue, **amber** if ≤7 days

### Page 2: RFP Detail + Edit `/rfp/[id]`
- All fields editable inline
- "Open Tender Link" and "Open Google Drive" buttons
- Delete button
- Notes textarea (free text, for context/status updates)

### Page 3: Add RFP `/rfp/new`
- Simple form: client name, status, closing date, tender code, tender link, gdrive link, pipeline stage
- Submit → saves to Supabase → redirect to dashboard

### Page 4: Document Converter `/convert`
- Drag-and-drop or file picker
- Supported: `.pdf`, `.docx`
- On upload: converts client-side → shows Markdown preview
- "Copy to Clipboard" button
- No file is stored anywhere — purely local in-browser conversion

---

## What's NOT in v1 (deliberately)

- ❌ Authentication / login (use Supabase anon key, share URL with team privately)
- ❌ File storage (just links to Google Drive / tender portals)
- ❌ Comments or activity log
- ❌ Email reminders (can add later)
- ❌ XLSX/PPTX conversion (add later, DOCX + PDF covers 90% of RFP docs)

---

## Folder structure

```
rfp-manager/
├── app/
│   ├── page.tsx               # Dashboard
│   ├── rfp/
│   │   ├── new/page.tsx       # Add form
│   │   └── [id]/page.tsx      # Detail + edit
│   └── convert/page.tsx       # Doc converter
├── components/
│   ├── RFPTable.tsx
│   ├── RFPForm.tsx
│   └── DocConverter.tsx
├── lib/
│   └── supabase.ts            # Supabase client (2 lines)
└── .env.local
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## pnpm deps (only new ones)

```bash
pnpm add @supabase/supabase-js mammoth turndown pdfjs-dist
```

---

## Deployment (one-time, ~15 min)

1. Create Supabase project → run the SQL above → copy URL + anon key
2. Push repo to GitHub
3. Import to Vercel → add env vars → deploy
4. Share the Vercel URL with team

---

## Effort estimate

| Piece | Time |
|---|---|
| Supabase setup + table | 15 min |
| Dashboard + RFP table | 1–2 hrs |
| Add/Edit form | 1 hr |
| Doc converter component | 1–2 hrs |
| Deploy + test | 30 min |
| **Total** | **~5 hrs** |

---

## Design system

Reuse your existing **Obsidian Data Console** tokens (sky-400 accent, slate-950/900/800 surfaces, IBM Plex Sans + JetBrains Mono) — this keeps it consistent with CrawlerAI and takes zero design decisions.

---

*Plan v1 | June 2026*
