# RFP Manager — Updated Plan
**Includes tender auto-extraction via browser bookmarklet**

---

## The Problem With Auto-Fetching Tender URLs

`tenders.wa.gov.au` has two hard blockers:

| Blocker | Detail |
|---|---|
| `robots.txt` | Site explicitly disallows automated access |
| CSRF token in every URL | Session-bound — only valid in the browser that generated it |

A Vercel serverless function hitting that URL from a server gets blocked every time. No workaround on the server side.

**Solution: run the extraction inside the user's browser** — via a bookmarklet.

---

## How the Bookmarklet Works

A bookmarklet is a browser bookmark containing JavaScript. When clicked on any page, it runs in that page's context — meaning it has full DOM access and the user's active session. No CORS, no robots.txt issue, no CSRF problem.

**Flow:**
1. User opens a tender page normally in their browser
2. User clicks the "Extract Tender" bookmark in their bookmark bar
3. Bookmarklet reads the DOM → extracts all structured fields
4. Bookmarklet sends the data to your app (via a POST to your Vercel API)
5. App saves the RFP + redirects user to the new RFP detail page

**What the bookmarklet extracts from `tenders.wa.gov.au`:**
- Tender title / client (agency)
- Tender code / reference number
- Closing date
- Category / description
- All document download links (as URLs — not the files themselves, browser security prevents that)
- Current page URL

The bookmarklet is just a text string users paste into a new bookmark. One-time setup, works for the whole team.

---

## File Download + Conversion Flow

The bookmarklet can't auto-download files (browser security blocks programmatic downloads to a server). Two options:

### Option A: Semi-automated (recommended for v1)
1. Bookmarklet saves tender info + document link list to app
2. App shows the RFP detail page with a list of all document URLs
3. User clicks each link → file opens in their browser → they "Save as…" 
4. User drags saved files into the app's upload zone
5. App converts (mammoth/pdf.js) + summarizes (Groq/Mistral)

### Option B: Browser extension (v2 if needed)
A Chrome extension can intercept downloads and pipe file bytes to the app directly. Significantly more work. Overkill unless volume is high.

**Verdict: Option A for v1 — saves 80% of the manual work with 20% of the complexity.**

---

## LLM Summarization

Groq is the right call. Free tier, fast, good at structured extraction.

**What the summary generates per tender:**
```
- What they want (one paragraph)
- Key requirements (bullet list)  
- Evaluation criteria
- Mandatory submission items
- Deadlines
- Red flags / complexity signals
- Fit score rationale (for HTC Global's capabilities)
```

**Implementation:**
```javascript
// Vercel API route: /api/summarize
// Called after user uploads + converts documents

const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile",  // fast, free, large context
    messages: [
      {
        role: "system",
        content: "You are an expert RFP analyst. Extract structured information from tender documents and produce a concise summary for a bid team."
      },
      {
        role: "user", 
        content: `Analyse this tender document and return:\n\n${markdownContent}`
      }
    ],
    max_tokens: 1500
  })
});
```

Groq free tier: 14,400 requests/day, 500,000 tokens/min on llama-3.3-70b. More than enough.

---

## Revised App Structure

```
/                     → RFP Dashboard (table)
/rfp/[id]             → RFP detail: info + documents + summary
/rfp/new              → Manual add form (fallback)
/convert              → Standalone doc converter (upload → MD → clipboard)

/api/rfp              → POST save RFP from bookmarklet
/api/summarize        → POST markdown content → returns LLM summary
```

---

## Revised Data Model

```sql
create table rfps (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  status text default 'TBD',
  closing_date date,
  tender_code text,
  tender_link text,
  gdrive_link text,
  pipeline_stage text default 'Prospects',
  
  -- New fields
  description text,                    -- from bookmarklet
  document_links jsonb,                -- array of {name, url} from bookmarklet
  summary text,                        -- LLM-generated summary
  summary_generated_at timestamptz,
  
  notes text,
  created_at timestamptz default now()
);
```

---

## The Bookmarklet Code (draft)

```javascript
javascript:(function(){
  // Extract tender info from tenders.wa.gov.au
  const title = document.querySelector('.tender-title, h1')?.innerText?.trim();
  const code = document.querySelector('.tender-reference, [class*="reference"]')?.innerText?.trim();
  const closing = document.querySelector('[class*="closing"], [class*="close-date"]')?.innerText?.trim();
  const agency = document.querySelector('[class*="agency"], [class*="organisation"]')?.innerText?.trim();
  
  // Collect all document download links
  const docLinks = [...document.querySelectorAll('a[href*="download"], a[href*=".pdf"], a[href*=".docx"]')]
    .map(a => ({ name: a.innerText.trim(), url: a.href }));

  const payload = {
    client_name: agency || title,
    tender_code: code,
    tender_link: window.location.href,
    document_links: docLinks,
    description: document.querySelector('[class*="description"]')?.innerText?.trim()
  };

  fetch('https://your-app.vercel.app/api/rfp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(data => {
    window.open(`https://your-app.vercel.app/rfp/${data.id}`, '_blank');
  })
  .catch(() => alert('Save failed. Check app is running.'));
})();
```

The selectors need one calibration pass against the actual tenders.wa.gov.au DOM — 30 minutes of inspect-element work. Works for `vendorpanel.com.au` and other portals too (with portal-specific selector sets).

---

## Full Feature Summary

| Feature | How | Complexity |
|---|---|---|
| Manual RFP add/edit | Form → Supabase | Low |
| Auto-extract from tender page | Bookmarklet → `/api/rfp` | Low-Medium |
| Document link list | Bookmarklet collects `<a>` hrefs | Low |
| DOCX → Markdown | `mammoth.js` client-side | Low |
| PDF → Markdown | `pdf.js` + `turndown` client-side | Low-Medium |
| LLM summary | Groq API from Vercel function | Low |
| Dashboard + pipeline view | React table + Supabase | Low |

---

## Revised Effort

| Piece | Time |
|---|---|
| Supabase setup | 15 min |
| Dashboard + RFP table | 1.5 hrs |
| Add/Edit form | 1 hr |
| Bookmarklet (+ DOM calibration) | 1.5 hrs |
| Document upload + conversion | 1.5 hrs |
| Groq summarization API route | 1 hr |
| RFP detail page | 1 hr |
| Deploy + test end-to-end | 30 min |
| **Total** | **~8 hrs** |

---

## What You Tell the Team

> "Open any tender page normally. Click 'Extract Tender' in your bookmarks. The app saves it automatically and shows you all the document links. Download the docs, drag them into the app, and click 'Generate Summary'. Done."

---

*Updated plan v2 | June 2026*