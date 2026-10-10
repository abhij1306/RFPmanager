# Product

<!-- impeccable:product-schema 1 -->

## Platform
web (desktop only; small screens are not a target)

## Users
A small bid team. A few people upload tender documents; everyone else reads them through AI agents connected over MCP.

## Product Purpose
Turn each tender's document pack into clean Markdown, stored against the RFP, so MCP-connected agents can read and reason over it without anyone re-uploading or re-converting files.

## Operating Context
1. Someone creates an RFP (by hand or pre-filled by the capture bookmarklet) and drops in the tender files.
2. Files are converted to Markdown in the browser and saved with their originals.
3. Teammates ask their agent about the tender. The agent reads converted Markdown by default and fetches raw originals only when explicitly asked.
4. Agents may save a summary or response draft back to the RFP; the app displays and lets people edit them.

## Capabilities and Constraints
- Supabase stores RFP records, original files (storage), converted Markdown, summaries and one response draft per RFP.
- MCP (`/api/mcp`) and the ChatGPT Actions API (`/api/chatgpt/*`) are the read path for the team; their tool names and JSON shapes must stay stable.
- Closing dates are date-only. The UI must not imply an exact cutoff time.
- Internal tool with no sensitive data; security is explicitly out of scope. Performance (UI and MCP) and UX are the only priorities.
- Pipeline stage, bid decision, won/lost and team notes exist in the database for compatibility but are not part of the UI.
- In-app LLM summary generation was removed; summaries come from MCP agents.

## Product Principles
- Upload is the core job: creating an RFP and getting its documents converted must take seconds and never lose files.
- Show what agents will see: converted text first, originals second.
- Fast over clever: every screen loads in one parallel database round trip and never ships Markdown bodies it isn't displaying.
