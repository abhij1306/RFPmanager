export function buildBookmarklet(origin: string): string {
  const script = `(function(){
const clean=function(value){return (value||'').replace(/\\s+/g,' ').trim();};
const text=function(element){return clean(element&&element.innerText||element&&element.textContent||'');};
const htmlToText=function(html){const div=document.createElement('div');div.innerHTML=html||'';return text(div);};
const pick=function(selectors){for(const selector of selectors){const found=text(document.querySelector(selector));if(found)return found;}return '';};
const labeledCell=function(labels){const terms=labels.map(function(label){return label.toLowerCase().replace(/:$/,'');});const labelsNodes=Array.from(document.querySelectorAll('.LIST_TITLE,td,th,dt,label'));for(const node of labelsNodes){const label=text(node).toLowerCase().replace(/:$/,'');if(terms.indexOf(label)===-1)continue;if(node.tagName&&node.tagName.toLowerCase()==='dt'&&node.nextElementSibling){const dd=text(node.nextElementSibling);if(dd)return dd;}const row=node.closest&&node.closest('tr');if(row){const cells=Array.from(row.children);const index=cells.indexOf(node.closest('td,th')||node);if(index>-1&&cells[index+1]){const value=text(cells[index+1]);if(value&&terms.indexOf(value.toLowerCase().replace(/:$/,''))===-1)return value;}}}return '';};
const labeled=function(labels){const direct=labeledCell(labels);if(direct)return direct;const terms=labels.map(function(label){return label.toLowerCase().replace(/:$/,'');});const nodes=Array.from(document.querySelectorAll('tr,li,p,dt,dd'));for(let i=0;i<nodes.length;i++){const current=text(nodes[i]);const lower=current.toLowerCase().replace(/:$/,'');if(terms.indexOf(lower)>-1&&nodes[i+1]){const next=text(nodes[i+1]);if(next&&next.toLowerCase()!==lower)return next;}for(const term of terms){if(lower.indexOf(term+':')===0){const value=clean(current.slice(term.length+1));if(value)return value;}}}return '';};
const tenderTitle=function(){const subtitle=Array.from(document.querySelectorAll('.subtitle .h2,th.h2')).map(text).filter(Boolean).find(function(value){return !/^(description|enquiries|responses|specification documents)$/i.test(value)&&value.indexOf('Help Icon')===-1;});if(subtitle)return subtitle.replace(/\\s*Issued by\\s*/i,' - Issued by ');return labeled(['Title','Tender title','Description title'])||pick(['h1','.title','.tender-title'])||document.title;};
const tenderDescription=function(){const desc=document.querySelector('#desc');if(desc&&'value' in desc){const value=htmlToText(desc.value);if(value)return value;}const descriptionTable=document.querySelector('#description');if(descriptionTable){const value=text(descriptionTable.querySelector('textarea'))||text(descriptionTable);if(value)return value.replace(/^Description\\s*/i,'');}return labeled(['Description','Tender Description']);};
const contactPerson=function(){return labeledCell(['Person','Contact person','Enquiries person'])||labeled(['Contact person','Enquiries person']);};
const contactPhone=function(){return labeledCell(['Phone','Contact phone','Enquiries phone'])||labeled(['Contact phone','Enquiries phone']);};
const contactEmail=function(){return labeledCell(['Email','Contact email','Enquiries email'])||labeled(['Contact email','Enquiries email']);};
const closingText=function(){const closes=Array.from(document.querySelectorAll('strong,span,td,p,div')).map(text).find(function(value){return /^closes\\b/i.test(value);});return closes||labeled(['Closing date','Closing','Deadline'])||pick(['[class*="closing"]','[class*="close-date"]','[class*="deadline"]']);};
const closingDate=function(value){const match=(value||'').match(/(?:closes\\s+)?(?:[A-Za-z]{3,9},?\\s+)?(\\d{1,2})\\s+([A-Za-z]{3,9})\\s+(\\d{4})/i);if(!match)return '';const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match[2].slice(0,3).toLowerCase());if(month<0)return '';return match[3]+'-'+String(month+1).padStart(2,'0')+'-'+String(match[1]).padStart(2,'0');};
const links=Array.from(document.querySelectorAll('a[href]')).map(function(anchor){return {name:clean(anchor.textContent||anchor.getAttribute('download')||anchor.href),url:anchor.href};}).filter(function(link){const haystack=(link.url+' '+link.name).toLowerCase();return !/^skip to /i.test(link.name)&&!/help\\.docx|javascript:void/i.test(haystack)&&/download|document|attachment|pdf|docx|xlsx|xls|csv|request-spec-docs|downloadspecs/.test(haystack);});
const closes=closingText();
const payload={
client_name:tenderTitle(),
tender_code:labeledCell(['Number','Tender number','Reference','Tender code'])||labeled(['Tender number','Reference','Tender code'])||pick(['[class*="reference"]','[class*="ref"]']),
tender_link:location.href,
closing_date:closingDate(closes),
closing_date_text:closes,
description:tenderDescription()||text(document.querySelector('main')).slice(0,2000)||text(document.body).slice(0,2000),
contact_person:contactPerson(),
contact_phone:contactPhone(),
contact_email:contactEmail(),
document_links:links
};
window.open('${origin}/rfp/new#import='+encodeURIComponent(JSON.stringify(payload)),'_blank');
})();`;

  return `javascript:${encodeURIComponent(script)}`;
}
