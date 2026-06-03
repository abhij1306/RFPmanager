"use client";

function buildBookmarklet(origin: string): string {
  const script = `(function(){
const pick=function(selectors){for(const selector of selectors){const element=document.querySelector(selector);const text=element&&element.textContent&&element.textContent.trim();if(text)return text;}return "";};
const links=Array.from(document.querySelectorAll('a[href]')).map(function(anchor){return {name:(anchor.textContent||anchor.getAttribute('download')||anchor.href).trim(),url:anchor.href};}).filter(function(link){return /download|pdf|docx|xlsx|xls|csv/i.test(link.url+" "+link.name);});
const payload={
client_name:pick(['[class*="agency"]','[class*="organisation"]','[class*="department"]','h1'])||document.title,
tender_code:pick(['[class*="reference"]','[class*="ref"]','[class*="number"]']),
tender_link:location.href,
closing_date_text:pick(['[class*="closing"]','[class*="close-date"]','[class*="deadline"]']),
description:pick(['[class*="description"]','[class*="detail"]','main'])||document.body.innerText.slice(0,2000),
document_links:links
};
fetch('${origin}/api/rfp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
.then(function(response){return response.json().then(function(data){if(!response.ok)throw new Error(data.error||'Save failed');return data;});})
.then(function(data){window.open('${origin}/rfp/'+data.id,'_blank');})
.catch(function(error){alert('RFP import failed: '+error.message);});
})();`;

  return `javascript:${encodeURIComponent(script)}`;
}

export function BookmarkletInstaller({ origin }: { origin: string }) {
  const bookmarklet = origin ? buildBookmarklet(origin) : "";

  async function copyBookmarklet() {
    await navigator.clipboard.writeText(bookmarklet);
  }

  return (
    <div className="bookmarklet-grid">
      <section className="panel bookmarklet-panel">
        <span className="drop-kicker">One-time setup</span>
        <h2>Install Extract Tender</h2>
        <p>
          Create a new browser bookmark, name it Extract Tender, and paste this JavaScript into the URL field.
        </p>
        <textarea className="markdown-preview bookmarklet-code" readOnly value={bookmarklet} />
        <div className="form-actions">
          <button className="button" disabled={!bookmarklet} onClick={() => void copyBookmarklet()} type="button">
            Copy Bookmarklet
          </button>
        </div>
      </section>

      <section className="panel bookmarklet-panel">
        <span className="drop-kicker">Workflow</span>
        <h2>Use on tender pages</h2>
        <ol className="steps-list">
          <li>Open the tender page normally in your browser.</li>
          <li>Click the Extract Tender bookmark.</li>
          <li>The app creates the RFP and opens its detail page.</li>
          <li>Download linked documents, convert them, then generate the summary.</li>
        </ol>
      </section>
    </div>
  );
}
