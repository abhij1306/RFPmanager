# RFP Manager

A small team tool for managing RFP opportunities and converting RFP documents into Markdown for AI-assisted review.

## What It Includes

- Shared RFP tracker backed by Supabase Postgres.
- Add, edit, delete, filter, and open linked tender or Google Drive records.
- Save comments and converted Markdown documents against each RFP.
- Client-side DOCX/PDF/Excel/CSV to Markdown converter.
- Browser bookmarklet for importing tender details and document links from tender pages.
- Groq-powered summary generation from saved Markdown.
- Vercel-ready Next.js App Router project.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Add your Supabase URL and anon key to `.env.local`.

4. Add `GROQ_API_KEY` to enable summary generation.

5. Create or update the database tables using [supabase/schema.sql](supabase/schema.sql).

6. Run the app:

```bash
npm run dev
```

## Supabase Setup

Create a Supabase project and run [supabase/schema.sql](supabase/schema.sql) in the SQL editor. Re-run the same schema after pulling updates; it creates the RFP, saved Markdown document, and comment tables if they do not already exist.

The schema enables Row Level Security and allows anonymous team access for this private shared app. Anyone with the deployed URL and anon key can read and write RFPs, comments, and saved Markdown, so share the URL only with your team.

## Vercel Deployment

1. Push this repo to GitHub.
2. Import the repository in Vercel.
3. Add these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GROQ_API_KEY`
4. Deploy.

## Tender Import

Open `/bookmarklet`, copy the generated bookmarklet, and paste it into a browser bookmark URL. On a tender page, click the bookmark to send tender details and document links to `/api/rfp`; the app creates the RFP and opens its detail page.

## Scripts

```bash
npm run dev
npm run build
npm run test
```
