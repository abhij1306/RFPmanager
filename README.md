# RFP Manager

A small team tool for managing RFP opportunities and converting RFP documents into Markdown for AI-assisted review.

## What It Includes

- Shared RFP tracker backed by Supabase Postgres.
- Add, edit, delete, filter, and open linked tender or Google Drive records.
- Save comments and converted Markdown documents against each RFP.
- Save original uploaded tender files and generated response files against each RFP.
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

## Runtime Dependencies

The current document converter runs in the browser. Team members do not need to install LibreOffice, Python, Pandoc, MarkItDown, Docling, or any other external conversion tool for the existing DOCX, PDF, XLSX, and CSV conversion flow. Running `npm install` is enough for the app dependencies.

The app still needs:

- A Supabase project for shared RFP, comment, and saved Markdown storage.
- `GROQ_API_KEY` only if summary generation should work.

PPTX conversion is not currently supported. If PPTX support is added through a server-side tool such as MarkItDown, Docling, or LibreOffice, document the required Python/system packages and deployment setup here before sharing that version with the team.

## Supabase Setup

Create a Supabase project and run [supabase/schema.sql](supabase/schema.sql) in the SQL editor. Re-run the same schema after pulling updates; it creates the RFP, saved Markdown document, and comment tables if they do not already exist.

The schema also creates a private Supabase Storage bucket named `rfp-files` for original tender documents and response files.

The schema enables Row Level Security and allows anonymous team access for this private shared app. Anyone with the deployed URL and anon key can read and write RFPs, comments, saved Markdown, original files, and response files, so share the URL only with your team.

## ChatGPT Actions Integration

Use this when you want team members to use one shared Custom GPT that can read and update RFPmanager. This setup uses one shared API key. Team members do not need to sign in to RFPmanager from ChatGPT.

### What You Build Once

- One shared Custom GPT or ChatGPT app for the team.
- One shared `CHATGPT_ACTIONS_API_KEY` secret.
- ChatGPT-facing API routes:
  - `GET /api/chatgpt/rfps`
  - `POST /api/chatgpt/rfps`
  - `GET /api/chatgpt/rfps/{id}`
  - `PATCH /api/chatgpt/rfps/{id}`
  - `GET /api/chatgpt/rfps/{id}/documents`
  - `GET /api/chatgpt/rfps/{id}/documents/{documentId}`
  - `GET /api/chatgpt/rfps/{id}/source-files`
  - `POST /api/chatgpt/rfps/{id}/documents/convert`
  - `POST /api/chatgpt/rfps/{id}/summary`
  - `GET /api/chatgpt/rfps/{id}/responses`
  - `POST /api/chatgpt/rfps/{id}/responses`
- An OpenAPI Actions schema based on [docs/chatgpt-actions-openapi.yaml](docs/chatgpt-actions-openapi.yaml).

Team members do not create their own GPTs. They use the shared GPT.

### 1. Create The Shared API Key

Generate a long random secret and add it to `.env.local` for local development and to Vercel for production:

```bash
CHATGPT_ACTIONS_API_KEY=replace-with-a-long-random-secret
```

You can generate one with:

```bash
node -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

### 2. Configure The Shared GPT Action

In the GPT builder:

1. Create or edit the shared RFPmanager GPT.
2. Add an Action.
3. Import [docs/chatgpt-actions-openapi.yaml](docs/chatgpt-actions-openapi.yaml).
4. Replace `https://YOUR-VERCEL-DOMAIN.example.com` with your deployed app URL.
5. Set authentication to **API Key**.
6. Set the API key value to the same value as `CHATGPT_ACTIONS_API_KEY`.
7. Send the API key as a bearer token in the `Authorization` header.

### 3. Suggested GPT Instructions

Paste this into the GPT instructions and adjust names as needed:

```text
You are RFPmanager, an assistant for a bid team using the shared RFPmanager app.

Use RFPmanager actions whenever the user asks about RFP opportunities, pipeline status, active/submitted/won/lost/prospect records, deadlines, tender codes, tender links, Google Drive links, contacts, notes, bid status, summaries, uploaded tender documents, proposal response files, or creating/updating RFP records.

Do not ask users for internal UUIDs. If the user gives a client name, tender code, opportunity name, or plain-language description, call listRfps with the search parameter. Use the returned id for getRfp, updateRfp, document, summary, and response actions. Ask a follow-up only if search returns no match or multiple plausible matches.

For list, pipeline, and deadline requests, call listRfps. Prioritize Active opportunities and upcoming deadlines. Report closing dates exactly as stored. If no closing date exists, say it is not recorded.

Before creating or updating records, confirm important missing or ambiguous fields. Update only the fields the user asked to change. Preserve existing data unless the user explicitly asks to replace it.

When reviewing or summarizing an RFP, first identify the RFP with listRfps search if needed. Then call listRfpDocuments. This returns lightweight document metadata only: document IDs, lengths, and short previews. It does not return source files, download URLs, or full Markdown. To read saved Markdown, call getRfpDocumentMarkdown for one document at a time with offset and limit. Start at offset 0. If has_more is true, continue with next_offset only when more document text is needed. Do not retrieve all Markdown for all documents in one response.

Use listRfpSourceFiles only when the user specifically needs original source file objects or temporary download URLs. Do not call it as part of normal summary generation if saved Markdown is available.

Generate summaries yourself after reviewing the available saved Markdown. Then use saveRfpSummary to store the completed summary. Do not ask RFPmanager to generate the summary.

When the user uploads tender documents in ChatGPT, first identify the target RFP. Then use convertAndSaveRfpDocuments to save the original files and converted Markdown. After conversion, use listRfpDocuments and getRfpDocumentMarkdown if analysis is requested.

When creating proposal response files, generate the files first, then use saveRfpResponses so they are stored against the correct RFP.

Do not invent RFP records, deadlines, tender codes, links, contacts, notes, summaries, evaluation criteria, statuses, or bid decisions. If information is not available, say it is not recorded. If no matching RFP exists, say RFPmanager has no matching record and ask for a client name, tender code, or other human-readable identifier.

Keep responses concise and practical. After creating or updating an RFP, summarize the fields saved, mention important missing fields, and highlight upcoming deadlines when relevant. After saving summaries, documents, or response files, confirm what was saved and which RFP it was saved against.
```

### 4. Current Security Note

The ChatGPT routes require the shared API key, but the app is still designed as a private shared team tool. Anyone with the deployed app URL and Supabase anon key can use the normal app, and anyone with the ChatGPT Actions API key can call the ChatGPT-facing API routes.

Keep these values private:

- The deployed app URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `CHATGPT_ACTIONS_API_KEY`.

If you later need per-user access, audit trails, or stronger isolation, replace this shared API key setup with Supabase Auth and OAuth.

## Vercel Deployment

1. Push this repo to GitHub.
2. Import the repository in Vercel.
3. Add these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GROQ_API_KEY`
   - `CHATGPT_ACTIONS_API_KEY`
4. Deploy.

## Tender Import

Open `/bookmarklet`, copy the generated bookmarklet, and paste it into a browser bookmark URL. On a tender page, click the bookmark to send tender details and document links to `/api/rfp`; the app creates the RFP and opens its detail page.

## Scripts

```bash
npm run dev
npm run build
npm run test
```
https://chatgpt.com/g/g-6a204eb74ff0819197b925c02a12e970-rfpmanager
