# Drafting RFP Responses in Claude — Operator Guide

This is the day-to-day guide for preparing an RFP response using Claude, once the MCP connector is set up. No coding knowledge required.

---

## One-time setup (do this once)

1. **Connect the RFPmanager MCP server.** In Claude, Cowork, or Claude Desktop, go to Customize → Connectors → Add custom connector. Enter the server URL provided to you, for example `https://YOUR-VERCEL-DOMAIN/api/mcp`, and add it. No token is required for the v1 connector.
2. **Open the "HTC RFP Response Drafting" Project.** This should already exist with:
   - The RFPmanager MCP connector attached
   - `htc-knowledge-base.md` (HTC's company profile, services, methodology, case studies) loaded as Project knowledge
   - Drafting instructions already configured
   
   If this Project doesn't exist yet, ask whoever set this up to create it before you start — don't attach the connector to a blank chat, since you'll lose the company knowledge context.
3. **Confirm access.** Ask Claude: *"List all RFPs."* You should get back a list of client names, tender codes, and closing dates. If the connector is unavailable, check that the deployed `/api/mcp` URL is correct and that the Vercel environment variables are configured.

---

## Standard workflow: drafting a response for one tender

### Step 1 — Find the tender

Tell Claude the client name or tender code. Example:
> *"Find the Waverley Council tender"*
> *"Show me RFPs closing this month"*

You don't need to know or provide any ID — Claude will search and confirm which record it found before doing anything else.

### Step 2 — Review what's already saved

Ask Claude to summarize what's on file for that tender:
> *"What source documents are saved for this RFP? Give me a quick summary of the requirements."*

Claude will list saved documents and can read their content. If the tender source documents (the actual RFP/tender pack) haven't been uploaded yet, do that first — see **Uploading tender documents** below.

### Step 3 — Draft the response

Ask Claude to draft the response, being specific about which sections you need:
> *"Draft a response to this tender. Cover our company overview, relevant services, implementation approach, and timeline. Use our standard capability statement for the company sections."*

Claude will pull from:
- The tender's actual requirements (via the MCP connector, from what's saved against that RFP)
- HTC's company knowledge (services, methodology, case studies) from the Project knowledge base

**Review before saving.** Read the draft. Check in particular:
- Does it reference the right case study (Smith Family for NFP-type engagements, Waverley Council for local government/council tenders) — or neither, if this tender doesn't match either profile?
- Are compliance details (ABN, certifications, insurance) included only where the tender actually asks for them?
- **Insurance currency:** the company insurance record on file expires 30 July 2026. If today's date is after that and Claude is still citing it, stop and flag this — the knowledge base needs the renewed certificate before it can be trusted again.

### Step 4 — Save the draft back

Once you're happy with it:
> *"Save this as the response draft for this RFP, titled '[Client Name] — Response Draft'."*

Claude will ask you to confirm before writing (this is expected — every save/update action requires your confirmation, by design). Confirm, and the draft is now stored against the tender record, visible in the RFPmanager app itself.

### Step 5 — Update the pipeline status (optional)

If you're moving the tender forward in the pipeline (e.g., from "Active" to "Submitted" once the response goes out):
> *"Update this RFP's pipeline stage to Submitted."*

---

## Uploading tender documents

If a new tender's source files (the RFP pack, addenda, specifications) haven't been added yet, upload them in RFPmanager's document upload/conversion flow and save them against the target RFP first. Then ask Claude to list and read the saved documents. The remote Claude connector cannot directly receive a local file path or a ChatGPT-style temporary file reference.

---

## Things to check before trusting a draft

- **Don't let Claude invent numbers, dates, or reference contacts.** If a tender asks for referee details or past engagement values, those should come only from what's in the knowledge base (Waverley Council / Smith Family references) — never estimated or paraphrased into a different figure.
- **Service selection should match the tender, not list everything.** A good draft picks 3–5 relevant service catalogue sections, not all twelve. If a draft looks like a copy-paste of the entire capability statement, ask Claude to tighten it to what the tender actually scoped.
- **Status vs. pipeline stage are different fields.** "Status" is the Yes/No/TBD bid decision. "Pipeline stage" is where it sits in the workflow (Prospects/Active/Submitted/Won/Lost). Don't conflate them when asking for updates.

---

## If something looks wrong

- **Claude can't find a tender you know exists** → check the exact client name/tender code spelling, or ask Claude to list all RFPs and scan manually.
- **A save/update didn't seem to go through** → check for a pending confirmation prompt you may have missed; nothing writes without your explicit confirm.
- **The draft cites information that isn't in the knowledge base** → stop, don't submit, and flag it. The Project is only supposed to draw on the attached knowledge file and the tender's own saved documents — anything else is the model filling a gap, not a fact.

---

## Escalate, don't guess, if:

- The tender requires a signed compliance/insurance certificate and the on-file insurance record is expired.
- A tender's requirements fall completely outside HTC's service catalogue (nothing in Section 2 of the knowledge base fits).
- You're unsure whether HTC should even be bidding — pipeline/status decisions are a business call, not something to infer from the draft alone.
