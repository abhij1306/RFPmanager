function bookmarklet(script: string): string {
  return `javascript:${encodeURIComponent(script)}`;
}

const sharedHelpers = `
const clean=function(value){return (value||'').replace(/\\s+/g,' ').trim();};
const text=function(element){return clean(element&&element.innerText||element&&element.textContent||'');};
const htmlToText=function(html){const div=document.createElement('div');div.innerHTML=html||'';return text(div);};
const optional=function(fn){try{return fn()||'';}catch(error){return '';}};
const normalizeLabel=function(value){return clean(value).toLowerCase().replace(/[:*]+$/,'').replace(/\\s*&\\s*/g,' and ');};
const first=function(values){for(const value of values){if(value)return value;}return '';};
const unique=function(values){const seen={};return values.filter(function(value){const key=clean(value).toLowerCase();if(!key||seen[key])return false;seen[key]=true;return true;});};
const pick=function(selectors){for(const selector of selectors){const found=text(document.querySelector(selector));if(found)return found;}return '';};
const labelTerms=function(labels){return labels.map(normalizeLabel);};
const labeledCell=function(labels){const terms=labelTerms(labels);const nodes=Array.from(document.querySelectorAll('td,th,dt,label,[class*="label"],[class*="Label"],[data-testid*="label"],[data-testid*="Label"]'));for(const node of nodes){const labelText=clean(text(node));const label=normalizeLabel(labelText);if(terms.indexOf(label)===-1)continue;if(node.tagName&&node.tagName.toLowerCase()==='dt'&&node.nextElementSibling){const dd=text(node.nextElementSibling);if(dd)return dd;}if(node.tagName&&node.tagName.toLowerCase()==='label'){const target=node.getAttribute('for')&&document.getElementById(node.getAttribute('for'));const value=target&&(target.value||text(target));if(value)return clean(value);}const row=node.closest&&node.closest('tr');if(row){const cells=Array.from(row.children);const cell=node.closest('td,th')||node;const index=cells.indexOf(cell);if(index>-1&&cells[index+1]){const value=text(cells[index+1]);if(value&&terms.indexOf(normalizeLabel(value))===-1)return value;}}const parent=node.parentElement;if(parent){const parentText=text(parent);const value=parentText.indexOf(labelText)===0?clean(parentText.slice(labelText.length).replace(/^\\s*:?\\s*/,'')):'';if(value&&value!==parentText)return value;}}return '';};
const labeled=function(labels){const direct=labeledCell(labels);if(direct)return direct;const terms=labelTerms(labels);const nodes=Array.from(document.querySelectorAll('tr,li,p,dt,dd,div,span'));for(let i=0;i<nodes.length;i++){const current=text(nodes[i]);const lower=normalizeLabel(current);if(terms.indexOf(lower)>-1&&nodes[i+1]){const next=text(nodes[i+1]);if(next&&normalizeLabel(next)!==lower)return next;}for(const term of terms){if(lower.indexOf(term+':')===0||lower.indexOf(term+' ')===0){const value=clean(current.slice(term.length).replace(/^\\s*:?\\s*/,''));if(value)return value;}}}return '';};
const redactText=function(value){return clean(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/ig,'[email]').replace(/\\b(?:\\+?\\d[\\d\\s().-]{7,}\\d)\\b/g,'[phone]');};
const scrubUrl=function(value){try{const url=new URL(value,location.href);url.username='';url.password='';url.searchParams.forEach(function(_,key){url.searchParams.set(key,'[redacted]');});return url.toString();}catch(error){return clean(value).replace(/([?&][^=]+)=([^&]+)/g,'$1=[redacted]');}};
`;

export function buildBookmarklet(origin: string): string {
  const script = `(function(){
${sharedHelpers}
const codeLabels=['Number','Tender number','Reference','Reference number','Tender code','Tender ID','RFT ID','RFQ ID','RFx ID','ATM ID','ATM number','Opportunity ID','Event ID','Notice ID','Procurement ID','Contract notice ID','Quote number','Solicitation number'];
const closeLabels=['Closing date','Closing','Deadline','Close date','Close date and time','Close Date & Time','Closing Date/Time','Closing date/time','Responses close','Response closing date','Tender closing date','Closing time','Submission deadline','Lodgement deadline'];
const descriptionLabels=['Description','Tender Description','Opportunity description','ATM description','Scope','Summary','Overview'];
const contactPerson=function(){return labeledCell(['Person','Contact person','Enquiries person','Contact name','Buyer contact','Primary contact'])||labeled(['Contact person','Enquiries person','Contact name','Buyer contact','Primary contact']);};
const contactPhone=function(){return labeledCell(['Phone','Contact phone','Enquiries phone','Telephone','Mobile'])||labeled(['Contact phone','Enquiries phone','Telephone','Mobile']);};
const contactEmail=function(){return labeledCell(['Email','Contact email','Enquiries email','Contact email address'])||labeled(['Contact email','Enquiries email','Contact email address'])||((text(document.body).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i)||[])[0]||'');};
const tenderTitle=function(){const subtitle=Array.from(document.querySelectorAll('.subtitle .h2,th.h2')).map(text).filter(Boolean).find(function(value){return !/^(description|enquiries|responses|specification documents)$/i.test(value)&&value.indexOf('Help Icon')===-1;});if(subtitle)return subtitle.replace(/\\s*Issued by\\s*/i,' - Issued by ');return first([labeled(['Title','Tender title','Opportunity title','ATM title','Request title','Event title','Description title']),pick(['h1','[data-testid*="title" i]','[class*="tender-title" i]','[class*="opportunity-title" i]','[class*="title" i]']),document.title]);};
const tenderDescription=function(){const desc=document.querySelector('#desc');if(desc&&'value' in desc){const value=htmlToText(desc.value);if(value)return value;}const descriptionTable=document.querySelector('#description');if(descriptionTable){const value=text(descriptionTable.querySelector('textarea'))||text(descriptionTable);if(value)return value.replace(/^Description\\s*/i,'');}return labeled(descriptionLabels);};
const closingText=function(){const closes=Array.from(document.querySelectorAll('strong,span,td,th,p,div,dd')).map(text).find(function(value){return /^(closes|closing|close date|deadline|responses close)\\b/i.test(value);});return closes||labeled(closeLabels)||pick(['[class*="closing" i]','[class*="close-date" i]','[class*="deadline" i]']);};
const monthIndex=function(value){const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];if(/^\\d+$/.test(value)){const month=Number(value)-1;return month>=0&&month<12?month:-1;}return months.indexOf(value.slice(0,3).toLowerCase());};
const closingDate=function(value){const source=value||'';let match=source.match(/\\b(20\\d{2})-(\\d{1,2})-(\\d{1,2})\\b/);if(match)return match[1]+'-'+String(match[2]).padStart(2,'0')+'-'+String(match[3]).padStart(2,'0');match=source.match(/(?:closes|closing|close date(?: and time)?|deadline|responses close)?\\s*(?:[A-Za-z]{3,9},?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/.,]+([A-Za-z]{3,9}|\\d{1,2})[\\s\\-/.,]+(\\d{2,4})/i);if(!match)return '';const month=monthIndex(match[2]);if(month<0)return '';const year=match[3].length===2?'20'+match[3]:match[3];return year+'-'+String(month+1).padStart(2,'0')+'-'+String(match[1]).padStart(2,'0');};
const links=Array.from(document.querySelectorAll('a[href]')).map(function(anchor){return {name:clean(anchor.textContent||anchor.getAttribute('download')||anchor.href),url:anchor.href};}).filter(function(link){const haystack=(link.url+' '+link.name).toLowerCase();return !/^skip to /i.test(link.name)&&!/help\\.docx|javascript:void|mailto:|tel:|\\/login|\\/register|privacy|terms/i.test(haystack)&&/download|document|attachment|file|pdf|docx?|xlsx?|csv|zip|addend|brief|specification|request-spec-docs|downloadspecs|atm documents|tender documents|rft|rfq|rfx/.test(haystack);});
const closes=closingText();
const payload={
client_name:tenderTitle(),
tender_code:labeledCell(codeLabels)||labeled(codeLabels)||pick(['[class*="reference" i]','[class*="ref" i]','[class*="tender-code" i]','[class*="atm-id" i]']),
tender_link:location.href,
closing_date:closingDate(closes),
closing_date_text:closes,
description:tenderDescription()||text(document.querySelector('main')).slice(0,2000)||text(document.body).slice(0,2000),
contact_person:optional(contactPerson),
contact_phone:optional(contactPhone),
contact_email:optional(contactEmail),
document_links:links
};
window.open(${JSON.stringify(origin)}+'/rfp/new#import='+encodeURIComponent(JSON.stringify(payload)),'_blank');
})();`;

  return bookmarklet(script);
}

export function buildDebugBookmarklet(): string {
  const script = `(function(){
${sharedHelpers}
const limited=function(values,count){return values.filter(Boolean).slice(0,count);};
const pairs=[];
Array.from(document.querySelectorAll('dt')).forEach(function(node){if(node.nextElementSibling)pairs.push({label:redactText(text(node)),value:redactText(text(node.nextElementSibling))});});
Array.from(document.querySelectorAll('tr')).forEach(function(row){const cells=Array.from(row.children).map(text).filter(Boolean);if(cells.length>=2)pairs.push({label:redactText(cells[0]),value:redactText(cells.slice(1).join(' | '))});});
Array.from(document.querySelectorAll('label')).forEach(function(label){const target=label.getAttribute('for')&&document.getElementById(label.getAttribute('for'));const value=target&&(target.value||text(target));if(value)pairs.push({label:redactText(text(label)),value:redactText(value)});});
const tables=Array.from(document.querySelectorAll('tr')).map(function(row){return Array.from(row.children).map(function(cell){return redactText(text(cell));}).filter(Boolean);}).filter(function(row){return row.length>1;});
const links=Array.from(document.querySelectorAll('a[href]')).map(function(anchor){return {text:redactText(text(anchor)||anchor.getAttribute('download')||anchor.href).slice(0,160),href:scrubUrl(anchor.href)};}).filter(function(link){return link.text||link.href;});
const report={
source:'RFPmanager tender debug v1',
captured_at:new Date().toISOString(),
url:scrubUrl(location.href),
host:location.hostname,
title:redactText(document.title),
headings:limited(unique(Array.from(document.querySelectorAll('h1,h2,h3')).map(function(node){return redactText(text(node));})),40),
labelValues:limited(pairs,120),
tables:limited(tables,80),
links:limited(links,120)
};
const output=JSON.stringify(report,null,2);
const fallback=function(){window.prompt('Copy this tender debug report and send it to the RFPmanager developer:',output);};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(output).then(function(){window.alert('Tender debug report copied. Paste it into a .json file and send it to the RFPmanager developer.');}).catch(fallback);}else{fallback();}
})();`;

  return bookmarklet(script);
}
