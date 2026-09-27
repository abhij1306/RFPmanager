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
const scrubUrl=function(value){try{const url=new URL(value,location.href);return url.origin+'/'+'[path omitted]';}catch(error){return '[invalid URL]';}};
`;

export function buildBookmarklet(origin: string): string {
  const script = `(function(){
${sharedHelpers}
const codeLabels=['Number','Tender number','Reference','Reference number','Tender code','Tender ID','RFT ID','RFQ ID','RFx ID','ATM ID','ATM number','Opportunity ID','Event ID','Notice ID','Procurement ID','Contract notice ID','Quote number','Solicitation number'];
const closeLabels=['Closing date','Closing','Deadline','Close date','Close date and time','Close Date & Time','Closing Date/Time','Closing date/time','Responses close','Response closing date','Tender closing date','Closing time','Submission deadline','Lodgement deadline'];
const descriptionLabels=['Description','Tender Description','Opportunity description','ATM description','Scope','Summary','Overview'];
const contactPerson=function(){return labeledCell(['Person','Contact person','Enquiries person','Contact name','Buyer contact','Primary contact'])||labeled(['Contact person','Enquiries person','Contact name','Buyer contact','Primary contact']);};
const contactPhone=function(){return labeledCell(['Phone','Contact phone','Enquiries phone','Telephone','Mobile'])||labeled(['Contact phone','Enquiries phone','Telephone','Mobile']);};
const contactEmail=function(){return labeledCell(['Email','Contact email','Enquiries email','Contact email address'])||labeled(['Contact email','Enquiries email','Contact email address']);};
const tenderTitle=function(){const subtitle=Array.from(document.querySelectorAll('.subtitle .h2,th.h2')).map(text).filter(Boolean).find(function(value){return !/^(description|enquiries|responses|specification documents)$/i.test(value)&&value.indexOf('Help Icon')===-1;});if(subtitle)return subtitle.replace(/\\s*Issued by\\s*/i,' - Issued by ');return first([labeled(['Title','Tender title','Opportunity title','ATM title','Request title','Event title','Description title']),pick(['[data-testid*="tender-title" i]','[class*="tender-title" i]','[class*="opportunity-title" i]','h1'])]);};
const tenderDescription=function(){const desc=document.querySelector('#desc');if(desc&&'value' in desc){const value=htmlToText(desc.value);if(value)return value;}const descriptionTable=document.querySelector('#description');if(descriptionTable){const value=text(descriptionTable.querySelector('textarea'))||text(descriptionTable);if(value)return value.replace(/^Description\\s*/i,'');}return labeled(descriptionLabels);};
const closingDate=function(value){const source=value||'';const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];let match=source.match(/\\b(20\\d{2})-(\\d{1,2})-(\\d{1,2})\\b/);let year,month,day;if(match){year=Number(match[1]);month=Number(match[2]);day=Number(match[3]);}else{match=source.match(/\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s,./-]+([A-Za-z]{3,9})[\\s,./-]+(20\\d{2})\\b/i);if(match){day=Number(match[1]);month=months.indexOf(match[2].slice(0,3).toLowerCase())+1;year=Number(match[3]);}else{match=source.match(/\\b([A-Za-z]{3,9})[\\s,./-]+(\\d{1,2})(?:st|nd|rd|th)?[,]?[\\s,./-]+(20\\d{2})\\b/i);if(match){month=months.indexOf(match[1].slice(0,3).toLowerCase())+1;day=Number(match[2]);year=Number(match[3]);}else{match=source.match(/\\b(\\d{1,2})[/-](\\d{1,2})[/-](20\\d{2})\\b/);if(!match||Number(match[1])<=12)return '';day=Number(match[1]);month=Number(match[2]);year=Number(match[3]);}}}if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate())return '';return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');};
const closeCandidates=unique(closeLabels.map(function(label){return labeledCell([label]);}).concat(closeLabels.map(function(label){return labeled([label]);}),Array.from(document.querySelectorAll('strong,span,td,p,dd,[class*="closing" i],[class*="deadline" i]')).map(text).filter(function(value){return /^(closes|closing|close date|deadline|responses close)\\b/i.test(value)&&value.length<240;})).filter(Boolean));
const datedCandidates=closeCandidates.filter(function(value){return closingDate(value);});
const dates=unique(datedCandidates.map(closingDate));
const closes=closeCandidates.filter(function(value){return /20\\d{2}/.test(value);}).join(' | ')||(closeCandidates[0]||'');
const seenLinks={};
const links=Array.from(document.querySelectorAll('a[href]')).map(function(anchor){const raw=anchor.getAttribute('href')||'';let url;try{url=new URL(raw,location.href);}catch(error){return null;}if(!/^https?:$/.test(url.protocol))return null;const name=clean(anchor.textContent||anchor.getAttribute('download')||url.pathname.split('/').pop());const path=url.pathname.toLowerCase();const context=clean(anchor.closest('section,article,table')&&anchor.closest('section,article,table').textContent).slice(0,200).toLowerCase();const documentSection=/document|attachment|download|specification|addend|tender files/.test(context);const file=/\\.(pdf|docx?|xlsx?|csv|zip|txt|rtf|odt)(?:$|[?#])/i.test(url.pathname);const named=/\\b(download|document|attachment|addend|brief|specification|rft|rfq|rfx)\\b/i.test(name);if(!file&&!anchor.hasAttribute('download')&&!named&&!documentSection)return null;if(!documentSection&&!file&&/\\b(privacy|terms)\\b/i.test(name))return null;if(/\\/(login|register|my-profile)\\b/.test(path))return null;url.hash='';const key=url.toString();if(seenLinks[key])return null;seenLinks[key]=true;return {name:name||'Tender document',url:key};}).filter(Boolean);
const portalDownloads=Array.from(document.querySelectorAll('button,[role="button"],a[href^="javascript:"]')).map(text).filter(function(value){return /download|document|attachment/i.test(value);}).slice(0,20);
const title=tenderTitle();
const warnings=dates.length>1?['Conflicting closing dates found; check the original deadline.']:dates.length===0?['Closing date needs review.']:[];
if(/^(supplier portal|loading|search|sign in|login)\\b/i.test(title))warnings.push('The captured title looks like a portal heading. Verify the opportunity title.');
const payload={
version:2,
client_name:title,
tender_code:labeledCell(codeLabels)||labeled(codeLabels)||pick(['[class*="reference" i]','[class*="ref" i]','[class*="tender-code" i]','[class*="atm-id" i]']),
tender_link:location.href,
closing_date:dates.length===1?dates[0]:'',
closing_date_text:closes,
warnings:warnings,
description:tenderDescription()||text(document.querySelector('main')).slice(0,2000)||text(document.body).slice(0,2000),
contact_person:optional(contactPerson),
contact_phone:optional(contactPhone),
contact_email:optional(contactEmail),
document_links:links,
portal_downloads:portalDownloads
};
const destination=${JSON.stringify(origin)}+'/rfp/new#import='+encodeURIComponent(JSON.stringify(payload));
const opened=window.open(destination,'_blank');
if(opened){opened.opener=null;}else{window.prompt('If the review did not open, copy this link and paste it in a new tab:',destination);}
})();`;

  return bookmarklet(script);
}

export function buildDebugBookmarklet(): string {
  const script = `(function(){
${sharedHelpers}
const limited=function(values,count){return values.filter(Boolean).slice(0,count);};
const safeLabels=['number','tender number','reference','reference number','tender code','tender id','opportunity id','closing date','deadline','title','tender title','contact person','contact email','description'];
const pairs=[];
Array.from(document.querySelectorAll('dt,th,td,label')).forEach(function(node){const label=normalizeLabel(text(node));if(safeLabels.indexOf(label)>-1)pairs.push({label:label,value:'[value omitted]'});});
const tables=Array.from(document.querySelectorAll('tr')).map(function(row){return {columns:row.children.length};});
const links=Array.from(document.querySelectorAll('a[href]')).map(function(anchor){return {text:'[text omitted]',href:scrubUrl(anchor.href)};});
const report={
source:'RFPmanager tender debug v2',
captured_at:new Date().toISOString(),
url:scrubUrl(location.href),
host:location.hostname,
title:'[title omitted]',
headings:limited(Array.from(document.querySelectorAll('h1,h2,h3')).map(function(node){return node.tagName.toLowerCase();}),40),
labelValues:limited(pairs,120),
tables:limited(tables,80),
links:limited(links,120)
};
const output=JSON.stringify(report,null,2);
window.prompt('Preview this diagnostic report before sharing. It may still contain confidential tender information. Copy only if appropriate:',output);
})();`;

  return bookmarklet(script);
}
