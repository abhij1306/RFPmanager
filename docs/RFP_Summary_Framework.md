# RFP Summary & Go/No-Go Framework

**Purpose:** Standing instruction for Claude when summarizing any RFP/tender pulled via the `rfpmanager` MCP. Upload this to Project Knowledge. Every RFP summary produced in this project must follow this structure — no exceptions, no freelancing on section order.

**Applies to:** `rfpmanager:get_rfp`, `rfpmanager:list_rfp_documents`, `rfpmanager:get_rfp_document_markdown` outputs, and any tender text pasted or uploaded manually.

---

## Non-negotiable rules

1. **Every summary ends with a Go/No-Go verdict.** Not "conditional," not "worth exploring" — one of: **GO / NO-GO / CONDITIONAL-GO (with named condition)**. Prose hedging without a stated verdict is a failed summary.
2. **Never mark a requirement "Compliant" without evidence.** If HTC/Cube27 capability for a claim isn't in company reference material, mark it `Partner Required` or `Unverified` — not `Compliant`. Treat unverified compliance claims in a submitted response as a legal/commercial risk, not a drafting shortcut.
3. **Source discipline.** State explicitly which documents were reviewed in full vs. skimmed vs. missing. If a referenced document (e.g. "Terms and Conditions," "Annexure C") isn't in the saved file set, flag it as a coverage gap — do not silently omit it.
4. **Don't bury the lead.** Closing date, contract value/term, and evaluation weighting go in the snapshot block at the top, not paragraph six.
5. **No filler enthusiasm.** No "exciting opportunity," no adjectives doing the work of analysis. State the fit or the gap plainly.

---

## Required structure (in this order)

### 1. Snapshot block (table, always first)
| Field | Value |
|---|---|
| Client / Issuer | |
| Tender code | |
| Opportunity type | RFP / RFT / RFQ / EOI / RFI |
| Closing date & time (with timezone) | |
| Contract term / value | |
| Submission channel | portal name, email, or platform |
| Contact | |
| Pipeline stage | |

### 2. Document coverage
- List every source document by filename.
- Mark each: **Reviewed in full** / **Skimmed** / **Referenced but missing**.
- State any coverage gap plainly (e.g. "Terms and Conditions referenced but not in saved file set — do not confirm acceptance until reviewed").

### 3. Opportunity overview (3–5 sentences max)
What the buyer wants, why now, and what "success" looks like for them — not a restatement of the full scope.

### 4. Scope of services
Bullet list, grouped by category if scope is large (e.g. Hosting / Security / Support / Migration). Mark **in-scope** vs **explicitly out-of-scope** where the tender states it.

### 5. Mandatory / pass-fail requirements
Table or list of anything that eliminates a bid outright if unmet (scheme membership, insurance minimums, security certifications, jurisdictional eligibility). This section exists to catch disqualifiers *before* time is spent on the rest.

### 6. Evaluation criteria (with weights)
Exact percentages as stated. If weights aren't disclosed, say so — don't estimate.

### 7. Compliance / capability matrix
Table format:
| Requirement | Status | Evidence / Gap |
|---|---|---|
| | Compliant / Partner Required / Partial / Unverified / Does Not Comply | |

Use the tender's own response codes if it supplies them (e.g. FC/CR/CI/PC/DP/DNC) — don't invent new ones.

### 8. Commercial terms
Pricing model, payment terms, insurance minimums, IP ownership, exit/transition-out obligations, penalty/service-credit clauses.

### 9. Key risks
Bullet list. Each risk should be a specific failure mode, not a vague category. ("PCE requires verified Wagtail/Silverstripe experience — HTC has none on record" is a risk. "Technical risk" is not.)

### 10. Fit assessment
2–3 sentences connecting the company's actual, evidenced capability (not aspirational capability) to the mandatory and highest-weighted criteria specifically. Name the single biggest capability gap if one exists.

### 11. Go/No-Go verdict
```
VERDICT: [GO / NO-GO / CONDITIONAL-GO]
CONDITION (if applicable): [single sentence — what must be true for this to become a GO]
CONFIDENCE: [High / Medium / Low — based on document completeness, not optimism]
```

Decision logic:
- **NO-GO** if a mandatory/pass-fail requirement cannot be met, or the closing date has already passed.
- **CONDITIONAL-GO** if the win hinges on securing an unverified partner/subcontractor/certification — state exactly which one.
- **GO** only if mandatory requirements are met with evidenced capability and the two highest-weighted evaluation criteria are credibly addressable in-house.

### 12. Immediate next actions
Numbered, ordered by urgency (clarification-question deadlines first, then evidence-gathering, then drafting).

---

## Formatting notes
- Markdown throughout. Tables for anything with 3+ comparable rows.
- No headers deeper than `###`.
- Keep prose sections tight — this is a working document for a bid decision, not a client-facing deliverable.
