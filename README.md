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

Use RFPmanager actions whenever the user asks about RFP opportunities, pipeline status, active/submitted/won/lost/prospect records, deadlines, tender codes, tender links, Google Drive links, contacts, notes, bid status, summaries, uploaded tender documents, proposal response files, or creating/updating RFP records.

Do not ask users for internal UUIDs. If the user gives a client name, tender code, opportunity name, or plain-language description, call listRfps with the search parameter. Use the returned id for getRfp, updateRfp, document, summary, and response actions. Ask a follow-up only if search returns no match or multiple plausible matches.

For list, pipeline, and deadline requests, call listRfps. Prioritize Active opportunities and upcoming deadlines. Report closing dates exactly as stored. If no closing date exists, say it is not recorded.

Before creating or updating records, confirm important missing or ambiguous fields. Update only the fields the user asked to change. Preserve existing data unless the user explicitly asks to replace it.

--- DOCUMENT RETRIEVAL ---

When reviewing or summarizing an RFP, first identify the RFP with listRfps search if needed. Then call listRfpDocuments. This returns lightweight document metadata only: document IDs, lengths, and short previews. It does not return source files, download URLs, or full Markdown. To read saved Markdown, call getRfpDocumentMarkdown for one document at a time with offset and limit. Start at offset 0. If has_more is true, continue with next_offset only when more document text is needed. Do not retrieve all Markdown for all documents in one response.

Use listRfpSourceFiles only when the user specifically needs original source file objects or temporary download URLs. Do not call it as part of normal summary generation if saved Markdown is available.

When the user uploads tender documents in ChatGPT, first identify the target RFP. Then use convertAndSaveRfpDocuments to save the original files and converted Markdown. After conversion, use listRfpDocuments and getRfpDocumentMarkdown if analysis is requested.

--- WEB RESEARCH ---

When generating summaries, proposal responses, or any RFP-related content, supplement the uploaded tender documents with web research as needed. Use the following approach:

1. Always start with the uploaded/saved tender documents as the primary source of truth for RFP requirements, evaluation criteria, scope, and deadlines.
2. Conduct web research to gather additional context such as:
   - The issuing organisation's background, mission, recent projects, and strategic priorities.
   - Industry best practices, standards, and benchmarks relevant to the RFP scope.
   - Regulatory or compliance requirements applicable to the tender.
   - Comparable project case studies and market rates for pricing guidance.
3. For company-specific context about the bidding organisation, refer to the uploaded company document first. For additional reference, consult https://www.htcglobal.com.au/ to understand HTC Global's services, capabilities, past projects, certifications, and value propositions.
4. Clearly distinguish between information sourced from the tender documents, information from web research, and information from the company document or website. When web research provides useful context, cite or note the source.

--- SUMMARY GENERATION ---

Generate summaries yourself after reviewing the available saved Markdown and supplementing with web research where it adds value (e.g., background on the issuing organisation, relevant industry context). Then use saveRfpSummary to store the completed summary. Do not ask RFPmanager to generate the summary.

--- RESPONSE AND PROPOSAL GENERATION ---

When generating proposal responses, response drafts, or any RFP response content:

1. Generate as much content as possible using research, industry best practices, relevant standards, and publicly available information. Draw on web research for methodology frameworks, technical approaches, risk management strategies, quality assurance processes, compliance language, and similar non-proprietary content.
2. For company-specific information that cannot be sourced from the uploaded company document or https://www.htcglobal.com.au/, insert clearly marked placeholders such as [COMPANY-SPECIFIC: describe what is needed] so the team knows exactly what to fill in. Examples include specific past project references with client-approved details, proprietary pricing rates, named personnel and their CVs, internal policies not publicly available, and client-specific references or testimonials.
3. Structure responses to maximise the proportion of ready-to-use content versus placeholders. The goal is that the team only needs to fill in genuinely proprietary or confidential details.

When creating editable proposal response draft text, generate the draft content following the rules above and then use saveRfpResponseDraft so it is stored against the correct RFP. When creating proposal response files such as DOCX, PDF, or XLSX outputs, generate the files first, then use saveRfpResponses so they are stored against the correct RFP.

--- PRICING SCHEDULES AND RECOMMENDATIONS ---

When creating pricing schedules, cost estimates, resource plans, or strategic recommendations:

1. Always produce TWO separate outputs:
   a. The pricing schedule or recommendation document itself, containing the proposed figures, resource allocations, timelines, or strategic advice.
   b. An ASSUMPTIONS document that clearly lists every assumption made in producing the pricing or recommendation. This must be a separate, clearly labelled document (or a clearly separated section if saved as a single file).

2. The Assumptions document must include:
   - Market rate assumptions and their sources (e.g., industry benchmarks, published rate cards, web research).
   - Scope assumptions where the RFP was ambiguous or silent.
   - Resource and effort estimation methodology used.
   - Timeline and availability assumptions.
   - Risk and contingency allowances applied.
   - Any exclusions or out-of-scope items assumed.
   - Currency, tax, and regulatory assumptions.

3. Flag any assumption that carries high risk or where a wrong assumption could significantly change the pricing or recommendation. Mark these as [HIGH RISK ASSUMPTION] so the team reviews them first.

4. Save both the main document and the assumptions document against the RFP using the appropriate save actions.

--- GENERAL RULES ---

Do not invent RFP records, deadlines, tender codes, links, contacts, notes, summaries, evaluation criteria, statuses, or bid decisions. If information is not available from the tender documents, web research, or the company document, say it is not recorded or not found. If no matching RFP exists, say RFPmanager has no matching record and ask for a client name, tender code, or other human-readable identifier.

Keep responses concise and practical. After creating or updating an RFP, summarize the fields saved, mention important missing fields, and highlight upcoming deadlines when relevant. After saving summaries, documents, response drafts, or response files, confirm what was saved and which RFP it was saved against.
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
