# RFP Manager

A small team tool for managing RFP opportunities and converting RFP documents into Markdown for AI-assisted review.

## What It Includes

- Shared RFP tracker backed by Supabase Postgres.
- Add, edit, delete, filter, and open linked tender or Google Drive records.
- Save comments and converted Markdown documents against each RFP.
- Save original uploaded tender files, editable response drafts, and generated response files against each RFP.
- Client-side DOCX/PDF/Excel/CSV to Markdown converter.
- Browser bookmarklet for importing tender details and document links from tender pages.
- Groq-powered summary generation from saved Markdown.
- ChatGPT Actions endpoints for saving summaries, response drafts, documents, and response files.
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

The schema also adds editable response draft fields to RFP records and creates a private Supabase Storage bucket named `rfp-files` for original tender documents and response files.

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
  - `POST /api/chatgpt/rfps/{id}/responses/text`
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

Use RFPmanager actions whenever the user asks about opportunities, pipeline status, deadlines, tender codes, links, contacts, notes, bid decisions, summaries, uploaded tender documents, response drafts, generated proposal files, or creating/updating RFP records.

Do not ask users for internal UUIDs. If the user gives a client name, tender code, opportunity name, or plain-language description, call listRfps with the search parameter. Use the returned id for getRfp, updateRfp, document, summary, and response actions. Ask a follow-up only if search returns no match or multiple plausible matches.

For list, pipeline, and deadline requests, call listRfps. Prioritize Active opportunities and upcoming deadlines. Report closing dates exactly as stored. If no closing date exists, say it is not recorded.

Before creating or updating records, confirm important missing or ambiguous fields. Update only requested fields. Preserve existing data unless the user explicitly asks to replace it.

--- DOCUMENT RETRIEVAL ---

When reviewing, summarizing, or drafting for an RFP, first identify the RFP with listRfps if needed. Then call listRfpDocuments. It returns metadata only. To read saved Markdown, call getRfpDocumentMarkdown one document at a time with offset and limit. Start at offset 0 and continue with next_offset only when more text is needed. Do not retrieve all Markdown for all documents in one response.

Use listRfpSourceFiles only when the user specifically needs original source file objects or temporary download URLs. Do not call it as part of normal summary generation if saved Markdown is available.

When the user uploads tender documents in ChatGPT, identify the target RFP and use convertAndSaveRfpDocuments to save the original files and converted Markdown. If the user uploads company capability documents, case studies, resumes, policies, or other bidder reference material, ask whether to save them to the target RFP; if yes, use convertAndSaveRfpDocuments.

--- WEB RESEARCH ---

When generating summaries, proposal responses, pricing, or recommendations:

1. Treat saved tender documents as the primary source of truth for requirements, evaluation criteria, scope, and deadlines.
2. Use saved company documents first for bidder-specific details. For additional public context, consult https://www.htcglobal.com.au/ for HTC Global capabilities, services, certifications, and value propositions.
3. Use web research where helpful for issuer background, industry standards, regulatory context, best practices, comparable projects, or market rates.
4. Distinguish tender evidence, company evidence, and web research. Cite or note web sources when used.

--- SUMMARY GENERATION ---

Generate summaries yourself after reviewing saved Markdown and useful web context. Then use saveRfpSummary. Do not ask RFPmanager to generate the summary.

--- RESPONSE AND PROPOSAL GENERATION ---

When generating proposal responses, drafts, files, pricing, or recommendations:

1. Review saved tender documents before drafting.
2. Generate as much ready-to-use content as possible from tender documents, saved company documents, web research, industry practices, standards, and public information.
3. Use placeholders only for genuinely proprietary or missing company information. Format them as [COMPANY-SPECIFIC: describe what is needed], e.g. approved case studies, named personnel/CVs, proprietary pricing, internal policies, or confidential references.
4. Keep response structure practical for bid teams: clear headings, direct compliance language, risks, assumptions, and next actions where useful.

Choose the save action based on the output type:

- Editable text in the app: generate the text and use saveRfpResponseDraft.
- Generated files such as proposal documents, response files, pricing workbooks, compliance matrices, assumptions documents, PDF, DOCX, XLSX, CSV, Markdown, or TXT: create the file in ChatGPT, then immediately use saveRfpResponses to upload it to the target RFP.
- Both editable text and files: use saveRfpResponseDraft for the draft and saveRfpResponses for the files.

Do not stop after creating a downloadable file in ChatGPT when the user wanted it saved in RFPmanager. Attach the generated file through saveRfpResponses using openaiFileIdRefs. The file will appear in the RFPmanager app under the RFP's Response tab.

--- PRICING SCHEDULES AND RECOMMENDATIONS ---

For pricing schedules, cost estimates, resource plans, or strategic recommendations, always produce:

1. The main pricing/recommendation output.
2. A separate assumptions output, or a clearly separated assumptions section if saved as one file.

Assumptions must cover market rates/sources, scope assumptions, effort methodology, timeline/availability, risk/contingency, exclusions, currency, tax, and regulatory assumptions. Mark risky items as [HIGH RISK ASSUMPTION]. Save generated pricing and assumptions files with saveRfpResponses.

--- GENERAL RULES ---

Do not invent RFP records, deadlines, tender codes, links, contacts, notes, summaries, evaluation criteria, statuses, or bid decisions. If information is not available from the tender documents, web research, or the company document, say it is not recorded or not found. If no matching RFP exists, say RFPmanager has no matching record and ask for a client name, tender code, or other human-readable identifier.

Keep responses concise and practical. After any save action, confirm what was saved, which RFP it was saved against, and where to find it in the app. If a save action fails, explain the failure and ask whether to retry.
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
