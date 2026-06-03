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

## Runtime Dependencies

The current document converter runs in the browser. Team members do not need to install LibreOffice, Python, Pandoc, MarkItDown, Docling, or any other external conversion tool for the existing DOCX, PDF, XLSX, and CSV conversion flow. Running `npm install` is enough for the app dependencies.

The app still needs:

- A Supabase project for shared RFP, comment, and saved Markdown storage.
- `GROQ_API_KEY` only if summary generation should work.

PPTX conversion is not currently supported. If PPTX support is added through a server-side tool such as MarkItDown, Docling, or LibreOffice, document the required Python/system packages and deployment setup here before sharing that version with the team.

## Supabase Setup

Create a Supabase project and run [supabase/schema.sql](supabase/schema.sql) in the SQL editor. Re-run the same schema after pulling updates; it creates the RFP, saved Markdown document, and comment tables if they do not already exist.

The schema enables Row Level Security and allows anonymous team access for this private shared app. Anyone with the deployed URL and anon key can read and write RFPs, comments, and saved Markdown, so share the URL only with your team.

## ChatGPT Actions Integration

Use this when you want team members to use a shared Custom GPT, sign in to RFPmanager from ChatGPT, and let ChatGPT read or update RFPs through this app.

### What You Build Once

- One shared Custom GPT or ChatGPT app for the team.
- OAuth login for RFPmanager using Supabase Auth.
- ChatGPT-facing API routes:
  - `GET /api/chatgpt/rfps`
  - `POST /api/chatgpt/rfps`
  - `GET /api/chatgpt/rfps/{id}`
  - `PATCH /api/chatgpt/rfps/{id}`
- An OpenAPI Actions schema based on [docs/chatgpt-actions-openapi.yaml](docs/chatgpt-actions-openapi.yaml).

Team members do not create their own GPTs. They use the shared GPT and sign in to RFPmanager when ChatGPT prompts them.

### 1. Enable Supabase Auth

In the Supabase dashboard, enable at least one user sign-in method under **Authentication > Providers**. Recommended options:

- Email magic link for the fastest private team setup.
- Google or Microsoft if your team already uses company accounts.

Add your deployed app URL to the Supabase allowed redirect URLs.

### 2. Enable Supabase OAuth Server

In Supabase, go to **Authentication > OAuth Server** and enable OAuth 2.1 server capabilities.

Supabase exposes these endpoints:

```text
Authorization URL: https://<project-ref>.supabase.co/auth/v1/oauth/authorize
Token URL:         https://<project-ref>.supabase.co/auth/v1/oauth/token
OIDC discovery:   https://<project-ref>.supabase.co/auth/v1/.well-known/openid-configuration
```

If Supabase offers asymmetric JWT signing, use it for OAuth/OIDC. This is especially important when requesting the `openid` scope.

### 3. Register ChatGPT As An OAuth Client

In Supabase OAuth Server settings, create an OAuth client for ChatGPT.

Use the callback URL shown by the GPT Actions authentication screen. OpenAI commonly uses a callback shaped like:

```text
https://chatgpt.com/aip/<YOUR-GPT-ID>/oauth/callback
```

Save the generated client ID and client secret. You will paste those into the GPT Action authentication settings.

### 4. Configure The Shared GPT Action

In the GPT builder:

1. Create or edit the shared RFPmanager GPT.
2. Add an Action.
3. Import [docs/chatgpt-actions-openapi.yaml](docs/chatgpt-actions-openapi.yaml).
4. Replace `https://YOUR-VERCEL-DOMAIN.example.com` with your deployed app URL.
5. Replace `YOUR-SUPABASE-PROJECT` in the OAuth URLs with your Supabase project ref.
6. Set authentication to OAuth.
7. Use these OAuth values:
   - Client ID: the Supabase OAuth client ID.
   - Client secret: the Supabase OAuth client secret.
   - Authorization URL: `https://<project-ref>.supabase.co/auth/v1/oauth/authorize`
   - Token URL: `https://<project-ref>.supabase.co/auth/v1/oauth/token`
   - Scope: `openid rfp:read rfp:write`

### 5. Suggested GPT Instructions

Paste this into the GPT instructions and adjust names as needed:

```text
You are the RFPmanager assistant for our bid team.

Use the RFPmanager actions whenever the user asks about opportunities, pipeline status, deadlines, tender links, summaries, or updates to RFP records.

Before creating or updating records, confirm important fields with the user if they are missing or ambiguous. Keep updates concise and preserve existing data unless the user explicitly asks to replace it.

For list requests, prioritize active and upcoming RFPs. For deadline questions, mention closing dates exactly as stored. If an RFP is not found, ask for the client name, tender code, or another identifying detail.

Do not invent RFP records, deadlines, links, contacts, summaries, or bid decisions. If the actions return no data, say that RFPmanager has no matching record.
```

### 6. Current Security Note

The ChatGPT routes require a bearer token and pass that token to Supabase. However, the current database schema still allows broad anonymous team access because this app was originally designed as a private shared URL.

For production-grade per-user permissions, update [supabase/schema.sql](supabase/schema.sql) to:

- Add ownership or workspace membership columns, such as `workspace_id` and `created_by`.
- Change RLS policies from `to anon using (true)` to authenticated user/workspace checks.
- Apply the same restrictions to `rfps`, `rfp_documents`, and `rfp_comments`.

Until that is done, ChatGPT sign-in gives you a clean OAuth flow, but it does not isolate one team member's RFP records from another's.

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
