# RFPmanager MCP Server — Implementation Plan

**Audience:** Claude Opus (or another coding agent), building this from scratch.
**Goal:** Wrap the existing `rfpmanager.vercel.app` REST API as an MCP server so an HTC Global employee can run the full RFP workflow — find tender, read source docs, draft a response using HTC's capability knowledge, save the draft back — inside Claude, without the founder's involvement.

---

## 0. Context you need before writing code

### 0.1 What already exists (do not rebuild)

- **App:** `rfpmanager.vercel.app` — Next.js 16 + Supabase, deployed on Vercel.
- **Repo:** `github.com/abhij1306/RFPmanager` (public).
- **Existing integration:** a ChatGPT custom GPT Action already calls this same backend via `docs/chatgpt-actions-openapi.yaml`. That file is the ground truth for every endpoint, request/response shape, and validation rule below. **Do not guess the API shape — the full contract is reproduced in Section 1.**
- **Auth today:** single shared bearer token (`chatgptActionsApiKey` in the OpenAPI spec), checked server-side in `lib/chatgpt-auth.ts`. Sent as `Authorization: Bearer <token>`.
- **The backend has no drafting intelligence.** Every write endpoint (`saveRfpSummary`, `saveRfpResponseDraft`, `saveRfpResponses`) explicitly stores text the *calling model* already generated — it does not call an LLM itself server-side. `saveRfpSummary`'s own description states "does not call Groq." This means the MCP server is a pure data-access layer; all drafting logic must live in the Claude Project/system-prompt layer that calls these tools, not in the server.

### 0.2 What you're building

A new, separate package — `rfp-manager-mcp` — that:
1. Exposes the 9 existing `/api/chatgpt/rfps/*` operations as MCP tools, near-verbatim.
2. Adds **one new capability the ChatGPT integration didn't need**: a direct file-upload path, because Claude has no equivalent to ChatGPT's `openaiFileIdRefs` (temporary file references from the chat's own file store). See Section 3.
3. Ships as a Streamable HTTP MCP server so it can be deployed once (e.g. as a Vercel serverless function alongside the existing app, or a small standalone Node service) and connected from any employee's Claude Desktop / Claude Cowork without local install.

Do **not** modify `rfpmanager.vercel.app`'s existing `/api/chatgpt/*` routes. This is additive.

---

## 1. Full API contract to wrap

Source: `docs/chatgpt-actions-openapi.yaml` in the repo (OpenAPI 3.1.0). Base URL: `https://rfpmanager.vercel.app`. Auth: `Authorization: Bearer <RFPMANAGER_API_KEY>` on every request.

### 1.1 `listRfps`
`GET /api/chatgpt/rfps`
Query params: `search` (string, optional — client name/tender code/keyword), `limit` (1–25, default 25), `offset` (default 0).
Returns: `{ rfps: Rfp[], total, offset, limit, has_more, next_offset }`.
**Use case:** "show all RFPs", "list pipeline", search by client/tender code. If the user names a client or tender code, call this with `search` before ever asking for a UUID.

### 1.2 `createRfp`
`POST /api/chatgpt/rfps`
Body: `RfpInput` — required `client_name`; optional `status` (`Yes`/`No`/`TBD`, default `TBD`), `closing_date` (ISO date), `closing_date_text`, `tender_code`, `tender_link`, `gdrive_link`, `description`, `contact_person`, `contact_phone`, `contact_email`, `notes`, `pipeline_stage` (`Prospects`/`Active`/`Submitted`/`Won`/`Lost`, default `Prospects`).
Returns: `{ rfp: Rfp }`.
**Consequential — confirm before calling.**

### 1.3 `getRfp`
`GET /api/chatgpt/rfps/{id}`
Path: `id` (UUID).
Returns: `{ rfp: Rfp }`.
**Only call with a UUID already known from a prior response.** If given a client name/tender code, call `listRfps` with search first.

### 1.4 `updateRfp`
`PATCH /api/chatgpt/rfps/{id}`
Path: `id` (UUID). Body: `RfpUpdate` (all fields from `RfpInput` optional, `client_name` optional here).
Returns: `{ rfp: Rfp }`.
**Consequential — confirm before calling.** Note `status` (bid decision Yes/No/TBD) and `pipeline_stage` (workflow stage) are independent fields — never conflate them.

### 1.5 `listRfpDocuments`
`GET /api/chatgpt/rfps/{id}/documents`
Path: `id`. Query: `limit` (1–20, default 10), `offset` (default 0).
Returns lightweight metadata only (title, source_type, markdown_length, **500-char preview**, no full content): `{ documents: RfpDocumentSummary[], total, offset, limit, has_more, next_offset }`.
**Use to discover what's saved before reading full content.**

### 1.6 `listRfpSourceFiles`
`GET /api/chatgpt/rfps/{id}/source-files`
Path: `id`.
Returns: `{ source_files: RfpFileWithDownload[] }` — original files with temporary download URLs.
**Only call when the raw original file (not the saved Markdown) is needed. Don't call before reading saved Markdown.**

### 1.7 `getRfpDocumentMarkdown`
`GET /api/chatgpt/rfps/{id}/documents/{documentId}`
Path: `id`, `documentId`. Query: `offset` (default 0), `limit` (1–90000, default 45000 — **hard server cap at 90,000 chars**).
Returns: `{ document: RfpDocumentExcerpt }` with `markdown`, `offset`, `limit`, `next_offset`, `has_more`.
**Paginated read.** Start at offset 0; if `has_more`, call again with `next_offset`. Keep `limit` modest unless a large extract is explicitly needed — this is the primary token-cost control point.

### 1.8 `convertAndSaveRfpDocuments`
`POST /api/chatgpt/rfps/{id}/documents/convert`
Path: `id`. Body: `OpenAiFileUploadRequest` — `openaiFileIdRefs: OpenAiFileRef[]` (1–10 items). Each ref needs id/name/download_link (aliases accepted: `file_id`/`fileId`, `filename`/`file_name`/`title`, `download_link`/`downloadLink`/`download_url`/`url`).
Returns: `{ saved: [{ document: RfpDocumentSummary, source_file: RfpFile }] }`.
**Consequential.** ⚠️ **This endpoint's contract assumes ChatGPT's file-reference mechanism — see Section 3 for how the MCP tool must adapt this.**

### 1.9 `saveRfpSummary`
`POST /api/chatgpt/rfps/{id}/summary`
Path: `id`. Body: `{ summary: string }` (required).
Returns: `{ rfp: Rfp, summary }`.
**Consequential.** Call only after the calling model has read the saved Markdown and produced a summary itself — the server does no summarization.

### 1.10 `listRfpResponses`
`GET /api/chatgpt/rfps/{id}/responses`
Path: `id`.
Returns: `{ responses: RfpFileWithDownload[] }` — check what response files already exist before generating new ones.

### 1.11 `saveRfpResponses`
`POST /api/chatgpt/rfps/{id}/responses`
Path: `id`. Body: `OpenAiFileUploadRequest` (same shape as 1.8).
Returns: `{ responses: RfpFile[] }`.
**Consequential.** For generated file outputs (DOCX/PDF/XLSX/CSV). Same file-reference mismatch as Section 3.

### 1.12 `saveRfpResponseDraft`
`POST /api/chatgpt/rfps/{id}/responses/text`
Path: `id`. Body: `{ title: string, content: string }` (both required).
Returns: `{ rfp: Rfp, response_draft: RfpResponseDraft }`.
**Consequential.** For plain editable draft text (not a generated file). This is the main "save my drafted response" tool.

### Shared schemas (abbreviated — full definitions in the OpenAPI file)
- **`Rfp`**: id, client_name, status, closing_date, tender_code, tender_link, gdrive_link, description, contact_person/phone/email, document_links[], summary_generated_at, summary, response_draft_title/content/saved_at, notes, pipeline_stage, created_at.
- **Error shape**: `{ error: string }` on 400/401/404/500.

---

## 2. MCP tool design

Map each operation above to an MCP tool 1:1, using the OpenAPI `description` fields as the tool description almost verbatim — they're already written as model-facing usage instructions (e.g. "If the user gives a client name... call listRfps with search first. Do not ask for UUIDs unless search is ambiguous or empty"). This is the single highest-leverage reuse in this project: don't rewrite these, port them.

| MCP tool | HTTP call | Write? |
|---|---|---|
| `list_rfps` | 1.1 | No |
| `create_rfp` | 1.2 | **Yes** |
| `get_rfp` | 1.3 | No |
| `update_rfp` | 1.4 | **Yes** |
| `list_rfp_documents` | 1.5 | No |
| `list_rfp_source_files` | 1.6 | No |
| `get_rfp_document_markdown` | 1.7 | No |
| `save_rfp_source_documents` | 1.8, adapted — see §3 | **Yes** |
| `save_rfp_summary` | 1.9 | **Yes** |
| `list_rfp_responses` | 1.10 | No |
| `save_rfp_response_files` | 1.11, adapted — see §3 | **Yes** |
| `save_rfp_response_draft` | 1.12 | **Yes** |

**Write-tool behavior:** rely on the MCP client's (Claude's) native tool-confirmation UX for the 6 write tools rather than building custom confirmation logic server-side. Do not add a `dry_run` parameter for v1 — unnecessary complexity given the client already gates consequential calls.

---

## 3. File-upload adapter (the one real engineering task, not a passthrough)

**Problem:** Endpoints 1.8 and 1.11 expect `openaiFileIdRefs` — a ChatGPT-specific mechanism where the *platform* (ChatGPT) resolves a file already in the conversation to a temporary signed download URL, and the backend fetches from that URL server-side. Claude/MCP has no equivalent "file already sitting in a chat's file store with a platform-issued temporary URL."

**Fix:** the MCP server must accept file **content** directly from the calling Claude session (base64 or a local file path the MCP server can read, depending on transport), then do one of:

- **Option A (preferred):** MCP server uploads the file bytes directly to Supabase Storage itself using a service-role key, then calls a small **new** internal endpoint on `rfpmanager.vercel.app` (not the existing `/api/chatgpt/*` routes) that only does the metadata-save step — i.e., split "receive file" from "save document record" and let the MCP server own the first half.
- **Option B:** MCP server fabricates a synthetic `OpenAiFileRef`-shaped object (`id`, `name`, `download_link`) pointing at a short-lived signed URL it generates after uploading the file to Supabase Storage directly, then calls the *existing* `/documents/convert` or `/responses` endpoint unmodified, since the backend only cares that `download_link` is fetchable, not that it came from OpenAI.

**Recommend Option B for v1** — zero changes to `rfpmanager.vercel.app`, ships faster, and the existing endpoint doesn't actually validate the URL's origin, only that it can `fetch()` it. Confirm this by checking `lib/chatgpt-files.ts` and `lib/chatgpt-documents.ts` in the repo before implementing (not yet reviewed as of this plan — flag as a build-time verification step, not an assumption to code against blindly).

Both `save_rfp_source_documents` and `save_rfp_response_files` MCP tools need this adapter. Everything else in Section 1 is a direct passthrough.

---

## 4. Auth & deployment

- **Auth (v1):** reuse the existing shared bearer token pattern. One `RFPMANAGER_API_KEY` env var on the MCP server, sent as `Authorization: Bearer` on every upstream call. Employee-side, the same token is entered once when connecting the MCP server in Claude's connector settings — do not put per-employee tokens in scope for v1; that's a v2 hardening step once usage is proven out, not a blocker to get this running.
- **Deployment:** Streamable HTTP transport (not stdio), so the employee doesn't need anything installed locally beyond Claude Desktop/Cowork. Deploy as either:
  - A new route group inside the existing Next.js app on Vercel (e.g. `/api/mcp/*`), reusing the existing Vercel project — simplest, no new infra.
  - A standalone small Node service if you want to keep the MCP surface fully decoupled from the main app's deploy cycle.
  - Recommend the former unless there's a specific reason to isolate deploys.
- **CORS/transport specifics:** follow the MCP TypeScript SDK's Streamable HTTP server example directly; don't hand-roll the transport layer.

---

## 5. Knowledge layer — separate from this server, do not wire through MCP

`htc-knowledge-base.md` (accompanying this plan) — HTC Global's company profile, full service catalogue, 8-phase implementation methodology, case studies, and insurance summary — is **static reference material**, not live tender data. It does **not** belong in the MCP server or Supabase.

It goes in the **Claude Project's knowledge files** (or equivalent Cowork workspace attachment) that the employee uses alongside this MCP connector. The MCP tools above give live per-tender data (requirements, deadlines, saved documents); the knowledge base gives HTC's static capability facts used to write the actual response prose. Keep these two layers separate — conflating them by stuffing the knowledge doc through a tool call on every request wastes tokens for no benefit, since it doesn't change per-tender.

---

## 6. Build order

1. Scaffold `rfp-manager-mcp` package (TypeScript, `@modelcontextprotocol/sdk`).
2. Implement the 6 read-only tools first (1.1, 1.3, 1.5, 1.6, 1.7, 1.10) — pure passthroughs, no adapter needed, fastest path to something testable end-to-end.
3. Implement `create_rfp`, `update_rfp`, `save_rfp_summary`, `save_rfp_response_draft` — also direct passthroughs, just with write-confirmation behavior from the MCP client.
4. Verify the actual behavior of `lib/chatgpt-files.ts` / `lib/chatgpt-documents.ts` (does the backend validate the download URL's origin, or just fetch whatever URL it's given?) before building the file-upload adapter — this determines whether Option A or B from Section 3 is viable.
5. Build the file-upload adapter and wire `save_rfp_source_documents` / `save_rfp_response_files`.
6. Deploy to Vercel alongside the existing app; smoke-test with a real tender end-to-end (list → read → draft → save) before handing to the employee.
7. Connect in Claude Desktop/Cowork, attach `htc-knowledge-base.md` as Project knowledge, and hand off using the accompanying operator guide.

---

## 7. Open verification items (do not assume — check against the live repo before coding)

- Confirm `lib/chatgpt-files.ts` and `lib/chatgpt-documents.ts` don't hard-validate that `download_link` originates from an `openai.com`/ChatGPT-issued domain — this determines Section 3's approach.
- Confirm Supabase Storage bucket permissions allow a service-role key to write directly (needed either way for the adapter).
- Confirm whether `docs/plan.md` / `docs/planv2.md` in the repo contain any additional undocumented endpoints or constraints not reflected in the OpenAPI spec — these weren't reviewed while building this plan (GitHub API rate-limiting prevented fetching them at plan time).
