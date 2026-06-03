"use client";

function buildBookmarklet(origin: string): string {
  const script = `(function(){
const clean=function(value){return (value||'').replace(/\\s+/g,' ').trim();};
const text=function(element){return clean(element&&element.innerText||element&&element.textContent||'');};
const pick=function(selectors){for(const selector of selectors){const found=text(document.querySelector(selector));if(found)return found;}return '';};
const labeled=function(labels){const terms=labels.map(function(label){return label.toLowerCase();});const nodes=Array.from(document.querySelectorAll('tr,li,div,p,dt,dd'));for(let i=0;i<nodes.length;i++){const current=text(nodes[i]);const lower=current.toLowerCase().replace(/:$/,'');if(terms.indexOf(lower)>-1&&nodes[i+1]){const next=text(nodes[i+1]);if(next&&next.toLowerCase()!==lower)return next;}for(const term of terms){if(lower.indexOf(term+':')===0){const value=clean(current.slice(term.length+1));if(value)return value;}}}return '';};
const section=function(labels){const terms=labels.map(function(label){return label.toLowerCase();});const headings=Array.from(document.querySelectorAll('h1,h2,h3,h4,legend,.sectionHeader,.ui-accordion-header,td,th,div'));for(const heading of headings){const headingText=text(heading).toLowerCase().replace(/:$/,'');if(terms.indexOf(headingText)===-1)continue;let next=heading.nextElementSibling;while(next){const value=text(next);if(value&&terms.indexOf(value.toLowerCase().replace(/:$/,''))===-1)return value;next=next.nextElementSibling;}}return '';};
const title=labeled(['Title','Tender title','Description title'])||pick(['h1','.title','.tender-title'])||document.title;
const description=section(['Description','Tender Description'])||labeled(['Description','Tender Description']);
const links=Array.from(document.querySelectorAll('a[href]')).map(function(anchor){return {name:clean(anchor.textContent||anchor.getAttribute('download')||anchor.href),url:anchor.href};}).filter(function(link){const haystack=(link.url+' '+link.name).toLowerCase();return !/^skip to /i.test(link.name)&&/download|document|attachment|pdf|docx|xlsx|xls|csv|request-spec-docs/.test(haystack);});
const payload={
client_name:title,
tender_code:labeled(['Number','Tender number','Reference','Tender code'])||pick(['[class*="reference"]','[class*="ref"]','[class*="number"]']),
tender_link:location.href,
closing_date_text:labeled(['Closing date','Closing','Deadline'])||pick(['[class*="closing"]','[class*="close-date"]','[class*="deadline"]']),
description:description||text(document.querySelector('main')).slice(0,2000)||text(document.body).slice(0,2000),
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
