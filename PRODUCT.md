# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Small bid and proposal teams who track tender opportunities, review source material, decide whether to bid, and prepare responses.

## Product Purpose
Keep opportunity records, source documents, assessments, response drafts, files, and team notes together so a team can move from capture to an external submission and recorded outcome.

## Operating Context
The team receives tender links and files, converts documents to Markdown for reading and AI-assisted review, records a bid decision separately from pipeline stage, writes a response, and submits it outside this app. Existing integrations include a shared GPT, Claude MCP, a browser import bookmarklet, and a quick summary service.

## Capabilities and Constraints
- Supabase stores shared RFP records, files, converted Markdown, comments, summaries, and one response draft per RFP.
- Pipeline stages are Prospects, Active, Submitted, Won, and Lost. Bid decisions are TBD, Yes, and No.
- Closing dates are date-only. The UI must not imply an exact cutoff time.
- Generated summaries and saved response drafts are distinct from the team's bid decision.
- Source availability and conversion do not prove review or compliance.
- Existing routes, saved records, integrations, and their data contracts must remain usable through the redesign.

## Evidence on Hand
The live application source, `README.md`, `docs/RFP_Summary_Framework.md`, and the fictional workflow prototype and design notes reviewed during the redesign. The prototype's organizations, evaluation weights, and commercial assumptions are sample data, not product claims.

## Brand Commitments
Use CrawlerAI Design System v4 as the visual reference: its Geist typography, indigo accent, neutral surface ladder, compact controls, and consistent semantic states. The warm green styling of the workflow prototype is not a visual reference.

## Product Principles
- Show the next useful action and the evidence behind the decision.
- Keep capture, assessment, decision, response, and outcome connected without enforced gates.
- Use precise labels for what is saved, readable, undecided, and externally submitted.
- Keep record editing and integration utilities available without letting them dominate the working surface.
