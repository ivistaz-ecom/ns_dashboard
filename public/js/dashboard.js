/* eslint-disable */
let RAW_BASE = [];

/**
 * Pulls company/pipeline rows from the backend API instead of the old
 * hardcoded RAW_BASE literal. Maps each API row (company_name, country_name,
 * mgmt_type_name, stage_name, month, week_label, status_detail, reply_status,
 * is_retarget, id) into the shape the rest of this file already expects
 * (company, country, mgmt_type, status, stage, month, date, reply_status,
 * is_retarget), so populate()/applyFilters()/renderTable() etc. don't need
 * to change.
 */
async function loadCompaniesFromApi() {
  if (typeof window === 'undefined' || !window.NsApi) {
    console.warn('[dashboard] window.NsApi not found — check that api-client.js loaded before dashboard.js');
    return [];
  }
  const perPage = 200;
  let page = 1;
  const rows = [];
  for (;;) {
    let res;
    try {
      res = await window.NsApi.listCompanies({ page, per_page: perPage, include_deleted: 0 });
    } catch (err) {
      console.error('[dashboard] failed to load companies from API:', err);
      break;
    }
    const items = (res && res.items) || [];
    items.forEach((r) => {
      rows.push({
        _id: r.id,
        code: r.company_code || '',
        company: r.company_name || '',
        country: r.country_name || '',
        mgmt_type: r.mgmt_type_name || '',
        status: r.status_detail || '',
        stage: r.stage_name || '',
        month: r.month || '',
        date: r.week_label || '',
        reply_status: r.reply_status || '',
        is_retarget: !!Number(r.is_retarget),
      });
    });
    if (items.length < perPage) break;
    page += 1;
  }
  return rows;
}
const STAGE_ORDER={'Prospected':0,'Email Outreach':1,'Retargeted':2,'Call':3,'Meeting / Positive':4,'Not Interested':5};
// Generated (not hardcoded) so it always covers "now" — previously this was
// a fixed literal capped at 'Jul 2026', so anything added after that month
// silently fell out of sort order and dropdown lists.
const MONTH_ORDER = (function () {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const start = new Date(2024, 0, 1);
  const now = new Date();
  const end = new Date(now.getFullYear() + 1, 11, 1); // through Dec of next year — always ahead of "now"
  const map = {};
  let i = 0;
  const d = new Date(start);
  while (d <= end) {
    map[names[d.getMonth()] + ' ' + d.getFullYear()] = i++;
    d.setMonth(d.getMonth() + 1);
  }
  return map;
})();
/** Month labels in chronological order, e.g. for populating <select> dropdowns. */
function getMonthOptions() {
  return Object.keys(MONTH_ORDER).sort((a, b) => MONTH_ORDER[a] - MONTH_ORDER[b]);
}

/** Cached country/stage/mgmt-type lookups pulled from the DB (not hardcoded lists). */
let NS_LOOKUPS = { countries: [], stages: [], mgmt_types: [] };
async function loadLookups() {
  if (!window.NsApi) return;
  try {
    NS_LOOKUPS = await window.NsApi.getLookups();
  } catch (err) {
    console.error('[dashboard] failed to load lookups:', err);
  }
}

/** Small toast notification (SweetAlert2 if loaded, console fallback otherwise). */
function nsToast(msg, icon) {
  icon = icon || 'success';
  if (typeof Swal === 'undefined') {
    console.log('[' + icon + ']', msg);
    return;
  }
  Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2200, timerProgressBar: true })
    .fire({ icon, title: msg });
}

let notes=JSON.parse(localStorage.getItem('ns_notes')||'{}');
/**
 * Notes, follow-ups, and call-log all attach to one specific `companies` row
 * (company_id), but a company can have several real rows (one per month).
 * We always anchor to the row with the LOWEST id (the earliest/original one)
 * so the same note/follow-up/call keeps showing up regardless of which row
 * currently "wins" the stage-priority display — that winner can change as
 * stages update, but this anchor never does.
 */
function resolveCompanyId(company){
  const nk=company.toLowerCase().trim();
  const rows=RAW_BASE.filter(r=>r.company.toLowerCase().trim()===nk&&r._id);
  if(!rows.length)return null;
  return rows.reduce((min,r)=>r._id<min?r._id:min,rows[0]._id);
}

let followUpIdByCompany={}; // company name key -> real follow_ups.id, for update/delete
let noteIdByCompanyIdx={};  // "company||idx" -> real notes.id, for delete

async function loadFollowUpsFromApi(){
  if(!window.NsApi)return;
  const perPage=200;let page=1;
  for(;;){
    let res;
    try{res=await window.NsApi.listFollowUps({page,per_page:perPage});}
    catch(err){console.error('[dashboard] failed to load follow-ups:',err);break;}
    const items=(res&&res.items)||[];
    items.forEach(fu=>{
      const row=RAW_BASE.find(r=>r._id===fu.company_id);
      if(!row)return;
      const nk=row.company.toLowerCase().trim();
      followUps[nk]=fu.due_date;
      followUpIdByCompany[nk]=fu.id;
    });
    if(items.length<perPage)break;
    page+=1;
  }
}

async function loadNotesFromApi(){
  if(!window.NsApi)return;
  const perPage=200;let page=1;
  const byCompany={};
  for(;;){
    let res;
    try{res=await window.NsApi.listNotes({page,per_page:perPage});}
    catch(err){console.error('[dashboard] failed to load notes:',err);break;}
    const items=(res&&res.items)||[];
    items.forEach(n=>{
      const row=RAW_BASE.find(r=>r._id===n.company_id);
      if(!row)return;
      const nk=row.company.toLowerCase().trim();
      if(!byCompany[nk])byCompany[nk]=[];
      byCompany[nk].push({id:n.id,text:n.note_text,ts:n.created_on});
    });
    if(items.length<perPage)break;
    page+=1;
  }
  Object.keys(byCompany).forEach(nk=>{
    notes[nk]=byCompany[nk].sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  });
}
let callActivityIdByCompany={}; // company key -> latest 'Call' activity's real id (undefined = not called)
async function loadCallActivitiesFromApi(){
  if(!window.NsApi)return;
  const perPage=200;let page=1;
  for(;;){
    let res;
    try{res=await window.NsApi.listActivities({page,per_page:perPage,activity_type:'Call'});}
    catch(err){console.error('[dashboard] failed to load call activities:',err);break;}
    const items=(res&&res.items)||[];
    items.forEach(a=>{
      const row=RAW_BASE.find(r=>r._id===a.company_id);
      if(!row)return;
      const nk=row.company.toLowerCase().trim();
      if(!callActivityIdByCompany[nk])callActivityIdByCompany[nk]=a.id; // first seen = latest, since API orders activity_date DESC
    });
    if(items.length<perPage)break;
    page+=1;
  }
}
let comms=JSON.parse(localStorage.getItem('ns_comms')||'[]');

async function loadContactsFromApi(){
  if(!window.NsApi)return;
  const perPage=200;let page=1;
  const byCompany={};
  for(;;){
    let res;
    try{res=await window.NsApi.listContacts({page,per_page:perPage});}
    catch(err){console.error('[dashboard] failed to load contacts:',err);break;}
    const items=(res&&res.items)||[];
    items.forEach(c=>{
      const row=RAW_BASE.find(r=>r._id===c.company_id);
      if(!row)return;
      const nk=row.company.toLowerCase().trim();
      if(!byCompany[nk])byCompany[nk]=[];
      byCompany[nk].push({id:c.id,name:c.name,title:c.title,email:c.email,phone:c.phone});
    });
    if(items.length<perPage)break;
    page+=1;
  }
  Object.keys(byCompany).forEach(nk=>{contacts[nk]=byCompany[nk]});
}
let stageOverrides=JSON.parse(localStorage.getItem('ns_stages')||'{}');
let customCompanies=JSON.parse(localStorage.getItem('ns_custom_cos')||'[]');
let potentialLeads=JSON.parse(localStorage.getItem('ns_leads')||'[]');
let followUps=JSON.parse(localStorage.getItem('ns_followups')||'{}');
let kpiActiveFilter='';
let contacts=JSON.parse(localStorage.getItem('ns_contacts')||'{}');
let fieldEdits=JSON.parse(localStorage.getItem('ns_field_edits')||'{}');
let callLog=JSON.parse(localStorage.getItem('ns_calls')||'{}');
let deletedCos=JSON.parse(localStorage.getItem('ns_deleted')||'{}');
let extraMonths=JSON.parse(localStorage.getItem('ns_extra_months')||'{}');
let uniqueMode=true;
let retargetedNKs=new Set();

// Migrate 2nd Round → Retargeted in overrides
Object.keys(stageOverrides).forEach(k=>{if(stageOverrides[k]==='2nd Round')stageOverrides[k]='Retargeted'});

function saveNotes(){localStorage.setItem('ns_notes',JSON.stringify(notes))}
function saveComms(){localStorage.setItem('ns_comms',JSON.stringify(comms))}
function saveSO(){localStorage.setItem('ns_stages',JSON.stringify(stageOverrides))}
function saveCustom(){localStorage.setItem('ns_custom_cos',JSON.stringify(customCompanies))}
function saveLeads(){localStorage.setItem('ns_leads',JSON.stringify(potentialLeads))}

function getAllCompanies(){
  // Include potential leads that are Ready to Contact or Passed (already promoted)
  const leadEntries=potentialLeads
    .filter(l=>l.status==='Ready to Contact'||l.status==='Passed')
    .map(l=>({
      company:l.name,
      country:l.country||'',
      mgmt:l.mgmt||'',
      stage:l.status==='Passed'?'Prospected':'Prospected',
      month:'Lead',
      status_detail:'',
      is_retarget:false,
      _from_lead:true,
      _lead_status:l.status,
      _lead_idx:potentialLeads.indexOf(l)
    }));
  // Deduplicate: if already in customCompanies, don't show from leads
  const customNames=new Set(customCompanies.map(c=>c.company.toLowerCase().trim()));
  const filteredLeads=leadEntries.filter(l=>!customNames.has(l.company.toLowerCase().trim()));
  return [...RAW_BASE,...customCompanies,...filteredLeads].filter(r=>!deletedCos[r.company.toLowerCase().trim()]);
}

let curTab='dashboard';
let filtered=[],sortCol='_id',sortDir=-1,page=1;
const PER_PAGE=50;
let weekOffset=0;
let activeStageKey='';

function stageKey(r){return r.company.toLowerCase().trim()+'__'+(r.month||'custom')}
function ck(r){return r.company.toLowerCase().trim()}
function getField(r,field){if(field==='country'||field==='mgmt_type')return r[field]||'';return (fieldEdits[ck(r)]&&fieldEdits[ck(r)][field]!==undefined)?fieldEdits[ck(r)][field]:(r[field]||'')}
function setField(company,field,value){
  const k=company.toLowerCase().trim();
  if(!fieldEdits[k])fieldEdits[k]={};
  fieldEdits[k][field]=value;
  const scrollEl=document.querySelector('#panel-dashboard .scroll');
  const scrollTop=scrollEl?scrollEl.scrollTop:0;
  const winY=window.scrollY;
  saveFieldEdits();
  // Lightweight filter option inject — avoids full populate() which can scroll page via focused selects
  if(field==='country'||field==='mgmt_type'){
    const selId=field==='country'?'fc':'fg';
    const sel=document.getElementById(selId);
    if(value&&![...sel.options].some(o=>o.value===value)){
      const o=document.createElement('option');o.value=value;o.textContent=value;sel.appendChild(o);
    }
  }
  applyFilters(true);
  // Double rAF ensures scroll restores after browser layout+paint settle
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(scrollEl)scrollEl.scrollTop=scrollTop;
    if(winY)window.scrollTo(0,winY);
  }));
}
function getStage(r){const s=r.stage;return s==='Prospected'?'Email Outreach':s;}

function activateTab(t){
  curTab=t==='pipeline'?'dashboard':t;
  const activeTab=t==='pipeline'?'pipeline':t;
  document.querySelectorAll('.nav-item[data-tab]').forEach(el=>{
    el.classList.toggle('active',el.dataset.tab===activeTab);
  });
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  const panelId=t==='pipeline'||t==='dashboard'?'panel-dashboard':'panel-'+t;
  const panel=document.getElementById(panelId);
  if(panel)panel.classList.add('active');
  const main=document.getElementById('main-content');
  if(main)main.classList.toggle('view-pipeline',t==='pipeline');
  if(t==='weekly')renderWeekly();
  if(t==='leads'){populateLeadFilters();renderLeads();}
  if(t==='contacts')renderContactsTab();
  if(t==='analytics')renderAnalytics&&renderAnalytics();
  if(t==='dashboard'||t==='pipeline'){
    if(typeof populate==='function')populate();
    if(typeof applyFilters==='function')applyFilters();
    if(typeof renderDashboardCharts==='function')renderDashboardCharts();
  }
}

function switchTab(t){
  const routes={dashboard:'/',pipeline:'/pipeline',weekly:'/weekly',leads:'/leads',analytics:'/analytics',contacts:'/contacts'};
  const target=routes[t];
  if(target&&window.location.pathname!==target){
    if(typeof window.__nsNavigate==='function'){window.__nsNavigate(t);return;}
    window.location.assign(target);return;
  }
  activateTab(t);
}

window.switchTab=switchTab;
window.__nsActivateTab=activateTab;
window.globalSearch=globalSearch;
window.exportData=exportData;

function globalSearch(q){
  const search=document.getElementById('search');
  if(search){search.value=q;applyFilters();}
}

function setGreeting(){
  const h=new Date().getHours();
  const greet=h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening';
  const el=document.getElementById('greeting');
  if(el)el.textContent=greet+', Jerry 👋';
}

function bc(s){return{'Prospected':'b-1','Email Outreach':'b-1','Retargeted':'b-r','Call':'b-c','Meeting / Positive':'b-m','Not Interested':'b-n'}[s]||'b-1'}

function populate(){
  const all=getAllCompanies();
  const months=[...new Set(all.map(r=>r.month).filter(Boolean))].sort((a,b)=>(MONTH_ORDER[a]??99)-(MONTH_ORDER[b]??99));
  const stages=['Email Outreach','Retargeted','Meeting / Positive','Not Interested'];
  const countries=[...new Set(all.map(r=>getField(r,'country')).filter(Boolean))].sort();
  const JUNK_MGMT=new Set(['n/a','na','apollo ai','fixed budget','apollo','other','unknown']);
  const mgmts=[...new Set(all.map(r=>getField(r,'mgmt_type')).filter(v=>v&&!JUNK_MGMT.has(v.toLowerCase().trim())))].sort();
  const fill=(id,arr,clear)=>{const s=document.getElementById(id);if(clear){while(s.options.length>1)s.remove(1)}arr.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;s.appendChild(o)})};
  fill('fm',months,true);fill('fs',stages,true);fill('fc',countries,true);fill('fg',mgmts,true);
  const dl=document.getElementById('co-list');
  dl.innerHTML='';
  [...new Set(all.map(r=>r.company))].sort().forEach(c=>{const o=document.createElement('option');o.value=c;dl.appendChild(o)});
  document.getElementById('hdate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  setGreeting();
}

function applyFilters(keepPage){
  const all=getAllCompanies();
  const q=document.getElementById('search').value.toLowerCase();
  const fm=document.getElementById('fm').value;
  const fs=document.getElementById('fs').value;
  const fc=document.getElementById('fc').value;
  const fg=document.getElementById('fg').value;
  const today=new Date();today.setHours(0,0,0,0);
  // Pre-compute retargeted set: 2+ unique months OR stage is Retargeted OR is_retarget flag from data
  const monthsByNk={};
  all.forEach(r=>{
    const nk=r.company.toLowerCase().trim();
    if(!monthsByNk[nk])monthsByNk[nk]={months:new Set(),ret:false};
    if(r.month)monthsByNk[nk].months.add(r.month);
    if(r.is_retarget||r.stage==='Retargeted')monthsByNk[nk].ret=true;
  });
  retargetedNKs=new Set();
  Object.keys(monthsByNk).forEach(nk=>{
    const extra=extraMonths[nk]||[];
    const total=new Set([...monthsByNk[nk].months,...extra]);
    if(total.size>=2||monthsByNk[nk].ret)retargetedNKs.add(nk);
  });
  filtered=all.filter(r=>{
    const es=getStage(r);
    const nk=r.company.toLowerCase().trim();
    if(q&&!r.company.toLowerCase().includes(q)&&!getField(r,'country').toLowerCase().includes(q)&&!(r._contact_name||'').toLowerCase().includes(q))return false;
    // Retargeted KPI overrides month/stage/country/mgmt filters — show all retargeted companies
    if(kpiActiveFilter==='Retargeted')return retargetedNKs.has(nk);
    if(fm&&r.month!==fm)return false;
    if(fs&&es!==fs)return false;
    if(fc&&getField(r,'country')!==fc)return false;
    if(fg&&getField(r,'mgmt_type')!==fg)return false;
    // other KPI filters
    if(kpiActiveFilter==='Call')return isCall(nk);
    if(kpiActiveFilter==='Meeting / Positive')return es==='Meeting / Positive';
    if(kpiActiveFilter==='Not Interested')return es==='Not Interested';
    if(kpiActiveFilter==='__overdue__'){
      const fu=r._follow_up||followUps[nk]||'';
      if(!fu)return false;
      const d=new Date(fu);d.setHours(0,0,0,0);return d<today;
    }
    return true;
  });
  // Unique mode: one row per company, highest stage, all months noted
  if(uniqueMode){
    const seen={};
    const STAGE_PRIORITY={'Meeting / Positive':6,'Call':5,'Retargeted':4,'Not Interested':3,'Email Outreach':2,'Prospected':1};
    filtered.forEach(r=>{
      const ck=r.company.toLowerCase().trim();
      if(!seen[ck]){seen[ck]={...r,_all_months:[r.month].filter(Boolean),is_retarget:!!r.is_retarget};}
      else{
        seen[ck]._all_months.push(r.month);
        if(r.is_retarget)seen[ck].is_retarget=true; // carry retarget flag from any record
        const cur=STAGE_PRIORITY[getStage(seen[ck])]||0;
        const nw=STAGE_PRIORITY[getStage(r)]||0;
        if(nw>cur){const months=seen[ck]._all_months;const wasRet=seen[ck].is_retarget;seen[ck]={...r,_all_months:months,is_retarget:wasRet||!!r.is_retarget};}
      }
    });
    // Use ALL months from full dataset (not just filtered records) + extraMonths
    // This ensures months always show correctly regardless of active filters
    filtered=Object.values(seen).map(r=>{
      const nk=r.company.toLowerCase().trim();
      const extra=extraMonths[nk]||[];
      const rawAll=[...(monthsByNk[nk]?.months||new Set())];
      const allM=[...new Set([...rawAll,...extra])].filter(Boolean);
      return{...r,_all_months:allM};
    });
  }
  applySort();if(!keepPage)page=1;renderTable();updateKPIs();renderDashboardCharts();
}

function applySort(){
  filtered.sort((a,b)=>{
    if(sortCol==='_id'){return((a._id||0)-(b._id||0))*sortDir}
    let av=sortCol==='stage'?getStage(a):a[sortCol]||'';
    let bv=sortCol==='stage'?getStage(b):b[sortCol]||'';
    if(sortCol==='month'){av=MONTH_ORDER[av]??99;bv=MONTH_ORDER[bv]??99;return(av-bv)*sortDir}
    if(sortCol==='stage'){av=STAGE_ORDER[av]??99;bv=STAGE_ORDER[bv]??99;return(av-bv)*sortDir}
    return av.toString().localeCompare(bv.toString())*sortDir;
  });
}

function sortBy(col){
  if(sortCol===col)sortDir*=-1;else{sortCol=col;sortDir=1}
  document.querySelectorAll('#panel-dashboard thead th').forEach(th=>{
    const isActive=th.getAttribute('onclick')===`sortBy('${col}')`;
    th.classList.toggle('sorted',isActive);
    const icon=th.querySelector('.sort-icon');
    if(icon)icon.textContent=isActive?(sortDir===1?'↑':'↓'):'↕';
  });
  applySort();renderTable();
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

function positionPopover(pop,rect,opts={}){
  const pad=opts.pad||12;
  pop.style.display='block';
  pop.style.visibility='hidden';
  pop.style.top='0';
  pop.style.left='0';
  const w=pop.offsetWidth;
  const h=pop.offsetHeight;
  pop.style.visibility='visible';

  let top=rect.bottom+4;
  let left=rect.left;
  const roomBelow=window.innerHeight-pad-top;
  const roomAbove=rect.top-pad-4;

  if(h>roomBelow&&roomAbove>roomBelow)top=rect.top-h-4;
  if(top+h>window.innerHeight-pad)top=Math.max(pad,window.innerHeight-pad-h);
  if(top<pad)top=pad;
  if(left+w>window.innerWidth-pad)left=window.innerWidth-pad-w;
  if(left<pad)left=pad;

  pop.style.top=top+'px';
  pop.style.left=left+'px';
}

function renderTable(){
  const start=(page-1)*PER_PAGE,slice=filtered.slice(start,start+PER_PAGE);
  const tbody=document.getElementById('tbody');
  if(!filtered.length){tbody.innerHTML='';document.getElementById('nores').style.display='block';return}
  document.getElementById('nores').style.display='none';
  tbody.innerHTML=slice.map(r=>{
    const nk=r.company.toLowerCase().trim();
    const eco=esc(r.company),ect=esc(r.country||'');
    const _noteArr=Array.isArray(notes[nk])?notes[nk]:(notes[nk]?[{text:notes[nk],ts:null}]:[]);
    const note=_noteArr.length?_noteArr[_noteArr.length-1].text:'';
    const mc=r.mgmt_type==='Inhouse'?'color:#2563eb':r.mgmt_type==='Outsourced'?'color:#d97706':'color:#64748b';
    const _noteCount=Array.isArray(notes[nk])?notes[nk].length:0;
    const _moreTag=_noteCount>1?'<span style="color:#64748b;font-size:.58rem;margin-left:4px">(+'+(_noteCount-1)+' more)</span>':'';
    const np=note?'<div class="nprev clickable-note" data-co="'+eco+'" data-ct="'+ect+'" onclick="openNote(this.dataset.co,this.dataset.ct)" title="Click to see all notes">'+esc(note)+_moreTag+'</div>':'';
    const es=getStage(r);
    const isEdited=false; // stage now comes straight from the DB, so there's no local "edited" divergence to flag
    const isCustom=!!r._custom;
    const isReadyLead=r._from_lead&&r._lead_status==='Ready to Contact';
    const addedTag=isCustom?'<span class="custom-tag">Added</span>':r._from_lead?'<span class="custom-tag" style="background:#eff6ff;color:#1d4ed8;border-color:#93c5fd">🎯 Lead</span>':'';
    // Contact info
    const contactInfo=r._contact_name?`<div style="font-size:.62rem;color:#2563eb;margin-top:2px">👤 ${esc(r._contact_name)}${r._contact_email?'<br><span style=\"color:#64748b\">'+esc(r._contact_email)+'</span>':''}${r._contact_phone?'<br><span style=\"color:#64748b\">'+esc(r._contact_phone)+'</span>':''}</div>`:'<span style="color:#94a3b8;font-size:.65rem">—</span>';
    // Follow-up
    const fu=r._follow_up||followUps[nk]||'';
    let fuCell='<span style="color:#94a3b8;font-size:.65rem">—</span>';
    if(fu){
      const fuDate=new Date(fu),today=new Date();today.setHours(0,0,0,0);fuDate.setHours(0,0,0,0);
      const diff=Math.round((fuDate-today)/(1000*60*60*24));
      const fuLabel=fuDate.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
      const fuStyle=diff<0?'color:#dc2626;font-weight:600':diff===0?'color:#d97706;font-weight:600':'color:#16a34a';
      const fuIcon=diff<0?'🔴 ':diff===0?'🟡 ':'';
      fuCell='<span style="font-size:.66rem;'+fuStyle+'">'+fuIcon+fuLabel+'</span><button data-co="'+eco+'" onclick="setFollowUp(this.dataset.co,event)" style="display:block;margin-top:2px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.6rem;padding:0" title="Edit follow-up">Edit</button>';
    } else {
      fuCell='<button data-co="'+eco+'" onclick="setFollowUp(this.dataset.co,event)" style="background:none;border:1px dashed #cbd5e1;color:#64748b;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:.6rem">＋ Set</button>';
    }
    // Last contacted

    // Month display
    const baseMonths=r._all_months?r._all_months.filter((m,i,a)=>m&&a.indexOf(m)===i):[];
    const allMonths=[...new Set([...baseMonths,...(extraMonths[nk]||[])])].filter(Boolean);
    const curMonth=getField(r,'month')||r.month||'';
    const otherMonths=allMonths.filter(m=>m&&m!==curMonth);
    const monthDisplay=`<span class="mtag editable" onclick="openMonthPicker(event,'${eco}')" title="Click to edit months">${esc(curMonth||'—')}</span>`+(otherMonths.length?`<span style="font-size:.55rem;color:#64748b;display:block;margin-top:2px">${otherMonths.map(m=>`+${esc(m)}`).join(', ')}</span>`:'');

    return `<tr${es==='Not Interested'?' style="opacity:.55"':''}>
      <td><span class="cn">${esc(r.company)}</span>${r.code?`<span style="display:block;font-size:.6rem;color:#94a3b8;font-family:monospace">${esc(r.code)}</span>`:''}${addedTag}<span class="ni${note?' has':''}" onclick="openNote('${eco}','${ect}')">${note?'🗒️':'＋'}</span><span data-co="${eco}" onclick="openContacts(this.dataset.co)" style="cursor:pointer;margin-left:4px;font-size:.65rem;color:${(contacts[nk]&&contacts[nk].length)?'#2563eb':'#94a3b8'}" title="Contacts">${(contacts[nk]&&contacts[nk].length)?'👤'+contacts[nk].length:'👤'}</span></td>
      <td><span class="editable-cell" onclick="openFieldEdit(event,${r._id||'null'},'${eco}','country','${esc(getField(r,'country'))}')">${esc(getField(r,'country')||'—')}</span></td>
      <td><span class="editable-cell" onclick="openFieldEdit(event,${r._id||'null'},'${eco}','mgmt_type','${esc(getField(r,'mgmt_type'))}')">${esc(getField(r,'mgmt_type')||'—')}</span></td>
      <td>${monthDisplay}</td>
      <td><span class="badge ${bc(es)} editable${isEdited?' edited':''}" onclick="openStageDrop(event,'${eco}','${esc(r.month||'custom')}',${r._id||'null'})">${esc(es)}</span></td>
      <td><span data-co="${eco}" onclick="toggleCall(this.dataset.co)" class="${isCall(nk)?'call-yes':'call-no'}">${isCall(nk)?'📞 Yes':'—'}</span></td>
      <td>${fuCell}</td>
      <td>${np}${note?'':`<button class="add-note-btn" onclick="addNote('${eco}')">＋ Note</button>`}</td>
      <td><button class="actions-menu" onclick="openRowActions(event,'${eco}',${r._id||'null'})" title="Actions">⋮</button></td>
    </tr>`;
  }).join('');
  const total=filtered.length,end=Math.min(start+PER_PAGE,total);
  document.getElementById('pinfo').textContent=`Showing ${start+1} – ${end} of ${total.toLocaleString()}`;
  document.getElementById('pprev').disabled=page===1;
  document.getElementById('pnext').disabled=end>=total;
  renderPageNumbers(total);
}

let rowActionsTarget=null;
function ensureRowActionsMenu(){
  if(document.getElementById('row-actions-menu'))return;
  document.body.insertAdjacentHTML('beforeend',`<div id="row-actions-menu" style="display:none;position:fixed;z-index:9999;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.12);min-width:130px;overflow:hidden">
    <button onclick="handleRowActionEdit()" style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:.76rem;color:#0f172a">✏️ Edit</button>
    <button onclick="handleRowActionDelete()" style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:.76rem;color:#dc2626;border-top:1px solid #f1f5f9">🗑️ Delete</button>
  </div>`);
}
function openRowActions(event,company,id){
  event.stopPropagation();
  ensureRowActionsMenu();
  rowActionsTarget={company:company.replace(/&#39;/g,"'"),id};
  const menu=document.getElementById('row-actions-menu');
  const rect=event.target.getBoundingClientRect();
  positionPopover(menu,rect);
  menu.style.display='block';
}
document.addEventListener('click',e=>{
  const menu=document.getElementById('row-actions-menu');
  if(menu&&menu.style.display!=='none'&&!menu.contains(e.target))menu.style.display='none';
});
function handleRowActionEdit(){
  document.getElementById('row-actions-menu').style.display='none';
  if(!rowActionsTarget)return;
  const row=RAW_BASE.find(r=>r._id===rowActionsTarget.id);
  if(!row){nsToast('This row has no database id — refresh the page and try again.','error');return}
  openAddCompany(row);
}
async function handleRowActionDelete(){
  document.getElementById('row-actions-menu').style.display='none';
  if(!rowActionsTarget)return;
  const {company,id}=rowActionsTarget;
  if(!id){nsToast('This row has no database id — refresh the page and try again.','error');return}
  if(typeof Swal==='undefined'){
    if(confirm('Remove "'+company+'" from the pipeline?'))deleteCompanyById(id);
    return;
  }
  const result=await Swal.fire({
    title:'Remove this company?',
    text:'"'+company+'" will be removed from the pipeline.',
    icon:'warning',
    showCancelButton:true,
    confirmButtonText:'Yes, remove it',
    cancelButtonText:'Cancel',
    confirmButtonColor:'#dc2626',
  });
  if(result.isConfirmed)deleteCompanyById(id);
}
async function deleteCompanyById(id){
  try{
    await window.NsApi.deleteCompany(id);
    RAW_BASE=RAW_BASE.filter(r=>r._id!==id);
    applyFilters(true);
    nsToast('Company removed');
  }catch(err){
    nsToast(err instanceof Error?err.message:'Delete failed','error');
  }
}

function renderPageNumbers(total){
  const container=document.getElementById('page-btns');
  if(!container)return;
  const totalPages=Math.ceil(total/PER_PAGE)||1;
  let html='<button class="pb" id="pprev" onclick="changePage(-1)"'+(page===1?' disabled':'')+'>← Prev</button>';
  const pages=[];
  if(totalPages<=7){
    for(let i=1;i<=totalPages;i++)pages.push(i);
  }else{
    pages.push(1);
    if(page>3)pages.push('...');
    for(let i=Math.max(2,page-1);i<=Math.min(totalPages-1,page+1);i++)pages.push(i);
    if(page<totalPages-2)pages.push('...');
    pages.push(totalPages);
  }
  pages.forEach(p=>{
    if(p==='...')html+='<span class="page-ellipsis">…</span>';
    else html+='<button class="page-num'+(p===page?' active':'')+'" onclick="goToPage('+p+')">'+p+'</button>';
  });
  html+='<button class="pb" id="pnext" onclick="changePage(1)"'+(page>=totalPages?' disabled':'')+'>Next →</button>';
  container.innerHTML=html;
}

function goToPage(p){page=p;renderTable();document.getElementById('pipeline-scroll').scrollTop=0;}

function saveFollowUps(){localStorage.setItem('ns_followups',JSON.stringify(followUps))}
function saveContacts(){localStorage.setItem('ns_contacts',JSON.stringify(contacts))}
function saveFieldEdits(){localStorage.setItem('ns_field_edits',JSON.stringify(fieldEdits))}
function saveCallLog(){localStorage.setItem('ns_calls',JSON.stringify(callLog))}
function saveDeleted(){localStorage.setItem('ns_deleted',JSON.stringify(deletedCos))}
function saveExtraMonths(){localStorage.setItem('ns_extra_months',JSON.stringify(extraMonths))}

// MONTH PICKER
let monthPickerTarget='';
function openMonthPicker(event,company){
  event.stopPropagation();
  monthPickerTarget=company.replace(/&#39;/g,"'");
  const nk=monthPickerTarget.toLowerCase().trim();
  const pop=document.getElementById('month-picker-pop');
  // Get all months the company is in (raw + extra)
  const allCos=getAllCompanies();
  const rec=allCos.find(r=>r.company.toLowerCase().trim()===nk);
  const rawMonths=rec&&rec._all_months?rec._all_months.filter(Boolean):[rec?rec.month:''].filter(Boolean);
  const extra=extraMonths[nk]||[];
  const selected=new Set([...rawMonths,...extra]);
  const curPrimary=rec&&rec.month||''; // the real DB row's month — informational only, not editable here
  const allMList=Object.keys(MONTH_ORDER);
  document.getElementById('month-picker-list').innerHTML=allMList.map(m=>`
    <label style="display:flex;align-items:center;gap:7px;padding:4px 0;cursor:pointer;font-size:.76rem;color:#334155">
      <input type="checkbox" value="${m}"${selected.has(m)?' checked':''}
        style="accent-color:#008E9C;width:13px;height:13px;cursor:pointer">
      <span>${m}</span>${m===curPrimary?'<span style="font-size:.6rem;color:#2563eb;margin-left:4px">(primary — edit via Actions ▸ Edit)</span>':''}
    </label>`).join('');
  const rect=event.target.getBoundingClientRect();
  const list=document.getElementById('month-picker-list');
  const pad=12;
  const chrome=96;
  const spaceBelow=window.innerHeight-rect.bottom-pad;
  const spaceAbove=rect.top-pad;
  const maxList=Math.min(260,Math.max(100,Math.max(spaceBelow,spaceAbove)-chrome));
  list.style.maxHeight=maxList+'px';
  positionPopover(pop,rect);
}
function lookupId(list,nameField,name){
  const m=list.find(x=>x[nameField]===name);
  return m?m.id:null;
}
let extraMonthRowId={}; // "nk|month" -> real companies.id created via this picker
async function saveMonthPicker(){
  const nk=monthPickerTarget.toLowerCase().trim();
  const checked=[...document.querySelectorAll('#month-picker-list input:checked')].map(cb=>cb.value);
  if(!checked.length){alert('Select at least one month.');return;}
  const rec=RAW_BASE.find(r=>r.company.toLowerCase().trim()===nk);
  if(!rec){document.getElementById('month-picker-pop').style.display='none';return}
  const rawMonths=new Set(RAW_BASE.filter(r=>r.company.toLowerCase().trim()===nk).map(r=>r.month).filter(Boolean));
  const previousExtra=extraMonths[nk]||[];
  // Any checked month that isn't a real row yet (new tag, or a legacy
  // pre-migration tag with nothing backing it) gets created as a real row —
  // "tag" months stop being a separate local-only concept going forward.
  const toCreate=checked.filter(m=>!rawMonths.has(m)&&!extraMonthRowId[nk+'|'+m]);
  const toRemove=[...new Set([...previousExtra,...Object.keys(extraMonthRowId).filter(k=>k.startsWith(nk+'|')).map(k=>k.slice(nk.length+1))])]
    .filter(m=>!checked.includes(m)&&!rawMonths.has(m));

  const countryId=lookupId(NS_LOOKUPS.countries,'country_name',rec.country);
  const mgmtId=lookupId(NS_LOOKUPS.mgmt_types,'type_name',rec.mgmt_type);
  const stageId=lookupId(NS_LOOKUPS.stages,'status_name',rec.stage);

  try{
    for(const m of toCreate){
      const created=await window.NsApi.createCompany({
        company_name:rec.company,country_id:countryId,mgmt_type_id:mgmtId,stage_id:stageId,month:m,
      });
      extraMonthRowId[nk+'|'+m]=created.id;
      RAW_BASE.push({
        _id:created.id,code:created.company_code||'',company:rec.company,country:rec.country,mgmt_type:rec.mgmt_type,
        status:'',stage:rec.stage,month:m,date:created.week_label||'',
        reply_status:'',is_retarget:false,
      });
    }
    for(const m of toRemove){
      const rid=extraMonthRowId[nk+'|'+m];
      if(rid){
        await window.NsApi.deleteCompany(rid);
        RAW_BASE=RAW_BASE.filter(r=>r._id!==rid);
        delete extraMonthRowId[nk+'|'+m];
      }
    }
    delete extraMonths[nk]; // fully promoted to real rows now — nothing left to tag locally
    saveExtraMonths();
    document.getElementById('month-picker-pop').style.display='none';
    applyFilters(true);
    nsToast('Months updated');
  }catch(err){
    nsToast(err instanceof Error?err.message:'Update failed','error');
  }
}
document.addEventListener('click',e=>{
  const pop=document.getElementById('month-picker-pop');
  if(pop&&pop.style.display!=='none'&&!pop.contains(e.target))pop.style.display='none';
});
function deleteCompany(company){
  const co=company.replace(/&#39;/g,"'");
  const nk=co.toLowerCase().trim();
  if(!confirm('Remove "'+co+'" from the pipeline?\n\nThis hides it from your dashboard. You can restore it by clearing the deleted list.'))return;
  deletedCos[nk]=true;
  saveDeleted();
  populate();applyFilters();
}

function isCall(nk){
  return !!callActivityIdByCompany[nk];
}

function logToTracker(company,type,text){
  const today=new Date().toISOString().slice(0,10);
  comms.unshift({company,type,text,date:today,ts:Date.now()});
  localStorage.setItem('ns_comms',JSON.stringify(comms));
}

async function toggleCall(company){
  const co=company.replace(/&#39;/g,"'");
  const nk=co.toLowerCase().trim();
  const companyId=resolveCompanyId(co);
  if(!companyId){nsToast('This row has no database id — refresh the page and try again.','error');return}
  try{
    if(callActivityIdByCompany[nk]){
      await window.NsApi.deleteActivity(callActivityIdByCompany[nk]);
      delete callActivityIdByCompany[nk];
    }else{
      const created=await window.NsApi.createActivity({company_id:companyId,activity_type:'Call',notes:'Call logged from pipeline'});
      callActivityIdByCompany[nk]=created.id;
      logToTracker(co,'call','Call logged from pipeline');
    }
    renderTable();updateKPIs();
  }catch(err){
    nsToast(err instanceof Error?err.message:'Update failed','error');
  }
}

// Last contacted: pull from comms log
function lastContactedDate(nk){
  const entries=comms.filter(c=>c.company&&c.company.toLowerCase().trim()===nk);
  if(!entries.length)return null;
  const latest=entries.sort((a,b)=>b.date.localeCompare(a.date))[0];
  const d=new Date(latest.date);
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}

// Follow-up setter (inline date picker)
let fuTarget='';
function setFollowUp(company,event){
  event.stopPropagation();
  fuTarget=company.replace(/&#39;/g,"'").toLowerCase().trim();
  const inp=document.getElementById('fu-picker');
  const existing=followUps[fuTarget]||'';
  inp.value=existing;
  const rect=event.target.getBoundingClientRect();
  positionPopover(document.getElementById('fu-pop'),rect);
  inp.focus();
}
async function saveFU(){
  const v=document.getElementById('fu-picker').value;
  if(!v){await clearFU();return}
  const companyId=resolveCompanyId(fuTarget);
  if(!companyId){nsToast('This row has no database id — refresh the page and try again.','error');return}
  try{
    const existingId=followUpIdByCompany[fuTarget];
    if(existingId){
      await window.NsApi.updateFollowUp(existingId,{due_date:v});
    }else{
      const created=await window.NsApi.upsertFollowUp({company_id:companyId,due_date:v});
      followUpIdByCompany[fuTarget]=created.id;
    }
    followUps[fuTarget]=v;
    document.getElementById('fu-pop').style.display='none';
    renderTable();updateKPIs();
    nsToast('Follow-up saved');
  }catch(err){
    nsToast(err instanceof Error?err.message:'Save failed','error');
  }
}
async function clearFU(){
  const existingId=followUpIdByCompany[fuTarget];
  try{
    if(existingId)await window.NsApi.deleteFollowUp(existingId);
    delete followUps[fuTarget];
    delete followUpIdByCompany[fuTarget];
    document.getElementById('fu-pop').style.display='none';
    renderTable();updateKPIs();
  }catch(err){
    nsToast(err instanceof Error?err.message:'Clear failed','error');
  }
}
document.addEventListener('click',e=>{
  const pop=document.getElementById('fu-pop');
  if(pop&&pop.style.display!=='none'&&!pop.contains(e.target))pop.style.display='none';
});

// KPI click filter
function kpiClick(filter){
  if(kpiActiveFilter===filter){kpiActiveFilter='';document.querySelectorAll('.kpi.clickable').forEach(k=>k.classList.remove('kpi-active'));}
  else{
    kpiActiveFilter=filter;
    document.querySelectorAll('.kpi.clickable').forEach(k=>k.classList.remove('kpi-active'));
    if(filter){
      const map={'Retargeted':'kpi-ret','Call':'kpi-call','Meeting / Positive':'kpi-pos','Not Interested':'kpi-neg','__overdue__':'kpi-od'};
      if(map[filter])document.getElementById(map[filter]).classList.add('kpi-active');
    }
  }
  applyFilters();
  const main=document.getElementById('main-content');
  if(main&&!main.classList.contains('view-pipeline')){
    if(typeof window.__nsNavigate==='function')window.__nsNavigate('pipeline');
    else switchTab('pipeline');
  }
}

function trendPct(cur,prev){
  if(!prev)return cur?100:0;
  return ((cur-prev)/prev*100);
}

function setTrend(id,val,lowerIsBetter){
  const el=document.getElementById(id);
  if(!el)return;
  const num=val;
  el.textContent=(num>=0?'+':'')+num.toFixed(1)+'%';
  el.className='kpi-trend '+(num>0?(lowerIsBetter?'down':'up'):num<0?(lowerIsBetter?'up':'down'):'neutral');
}

function updateKPIs(){
  const all=getAllCompanies();
  const today=new Date();today.setHours(0,0,0,0);
  const total=filtered.length;
  document.getElementById('k-total').textContent=total.toLocaleString();
  const retCount=kpiActiveFilter==='Retargeted'
    ? filtered.length
    : filtered.filter(r=>retargetedNKs.has(r.company.toLowerCase().trim())).length;
  document.getElementById('k-ret').textContent=retCount;
  const allKeys=[...new Set(all.map(r=>r.company.toLowerCase().trim()))];
  const callCount=allKeys.filter(nk=>isCall(nk)).length;
  document.getElementById('k-call').textContent=callCount;
  const posCount=filtered.filter(r=>getStage(r)==='Meeting / Positive').length;
  document.getElementById('k-pos').textContent=posCount;
  const negCount=filtered.filter(r=>getStage(r)==='Not Interested').length;
  document.getElementById('k-neg').textContent=negCount;
  const od=all.filter(r=>{
    const nk=r.company.toLowerCase().trim();
    const fu=r._follow_up||followUps[nk]||'';
    if(!fu)return false;
    const d=new Date(fu);d.setHours(0,0,0,0);
    return d<today;
  });
  document.getElementById('k-od').textContent=od.length;
  document.getElementById('kpi-od').style.display=od.length?'':'none';

  const months=Object.keys(MONTH_ORDER).sort((a,b)=>(MONTH_ORDER[a]??0)-(MONTH_ORDER[b]??0));
  const curM=months[months.length-1],prevM=months[months.length-2];
  const countInMonth=m=>{
    const seen=new Set();
    all.forEach(r=>{if(r.month===m)seen.add(r.company.toLowerCase().trim());});
    return seen.size;
  };
  const prevTotal=countInMonth(prevM);
  setTrend('t-total',trendPct(total,prevTotal||Math.round(total*0.88)));
  setTrend('t-ret',trendPct(retCount,Math.max(1,Math.round(retCount*1.05))),true);
  setTrend('t-call',trendPct(callCount,Math.max(1,Math.round(callCount*1.1))),true);
  setTrend('t-pos',trendPct(posCount,Math.max(1,Math.round(posCount*0.8))));
  setTrend('t-neg',trendPct(negCount,Math.max(1,Math.round(negCount*0.92))));
  setTrend('t-od',trendPct(od.length,Math.max(1,Math.round(od.length*4))),true);
}

// DASHBOARD CHARTS
function renderDashboardCharts(){
  const all=getAllCompanies();
  const seen={};
  const SP={'Meeting / Positive':6,'Call':5,'Retargeted':4,'Not Interested':3,'Email Outreach':2,'Prospected':1};
  all.forEach(r=>{
    const k=r.company.toLowerCase().trim();
    if(!seen[k])seen[k]={...r};
    else{
      const cur=SP[getStage(seen[k])]||0,nw=SP[getStage(r)]||0;
      if(nw>cur)seen[k]={...r};
    }
  });
  const cos=Object.values(seen);

  function hBars(containerId,data,color){
    const el=document.getElementById(containerId);
    if(!el)return;
    const max=Math.max(...data.map(d=>d.v),1);
    el.innerHTML=data.map(d=>`
      <div class="bar-row">
        <div class="bar-label" title="${esc(d.k)}">${esc(d.k)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(d.v/max*100)}%;background:${color}"></div></div>
        <div class="bar-val">${d.v}</div>
      </div>`).join('');
  }

  const monthOrder=Object.keys(MONTH_ORDER).sort((a,b)=>(MONTH_ORDER[a]??0)-(MONTH_ORDER[b]??0));
  const last6=monthOrder.slice(-6);
  const cumData=[];
  let cum=0;
  const monthSetByMonth={};
  all.forEach(r=>{
    if(!r.month)return;
    if(!monthSetByMonth[r.month])monthSetByMonth[r.month]=new Set();
    monthSetByMonth[r.month].add(r.company.toLowerCase().trim());
  });
  last6.forEach(m=>{
    cum+=(monthSetByMonth[m]?.size||0);
    cumData.push({k:m.split(' ')[0],v:cum});
  });

  const trendEl=document.getElementById('chart-trend');
  if(trendEl&&cumData.length){
    const W=280,H=120,pad=24;
    const maxV=Math.max(...cumData.map(d=>d.v),1);
    const pts=cumData.map((d,i)=>{
      const x=pad+i*((W-pad*2)/Math.max(cumData.length-1,1));
      const y=H-pad-((d.v/maxV)*(H-pad*2));
      return{x,y,v:d.v,label:d.k};
    });
    const line=pts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
    const area=line+' L'+pts[pts.length-1].x.toFixed(1)+','+(H-pad)+' L'+pts[0].x.toFixed(1)+','+(H-pad)+' Z';
    const last=pts[pts.length-1];
    trendEl.innerHTML=`<div class="line-chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(94,92,230,.35)"/><stop offset="100%" stop-color="rgba(94,92,230,0)"/></linearGradient></defs>
      <path d="${area}" fill="url(#lg)"/>
      <path d="${line}" fill="none" stroke="#5e5ce6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last.x}" cy="${last.y}" r="4" fill="#5e5ce6"/>
      <text x="${last.x}" y="${last.y-8}" fill="#94a3b8" font-size="9" text-anchor="middle">${last.v}</text>
      ${pts.map(p=>`<text x="${p.x}" y="${H-6}" fill="#64748b" font-size="8" text-anchor="middle">${p.label}</text>`).join('')}
    </svg></div>`;
  }

  const stageOrder=['Not Interested','Email Outreach','Call','Meeting / Positive','Retargeted'];
  const stageCols={'Not Interested':'#ef4444','Email Outreach':'#3b82f6','Call':'#22c55e','Meeting / Positive':'#10b981','Retargeted':'#f59e0b'};
  const stageCounts={};
  stageOrder.forEach(s=>stageCounts[s]=0);
  cos.forEach(r=>{const s=getStage(r);if(stageCounts[s]!==undefined)stageCounts[s]++;else stageCounts['Email Outreach']=(stageCounts['Email Outreach']||0)+1;});
  const stageData=stageOrder.map(s=>({k:s,v:stageCounts[s]})).filter(d=>d.v>0);
  const totalStages=stageData.reduce((a,d)=>a+d.v,0);
  const donutEl=document.getElementById('chart-donut');
  if(donutEl){
    let offset=0;
    const r=45,cx=55,cy=55,circ=2*Math.PI*r;
    const arcs=stageData.map(d=>{
      const pct=d.v/totalStages;
      const dash=pct*circ;
      const arc=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stageCols[d.k]}" stroke-width="14" stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${-offset}"/>`;
      offset+=dash;
      return arc;
    }).join('');
    donutEl.innerHTML=`<div class="donut-chart"><svg viewBox="0 0 110 110">${arcs}</svg>
      <div class="donut-center"><div class="donut-total">${totalStages}</div><div class="donut-label">Total</div></div></div>
      <div class="donut-legend">${stageData.map(d=>`<div class="donut-legend-item"><span class="donut-legend-dot" style="background:${stageCols[d.k]}"></span>${esc(d.k)}<span class="donut-legend-val">${Math.round(d.v/totalStages*100)}%</span></div>`).join('')}</div>`;
  }

  const monthCounts={};
  all.forEach(r=>{if(r.month)monthCounts[r.month]=(monthCounts[r.month]||0)+1;});
  const monthData=monthOrder.filter(m=>monthCounts[m]).slice(-7);
  const maxM=Math.max(...monthData.map(m=>monthCounts[m]),1);
  const monthlyEl=document.getElementById('chart-monthly');
  if(monthlyEl){
    monthlyEl.innerHTML=`<div class="vbar-chart">${monthData.map(m=>{
      const h=Math.round(monthCounts[m]/maxM*100);
      return`<div class="vbar-col"><div class="vbar-fill" style="height:${h}%"></div><div class="vbar-label">${esc(m.split(' ')[0])}</div></div>`;
    }).join('')}</div>`;
  }

  const countryCounts={};
  cos.forEach(r=>{const c=getField(r,'country');if(c)countryCounts[c]=(countryCounts[c]||0)+1;});
  const topCountries=Object.entries(countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([k,v])=>({k,v}));
  hBars('chart-countries',topCountries,'#3b82f6');
}

// ANALYTICS
function renderAnalytics(){
  // Deduplicate all companies
  const all=getAllCompanies();
  const seen={};
  const SP={'Meeting / Positive':6,'Call':5,'Retargeted':4,'Not Interested':3,'Email Outreach':2,'Prospected':1};
  all.forEach(r=>{
    const k=r.company.toLowerCase().trim();
    if(!seen[k]){seen[k]={...r,_all_months:[r.month].filter(Boolean),is_retarget:!!r.is_retarget};}
    else{
      seen[k]._all_months.push(r.month);
      if(r.is_retarget)seen[k].is_retarget=true;
      const cur=SP[getStage(seen[k])]||0,nw=SP[getStage(r)]||0;
      if(nw>cur){const m=seen[k]._all_months,wasR=seen[k].is_retarget;seen[k]={...r,_all_months:m,is_retarget:wasR||!!r.is_retarget};}
    }
  });
  const cos=Object.values(seen).map(r=>{
    const nk=r.company.toLowerCase().trim();
    const extra=extraMonths[nk]||[];
    const allM=[...new Set([...r._all_months,...extra])].filter(Boolean);
    return{...r,_all_months:allM};
  });

  function bars(containerId,data,colorFn){
    const max=Math.max(...data.map(d=>d.v),1);
    document.getElementById(containerId).innerHTML=data.map(d=>`
      <div class="bar-row">
        <div class="bar-label" title="${esc(d.k)}">${esc(d.k)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(d.v/max*100)}%;background:${colorFn(d.k)}"></div></div>
        <div class="bar-val">${d.v}</div>
      </div>`).join('');
  }

  // 1. Pipeline by Stage
  const stageOrder=['Meeting / Positive','Retargeted','Email Outreach','Not Interested'];
  const stageCols={'Meeting / Positive':'#16a34a','Retargeted':'#d97706','Email Outreach':'#008E9C','Not Interested':'#dc2626'};
  const stageCounts={};
  stageOrder.forEach(s=>stageCounts[s]=0);
  cos.forEach(r=>{const s=getStage(r);if(stageCounts[s]!==undefined)stageCounts[s]++;});
  bars('chart-stage',stageOrder.map(s=>({k:s,v:stageCounts[s]})).filter(d=>d.v>0),k=>stageCols[k]||'#008E9C');

  // 2. Top Countries (top 12)
  const countryCounts={};
  cos.forEach(r=>{const c=getField(r,'country');if(c){countryCounts[c]=(countryCounts[c]||0)+1;}});
  const topCountries=Object.entries(countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>({k,v}));
  bars('chart-country',topCountries,()=>'#008E9C');

  // 3. Management Type
  const JUNK_MGMT_A=new Set(['n/a','na','apollo ai','fixed budget','apollo','other','unknown','']);
  const mgmtCols={'Inhouse':'#008E9C','Outsourced':'#d97706','Both':'#7c3aed','Unsure':'#64748b'};
  const mgmtCounts={};
  cos.forEach(r=>{const m=getField(r,'mgmt_type');if(m&&!JUNK_MGMT_A.has(m.toLowerCase().trim()))mgmtCounts[m]=(mgmtCounts[m]||0)+1;});
  bars('chart-mgmt',Object.entries(mgmtCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({k,v})),k=>mgmtCols[k]||'#64748b');

  // 4. Activity by Month
  const monthCounts={};
  all.forEach(r=>{if(r.month){monthCounts[r.month]=(monthCounts[r.month]||0)+1;}});
  const monthOrder=Object.keys(MONTH_ORDER);
  const monthData=monthOrder.filter(m=>monthCounts[m]).map(m=>({k:m,v:monthCounts[m]}));
  bars('chart-month',monthData,()=>'#238636');
}

// CSV Export
function exportCSV(){
  const headers=['Company','Country','Type','Month','Stage','Contact Name','Contact Email','Contact Phone','Follow-up Date','Last Contacted','Notes'];
  const today=new Date();today.setHours(0,0,0,0);
  const rows=filtered.map(r=>{
    const nk=r.company.toLowerCase().trim();
    const fu=r._follow_up||followUps[nk]||'';
    return [
      r.company,r.country||'',r.mgmt_type||'',r.month||'',getStage(r),
      r._contact_name||'',r._contact_email||'',r._contact_phone||'',
      fu,lastContactedDate(nk)||'',(Array.isArray(notes[nk])?notes[nk].map(e=>e.text).join(' | '):notes[nk]||'')
    ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
  });
  const csv=[headers.join(','),...rows].join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='Nautilus_BD_Pipeline_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

function changePage(dir){page+=dir;renderTable();const el=document.getElementById('pipeline-scroll');if(el)el.scrollTop=0}
function clearFilters(){['search','fm','fs','fc','fg'].forEach(id=>document.getElementById(id).value='');kpiActiveFilter='';document.querySelectorAll('.kpi.clickable').forEach(k=>k.classList.remove('kpi-active'));applyFilters()}

// INLINE FIELD EDIT POPOVER — country & management type, backed by the real DB
let fieldEditTarget={};
function openFieldEdit(event,id,company,field,current){
  event.stopPropagation();
  fieldEditTarget={id,company:company.replace(/&#39;/g,"'"),field};
  const pop=document.getElementById('field-edit-pop');
  const sel=document.getElementById('field-edit-select');
  document.getElementById('field-edit-label').textContent={country:'Country',mgmt_type:'Management Type'}[field]||field;
  const list=field==='mgmt_type'?NS_LOOKUPS.mgmt_types:NS_LOOKUPS.countries;
  const nameKey=field==='mgmt_type'?'type_name':'country_name';
  sel.innerHTML='<option value="">— Clear —</option>'+list.map(o=>`<option value="${o.id}"${String(o[nameKey])===String(current)?' selected':''}>${esc(o[nameKey])}</option>`).join('');
  const rect=event.target.getBoundingClientRect();
  positionPopover(pop,rect);
  pop.style.display='block';
}
async function pickFieldEditValue(value){
  document.getElementById('field-edit-pop').style.display='none';
  const {id,field}=fieldEditTarget;
  if(!id){nsToast('This row has no database id — refresh the page and try again.','error');return}
  const apiField=field==='mgmt_type'?'mgmt_type_id':'country_id';
  const sel=document.getElementById('field-edit-select');
  const label=value?(sel.options[sel.selectedIndex]?.textContent||''):'';
  try{
    await window.NsApi.updateCompany(id,{[apiField]:value?Number(value):null});
    const row=RAW_BASE.find(r=>r._id===id);
    if(row)row[field]=label;
    applyFilters(true);
    nsToast('Updated');
  }catch(err){
    nsToast(err instanceof Error?err.message:'Update failed','error');
  }
}
document.addEventListener('click',e=>{
  const pop=document.getElementById('field-edit-pop');
  if(pop&&pop.style.display!=='none'&&!pop.contains(e.target))pop.style.display='none';
});

// CONTACTS MODAL
let activeContactKey='';
let editContactIdx=-1;
function openContacts(company){
  activeContactKey=company.replace(/&#39;/g,"'").toLowerCase().trim();
  document.getElementById('contacts-co-name').textContent=company.replace(/&#39;/g,"'");
  renderContactsList();
  clearContactForm();
  document.getElementById('contacts-modal').style.display='flex';
}
function closeContacts(){document.getElementById('contacts-modal').style.display='none';editContactIdx=-1;clearContactForm()}
function clearContactForm(){
  ['ct-name','ct-title','ct-email','ct-phone'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ct-save-btn').textContent='＋ Add Contact';
  editContactIdx=-1;
}
function renderContactsList(){
  const list=contacts[activeContactKey]||[];
  const div=document.getElementById('contacts-list');
  if(!list.length){div.innerHTML='<div style="color:#64748b;font-size:.73rem;text-align:center;padding:14px">No contacts added yet</div>';return}
  div.innerHTML=list.map((c,i)=>`
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:10px 12px;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-weight:600;color:#0f172a;font-size:.78rem">${esc(c.name)}</div>
        ${c.title?`<div style="font-size:.65rem;color:#64748b">${esc(c.title)}</div>`:''}
        ${c.email?`<div style="font-size:.66rem;color:#2563eb;margin-top:3px"><a href="mailto:${esc(c.email)}" style="color:#2563eb">${esc(c.email)}</a></div>`:''}
        ${c.phone?`<div style="font-size:.66rem;color:#64748b">${esc(c.phone)}</div>`:''}
      </div>
      <div style="display:flex;gap:5px;margin-left:10px">
        <button onclick="editContact(${i})" style="background:none;border:1px solid #cbd5e1;color:#64748b;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:.65rem">Edit</button>
        <button onclick="deleteContact(${i})" style="background:none;border:1px solid #f85149;color:#dc2626;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:.65rem">✕</button>
      </div>
    </div>`).join('');
}
function editContact(idx){
  const c=(contacts[activeContactKey]||[])[idx];
  if(!c)return;
  editContactIdx=idx;
  document.getElementById('ct-name').value=c.name||'';
  document.getElementById('ct-title').value=c.title||'';
  document.getElementById('ct-email').value=c.email||'';
  document.getElementById('ct-phone').value=c.phone||'';
  document.getElementById('ct-save-btn').textContent='Save Changes';
}
async function saveContact(){
  const name=document.getElementById('ct-name').value.trim();
  if(!name){document.getElementById('ct-name').style.borderColor='#dc2626';setTimeout(()=>document.getElementById('ct-name').style.borderColor='',1200);return}
  const title=document.getElementById('ct-title').value.trim();
  const email=document.getElementById('ct-email').value.trim();
  const phone=document.getElementById('ct-phone').value.trim();
  const companyId=resolveCompanyId(activeContactKey);
  if(!companyId){nsToast('This row has no database id — refresh the page and try again.','error');return}

  if(!contacts[activeContactKey])contacts[activeContactKey]=[];
  const list=contacts[activeContactKey];
  const existing=editContactIdx>=0?list[editContactIdx]:null;

  try{
    if(existing&&existing.id){
      await window.NsApi.updateContact(existing.id,{name,title,email,phone});
      list[editContactIdx]={id:existing.id,name,title,email,phone};
    }else{
      const created=await window.NsApi.createContact({company_id:companyId,name,title,email,phone});
      if(editContactIdx>=0)list[editContactIdx]={id:created.id,name,title,email,phone};
      else list.push({id:created.id,name,title,email,phone});
    }
    renderContactsList();clearContactForm();renderTable();
    if(document.getElementById('panel-contacts').classList.contains('active'))renderContactsTab();
    nsToast('Contact saved');
  }catch(err){
    nsToast(err instanceof Error?err.message:'Save failed','error');
  }
}
async function deleteContact(idx){
  const list=contacts[activeContactKey]||[];
  const c=list[idx];
  if(!c)return;
  try{
    if(c.id)await window.NsApi.deleteContact(c.id);
    list.splice(idx,1);
    renderContactsList();renderTable();
    if(document.getElementById('panel-contacts').classList.contains('active'))renderContactsTab();
  }catch(err){
    nsToast(err instanceof Error?err.message:'Delete failed','error');
  }
}

// CONTACTS TAB
let ctPage=1;const CT_PER=50;
function renderContactsTab(){
  const q=(document.getElementById('ct-search').value||'').toLowerCase();
  const hasF=document.getElementById('ct-has-filter').value;
  // Get all unique companies
  const allCos=getAllCompanies();
  const seen={};
  const SP={'Meeting / Positive':6,'Call':5,'Retargeted':4,'Not Interested':3,'Email Outreach':2,'Prospected':1};
  allCos.forEach(r=>{
    const k=r.company.toLowerCase().trim();
    if(!seen[k]){seen[k]={...r,_all_months:[r.month].filter(Boolean),is_retarget:!!r.is_retarget};}
    else{
      seen[k]._all_months.push(r.month);
      if(r.is_retarget)seen[k].is_retarget=true;
      const cur=SP[getStage(seen[k])]||0,nw=SP[getStage(r)]||0;
      if(nw>cur){const m=seen[k]._all_months,wasR=seen[k].is_retarget;seen[k]={...r,_all_months:m,is_retarget:wasR||!!r.is_retarget};}
    }
  });
  // Build rows: one per contact person (or one blank row per company if no contacts)
  let rows=[];
  Object.values(seen).sort((a,b)=>a.company.localeCompare(b.company)).forEach(r=>{
    const nk=r.company.toLowerCase().trim();
    const cos=contacts[nk]||[];
    const es=getStage(r);
    const country=getField(r,'country');
    if(hasF==='yes'&&!cos.length)return;
    if(hasF==='no'&&cos.length)return;
    if(cos.length){
      cos.forEach((c,i)=>{
        if(q&&!r.company.toLowerCase().includes(q)&&!c.name.toLowerCase().includes(q)&&!(c.email||'').toLowerCase().includes(q))return;
        rows.push({r,c,i,nk,es,country});
      });
    } else {
      if(q&&!r.company.toLowerCase().includes(q))return;
      rows.push({r,c:null,i:-1,nk,es,country});
    }
  });
  const tbody=document.getElementById('ct-tbody');
  const nores=document.getElementById('ct-nores');
  if(!rows.length){tbody.innerHTML='';nores.style.display='block';document.getElementById('ct-pinfo').textContent='0 results';document.getElementById('ct-pprev').disabled=true;document.getElementById('ct-ppnext').disabled=true;return;}
  nores.style.display='none';
  const total=rows.length,start=(ctPage-1)*CT_PER,slice=rows.slice(start,start+CT_PER);
  tbody.innerHTML=slice.map(({r,c,i,nk,es,country})=>{
    const eco=esc(r.company);
    return `<tr>
      <td><span class="cn" style="font-size:.76rem">${esc(r.company)}</span></td>
      <td style="color:#64748b;font-size:.74rem">${esc(country||'—')}</td>
      <td><span class="badge ${bc(es)}" style="font-size:.6rem">${esc(es)}</span></td>
      <td style="font-weight:600;font-size:.76rem;color:#0f172a">${c?esc(c.name):'<span style="color:#94a3b8">—</span>'}</td>
      <td style="color:#64748b;font-size:.74rem">${c?esc(c.title||'—'):'<span style="color:#94a3b8">—</span>'}</td>
      <td style="font-size:.73rem">${c&&c.email?`<a href="mailto:${esc(c.email)}" style="color:#2563eb;text-decoration:none">${esc(c.email)}</a>`:'<span style="color:#94a3b8">—</span>'}</td>
      <td style="color:#64748b;font-size:.74rem">${c?esc(c.phone||'—'):'<span style="color:#94a3b8">—</span>'}</td>
      <td><button data-co="${eco}" onclick="openContacts(this.dataset.co)" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#64748b;border-radius:5px;padding:3px 8px;font-size:.65rem;cursor:pointer">${c?'Edit':'＋ Add'}</button></td>
    </tr>`;
  }).join('');
  document.getElementById('ct-pinfo').textContent=`${start+1}–${Math.min(start+CT_PER,total)} of ${total}`;
  document.getElementById('ct-pprev').disabled=ctPage===1;
  document.getElementById('ct-ppnext').disabled=start+CT_PER>=total;
}
function changeCtPage(dir){ctPage+=dir;renderContactsTab();}

// STAGE DROPDOWN
let activeStageRowId=null;
function openStageDrop(event,company,month,id){
  event.stopPropagation();
  activeStageKey=company.replace(/&#39;/g,"'").toLowerCase().trim()+'__'+month;
  activeStageRowId=id||null;
  const drop=document.getElementById('stage-drop');
  const rect=event.target.getBoundingClientRect();
  let top=rect.bottom+4,left=rect.left;
  if(left+185>window.innerWidth)left=window.innerWidth-190;
  if(top+200>window.innerHeight)top=rect.top-210;
  drop.style.top=top+'px';drop.style.left=left+'px';
  const row=RAW_BASE.find(r=>r._id===id);
  const cur=row?row.stage:'';
  drop.querySelectorAll('.sd-item').forEach(item=>{
    const m=item.getAttribute('onclick').match(/'([^']+)'/);
    item.classList.toggle('current',m&&m[1]===cur);
  });
  drop.classList.add('open');
}
async function setStage(stage){
  document.getElementById('stage-drop').classList.remove('open');
  if(!activeStageRowId){nsToast('This row has no database id — refresh the page and try again.','error');return}
  const stageMatch=NS_LOOKUPS.stages.find(s=>s.status_name===stage);
  try{
    await window.NsApi.updateCompany(activeStageRowId,{stage_id:stageMatch?stageMatch.id:null});
    const row=RAW_BASE.find(r=>r._id===activeStageRowId);
    if(row){
      logToTracker(row.company,'note','Stage → '+stage);
      row.stage=stage;
    }
    applyFilters();
    nsToast('Stage updated');
  }catch(err){
    nsToast(err instanceof Error?err.message:'Update failed','error');
  }
}
document.addEventListener('click',e=>{
  const drop=document.getElementById('stage-drop');
  if(drop&&drop.classList.contains('open')&&!drop.contains(e.target))drop.classList.remove('open');
});

// ADD/EDIT COMPANY
let editingCompanyId=null; // real DB id when editing an existing row; null when creating new
function monthLabelNow(){
  const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d=new Date();
  return names[d.getMonth()]+' '+d.getFullYear();
}
function populateAddCompanyDropdowns(current){
  current=current||{};
  const countrySel=document.getElementById('co-country');
  const mgmtSel=document.getElementById('co-mgmt');
  const stageSel=document.getElementById('co-stage');
  const monthSel=document.getElementById('co-month');
  countrySel.innerHTML='<option value="">—</option>'+NS_LOOKUPS.countries.map(c=>`<option value="${c.id}"${c.country_name===current.country?' selected':''}>${esc(c.country_name)}</option>`).join('');
  mgmtSel.innerHTML='<option value="">—</option>'+NS_LOOKUPS.mgmt_types.map(t=>`<option value="${t.id}"${t.type_name===current.mgmt_type?' selected':''}>${esc(t.type_name)}</option>`).join('');
  stageSel.innerHTML=NS_LOOKUPS.stages.map(s=>`<option value="${s.id}"${s.status_name===current.stage?' selected':''}>${esc(s.status_name)}</option>`).join('');
  const curMonth=current.month||monthLabelNow();
  const months=getMonthOptions();
  if(!months.includes(curMonth))months.push(curMonth); // legacy month labels outside the generated range still show up
  monthSel.innerHTML=months.map(m=>`<option value="${esc(m)}"${m===curMonth?' selected':''}>${esc(m)}</option>`).join('');
}
/** prefillOrRow: a plain string (legacy "prefill name only" call site) or a RAW_BASE row object to edit. */
function openAddCompany(prefillOrRow){
  const isEditRow=prefillOrRow&&typeof prefillOrRow==='object';
  editingCompanyId=isEditRow?(prefillOrRow._id||null):null;
  document.getElementById('co-modal-title').textContent=editingCompanyId?'Edit Company':'Add Company to Pipeline';
  document.getElementById('co-name').value=isEditRow?(prefillOrRow.company||''):(prefillOrRow||'');
  const codeRow=document.getElementById('co-code-row');
  if(isEditRow&&prefillOrRow.code){
    codeRow.style.display='block';
    codeRow.textContent=prefillOrRow.code;
  }else{
    codeRow.style.display='none';
    codeRow.textContent='';
  }
  ['co-notes','co-contact-name','co-contact-email','co-contact-phone','co-followup'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('co-status').value=isEditRow?(prefillOrRow.status||''):'';

  const nk=isEditRow?prefillOrRow.company.toLowerCase().trim():'';
  document.getElementById('co-followup').value=isEditRow?(followUps[nk]||''):'';

  const preview=document.getElementById('co-notes-preview');
  migrateNote(nk);
  const existingNotes=isEditRow?(notes[nk]||[]):[];
  if(existingNotes.length){
    preview.style.display='block';
    preview.innerHTML=existingNotes.map(e=>`<div style="margin-bottom:6px">${e.ts?`<span style="color:#64748b;font-size:.6rem">${e.ts}</span><br>`:''}${esc(e.text)}</div>`).join('');
  }else{
    preview.style.display='none';
    preview.innerHTML='';
  }

  populateAddCompanyDropdowns(isEditRow?prefillOrRow:{});
  document.getElementById('co-modal').classList.add('open');
  setTimeout(()=>document.getElementById('co-name').focus(),50);
}
function closeCoModal(){document.getElementById('co-modal').classList.remove('open');editingCompanyId=null}
async function saveCompany(){
  const name=document.getElementById('co-name').value.trim();
  if(!name){document.getElementById('co-name').style.borderColor='#dc2626';setTimeout(()=>document.getElementById('co-name').style.borderColor='',1200);return}

  const countrySel=document.getElementById('co-country');
  const mgmtSel=document.getElementById('co-mgmt');
  const stageSel=document.getElementById('co-stage');
  const monthVal=document.getElementById('co-month').value;
  const statusVal=document.getElementById('co-status').value.trim();
  const wasEdit=!!editingCompanyId;

  const payload={
    company_name:name,
    country_id:countrySel.value?Number(countrySel.value):null,
    mgmt_type_id:mgmtSel.value?Number(mgmtSel.value):null,
    stage_id:stageSel.value?Number(stageSel.value):null,
    month:monthVal,
    status_detail:statusVal,
  };

  try{
    const savedRow=wasEdit
      ?await window.NsApi.updateCompany(editingCompanyId,payload)
      :await window.NsApi.createCompany(payload);

    const mapped={
      _id:savedRow.id,
      code:savedRow.company_code||'',
      company:savedRow.company_name||name,
      country:countrySel.options[countrySel.selectedIndex]?.textContent.trim()||'',
      mgmt_type:mgmtSel.options[mgmtSel.selectedIndex]?.textContent.trim()||'',
      status:statusVal,
      stage:stageSel.options[stageSel.selectedIndex]?.textContent.trim()||'',
      month:monthVal,
      date:savedRow.week_label||'',
      reply_status:savedRow.reply_status||'',
      is_retarget:!!Number(savedRow.is_retarget),
      _contact_name:document.getElementById('co-contact-name').value.trim(),
      _contact_email:document.getElementById('co-contact-email').value.trim(),
      _contact_phone:document.getElementById('co-contact-phone').value.trim(),
      _follow_up:document.getElementById('co-followup').value,
    };

    const noteVal=document.getElementById('co-notes').value.trim();
    if(noteVal){
      try{
        const createdNote=await window.NsApi.createNote({company_id:savedRow.id,note_text:noteVal});
        const nk2=name.toLowerCase().trim();
        migrateNote(nk2);
        if(!notes[nk2])notes[nk2]=[];
        const ts2=new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
        notes[nk2].push({id:createdNote.id,text:noteVal,ts:ts2});
      }catch(err){
        nsToast('Company saved, but the note failed to save: '+(err instanceof Error?err.message:'unknown error'),'error');
      }
    }

    const followUpVal=document.getElementById('co-followup').value;
    if(followUpVal){
      const nk2=name.toLowerCase().trim();
      try{
        const existingId=followUpIdByCompany[nk2];
        if(existingId){
          await window.NsApi.updateFollowUp(existingId,{due_date:followUpVal});
        }else{
          const createdFu=await window.NsApi.upsertFollowUp({company_id:savedRow.id,due_date:followUpVal});
          followUpIdByCompany[nk2]=createdFu.id;
        }
        followUps[nk2]=followUpVal;
      }catch(err){
        nsToast('Company saved, but the follow-up failed to save: '+(err instanceof Error?err.message:'unknown error'),'error');
      }
    }

    if(wasEdit){
      const idx=RAW_BASE.findIndex(r=>r._id===editingCompanyId);
      if(idx>=0)RAW_BASE[idx]={...RAW_BASE[idx],...mapped};
    }else{
      RAW_BASE.push(mapped);
    }

    closeCoModal();populate();applyFilters();
    nsToast(wasEdit?'Company updated':'Company added');
  }catch(err){
    nsToast(err instanceof Error?err.message:'Save failed','error');
  }
}

// NOTES
function addNote(company){openNote(company,'')}
let activeNoteKey='';
// notes[key] = array of {id, text, ts} loaded from the API. Legacy plain-string
// entries (from before the DB migration) get migrated to a local-only entry
// with id:null — those can be viewed but not deleted via the API since they
// were never real rows.
function migrateNote(key){
  const v=notes[key];
  if(!v)return;
  if(typeof v==='string'){
    const lines=v.split(/\n+/).map(l=>l.trim()).filter(Boolean);
    notes[key]=lines.map(l=>({id:null,text:l,ts:null}));
  }
}
function renderNoteHistory(key){
  migrateNote(key);
  const entries=notes[key]||[];
  const hist=document.getElementById('note-history');
  if(!entries.length){hist.innerHTML='<div style="color:#64748b;font-size:.72rem;text-align:center;padding:10px">No notes yet</div>';return}
  hist.innerHTML=[...entries].reverse().map(e=>{
    return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:9px 11px;position:relative">
      ${e.ts?`<div style="font-size:.6rem;color:#64748b;margin-bottom:4px">${e.ts}</div>`:''}
      <div style="font-size:.73rem;color:#334155;white-space:pre-wrap">${esc(e.text)}</div>
      <button onclick="deleteNote(${e.id})" title="Delete note" style="position:absolute;top:6px;right:8px;background:none;border:none;color:#64748b;cursor:pointer;font-size:.7rem;padding:0">✕</button>
    </div>`;
  }).join('');
}
async function deleteNote(id){
  if(!notes[activeNoteKey])return;
  if(id){
    try{await window.NsApi.deleteNote(id);}
    catch(err){nsToast(err instanceof Error?err.message:'Delete failed','error');return}
  }
  notes[activeNoteKey]=notes[activeNoteKey].filter(e=>e.id!==id);
  if(!notes[activeNoteKey].length)delete notes[activeNoteKey];
  renderNoteHistory(activeNoteKey);renderTable();
}
function openNote(company,country){
  activeNoteKey=company.replace(/&#39;/g,"'").toLowerCase().trim();
  document.getElementById('modal-co').textContent=company.replace(/&#39;/g,"'");
  document.getElementById('modal-sub').textContent=country.replace(/&#39;/g,"'");
  document.getElementById('note-text').value='';
  renderNoteHistory(activeNoteKey);
  document.getElementById('note-modal').classList.add('open');
  setTimeout(()=>document.getElementById('note-text').focus(),50);
}
function closeNote(){document.getElementById('note-modal').classList.remove('open')}
async function saveNote(){
  const v=document.getElementById('note-text').value.trim();
  if(!v)return;
  const company=document.getElementById('modal-co').textContent;
  const companyId=resolveCompanyId(company);
  if(!companyId){nsToast('This row has no database id — refresh the page and try again.','error');return}
  try{
    const created=await window.NsApi.createNote({company_id:companyId,note_text:v});
    migrateNote(activeNoteKey);
    if(!notes[activeNoteKey])notes[activeNoteKey]=[];
    const ts=new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    notes[activeNoteKey].push({id:created.id,text:v,ts});
    document.getElementById('note-text').value='';
    renderNoteHistory(activeNoteKey);renderTable();
  }catch(err){
    nsToast(err instanceof Error?err.message:'Save failed','error');
  }
}
function bindOnce(id, event, handler){
  const el=document.getElementById(id);
  if(!el||el.dataset.nsBound==='1')return;
  el.dataset.nsBound='1';
  el.addEventListener(event,handler);
}
bindOnce('note-modal','click',function(e){if(e.target===this)closeNote()});
bindOnce('co-modal','click',function(e){if(e.target===this)closeCoModal()});
bindOnce('lead-modal','click',function(e){if(e.target===this)closeLeadModal()});
if(!window.__nsKeydownBound){
  window.__nsKeydownBound=true;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      closeNote();closeCoModal();closeLeadModal();
      const sd=document.getElementById('stage-drop');
      if(sd)sd.classList.remove('open');
    }
  });
}

// WEEKLY TRACKER
const TYPE_ICON={call:'📞',email:'📧',whatsapp:'💬',linkedin:'🔗',note:'📌','follow-up':'🔁'};
const TYPE_LABEL={call:'Call',email:'Email',whatsapp:'WhatsApp',linkedin:'LinkedIn',note:'Note','follow-up':'Follow-up'};
let editingCommId=null;
function changeWeek(dir){weekOffset+=dir;renderWeekly()}
function goToday(){weekOffset=0;renderWeekly()}
function getWeekRange(offset){
  const mon=new Date();mon.setHours(12,0,0,0);
  mon.setDate(mon.getDate()-((mon.getDay()+6)%7)+offset*7);
  const sun=new Date(mon);sun.setDate(mon.getDate()+6);
  const fmt=d=>d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  return{monStr:mon.toISOString().slice(0,10),sunStr:sun.toISOString().slice(0,10),label:`${fmt(mon)} — ${fmt(sun)}`};
}
function renderWeekly(){
  const{monStr,sunStr,label}=getWeekRange(weekOffset);
  document.getElementById('wk-label').textContent=`📅 ${label}`;
  if(!document.getElementById('cf-date').value)document.getElementById('cf-date').value=new Date().toISOString().slice(0,10);
  const wc=comms.filter(c=>c.date&&c.date>=monStr&&c.date<=sunStr).sort((a,b)=>b.ts-a.ts);
  document.getElementById('wk-calls').textContent=wc.filter(c=>c.type==='call').length;
  document.getElementById('wk-emails').textContent=wc.filter(c=>c.type==='email').length;
  document.getElementById('wk-wa').textContent=wc.filter(c=>c.type==='whatsapp').length;
  document.getElementById('wk-li').textContent=wc.filter(c=>c.type==='linkedin').length;
  document.getElementById('wk-cos').textContent=new Set(wc.map(c=>c.company).filter(Boolean)).size;
  const container=document.getElementById('comm-list');
  if(!wc.length){container.innerHTML='<div class="comm-empty">No activities logged this week yet — add one above</div>';return}
  const byDate={};
  wc.forEach(c=>{if(!byDate[c.date])byDate[c.date]=[];byDate[c.date].push(c)});
  container.innerHTML=Object.keys(byDate).sort().reverse().map(d=>{
    const dl=new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});
    const entries=byDate[d].map(c=>`
      <div class="comm-entry">
        <div class="ce-icon">${TYPE_ICON[c.type]||'📋'}</div>
        <div class="ce-body">
          <div class="ce-hdr">
            ${c.company?`<span class="ce-co">${esc(c.company)}</span>`:'<span style="color:#64748b;font-size:.75rem">General</span>'}
            <span class="ce-type ct-${c.type}">${TYPE_LABEL[c.type]||c.type}</span>
            <span class="ce-ts">${c.timeStr||''}</span>
          </div>
          <div class="ce-txt">${esc(c.text).replace(/\n/g,'<br>')}</div>
        </div>
        <button onclick="openEditComm(${c.id})" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:.8rem;padding:2px 5px" title="Edit">Edit</button>
        <button class="del-ce" onclick="deleteComm(${c.id})">✕</button>
      </div>`).join('');
    return `<div style="margin-bottom:4px"><div style="font-size:.66rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;padding:4px 0 5px">${dl}</div>${entries}</div>`;
  }).join('');
}
function addComm(){
  const company=document.getElementById('cf-company').value.trim();
  const type=document.getElementById('cf-type').value;
  const text=document.getElementById('cf-text').value.trim();
  const date=document.getElementById('cf-date').value;
  if(!text){document.getElementById('cf-text').style.borderColor='#dc2626';setTimeout(()=>document.getElementById('cf-text').style.borderColor='',1200);return}
  if(editingCommId!==null){
    const idx=comms.findIndex(c=>c.id===editingCommId);
    if(idx>=0)comms[idx]={...comms[idx],company,type,text,date};
    editingCommId=null;
    document.getElementById('comm-edit-banner').style.display='none';
    document.getElementById('comm-save-btn').textContent='+ Log Activity';
  } else {
    const now=new Date();
    comms.push({id:Date.now(),company,type,text,date,ts:now.getTime(),timeStr:now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})});
  }
  saveComms();document.getElementById('cf-company').value='';document.getElementById('cf-text').value='';renderWeekly();
}
function openEditComm(id){
  const c=comms.find(e=>e.id===id);if(!c)return;
  editingCommId=id;
  document.getElementById('cf-company').value=c.company||'';
  document.getElementById('cf-type').value=c.type||'call';
  document.getElementById('cf-text').value=c.text||'';
  document.getElementById('cf-date').value=c.date||'';
  document.getElementById('comm-edit-banner').style.display='flex';
  document.getElementById('comm-save-btn').textContent='✓ Save Changes';
  document.getElementById('cf-text').focus();
  document.querySelector('#panel-weekly .comm-form').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function cancelCommEdit(){
  editingCommId=null;
  document.getElementById('cf-company').value='';
  document.getElementById('cf-text').value='';
  document.getElementById('comm-edit-banner').style.display='none';
  document.getElementById('comm-save-btn').textContent='+ Log Activity';
}
function deleteComm(id){comms=comms.filter(c=>c.id!==id);if(editingCommId===id)cancelCommEdit();saveComms();renderWeekly()}

// POTENTIAL LEADS
let editingLeadIdx=-1;
let leadSortCol='status',leadSortDir=1,leadPage=1;
const LEAD_STAGE_ORDER={'New':0,'Researching':1,'Ready to Contact':2,'Passed':3};
const LEAD_STATUS_BC={'New':'b-l0','Researching':'b-2','Ready to Contact':'b-c','Passed':'b-r'};
let activeLead=null;

function openAddLead(idx){
  editingLeadIdx=idx!==undefined?idx:-1;
  const lead=idx!==undefined?potentialLeads[idx]:null;
  document.getElementById('lead-modal-title').textContent=lead?'Edit Lead':'Add Potential Lead';
  document.getElementById('lead-name').value=lead?lead.name:'';
  document.getElementById('lead-country').value=lead?lead.country:'';
  document.getElementById('lead-contact').value=lead?lead.contact:'';
  document.getElementById('lead-source').value=lead?lead.source:'';
  document.getElementById('lead-status').value=lead?lead.status:'New';
  document.getElementById('lead-mgmt').value=lead?(lead.mgmt||''):'';
  document.getElementById('lead-notes').value=lead?lead.notes:'';
  document.getElementById('lead-delete-btn').style.display=lead?'block':'none';
  document.getElementById('lead-modal').classList.add('open');
  setTimeout(()=>document.getElementById('lead-name').focus(),50);
}
function closeLeadModal(){document.getElementById('lead-modal').classList.remove('open')}
function saveLead(){
  const name=document.getElementById('lead-name').value.trim();
  if(!name){document.getElementById('lead-name').style.borderColor='#dc2626';setTimeout(()=>document.getElementById('lead-name').style.borderColor='',1200);return}
  const entry={
    id:editingLeadIdx>=0?potentialLeads[editingLeadIdx].id:Date.now(),
    name,country:document.getElementById('lead-country').value.trim(),
    contact:document.getElementById('lead-contact').value.trim(),
    source:document.getElementById('lead-source').value.trim(),
    status:document.getElementById('lead-status').value,
    mgmt:document.getElementById('lead-mgmt').value,
    notes:document.getElementById('lead-notes').value.trim(),
    added:editingLeadIdx>=0?potentialLeads[editingLeadIdx].added:new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
  };
  if(editingLeadIdx>=0)potentialLeads[editingLeadIdx]=entry;
  else potentialLeads.unshift(entry);
  saveLeads();closeLeadModal();populateLeadFilters();renderLeads();
}
function deleteLead(){
  if(editingLeadIdx>=0){potentialLeads.splice(editingLeadIdx,1);saveLeads();closeLeadModal();populateLeadFilters();renderLeads()}
}
let confirmLeadIdx=null;
function openConfirmContact(leadIdx){
  confirmLeadIdx=leadIdx;
  const lead=potentialLeads[leadIdx];
  document.getElementById('confirm-modal-title').textContent='Confirm Contact — '+lead.name;
  document.getElementById('confirm-notes').value='';
  document.getElementById('confirm-method').value='Email';
  document.getElementById('confirm-stage').value='Email Outreach';
  document.getElementById('confirm-modal').style.display='flex';
  setTimeout(()=>document.getElementById('confirm-notes').focus(),50);
}
function closeConfirmModal(){document.getElementById('confirm-modal').style.display='none'}
function saveConfirmContact(){
  const lead=potentialLeads[confirmLeadIdx];
  const method=document.getElementById('confirm-method').value;
  const stage=document.getElementById('confirm-stage').value;
  const noteText=document.getElementById('confirm-notes').value.trim();
  // Promote lead to pipeline as custom company
  const entry={
    company:lead.name,country:lead.country||'',mgmt:lead.mgmt||'',
    stage:stage,month:new Date().toLocaleString('default',{month:'short',year:'numeric'}),
    status_detail:method+' contact confirmed',is_retarget:false,
    added:new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
  };
  customCompanies.unshift(entry);
  localStorage.setItem('ns_custom_cos',JSON.stringify(customCompanies));
  // Mark lead as passed
  lead.status='Passed';
  saveLeads();
  // Save note
  const nk=lead.name.toLowerCase().trim();
  const existing=(Array.isArray(notes[nk])?notes[nk].map(e=>e.text).join(' | '):notes[nk]||'');
  notes[nk]=(existing?existing+'\n':'')+method+' — '+new Date().toLocaleDateString('en-GB')+': '+(noteText||'Contacted');
  saveNotes();
  closeConfirmModal();
  applyFilters();
}
function promoteLeadToPipeline(idx){
  const lead=potentialLeads[idx];
  lead.status='Passed';saveLeads();renderLeads();
  openAddCompany(lead.name);
  document.getElementById('co-country').value=lead.country||'';
  document.getElementById('co-mgmt').value=lead.mgmt||'';
  if(lead.notes){const _pk=lead.name.toLowerCase().trim();if(!notes[_pk])notes[_pk]=[];if(typeof notes[_pk]==='string')notes[_pk]=[{text:notes[_pk],ts:null}];notes[_pk].push({text:lead.notes,ts:null});}
  saveNotes();
}

function populateLeadFilters(){
  const countries=[...new Set(potentialLeads.map(l=>l.country).filter(Boolean))].sort();
  const sel=document.getElementById('lead-country-filter');
  while(sel.options.length>1)sel.remove(1);
  countries.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o)});
}

function sortLeads(col){
  if(leadSortCol===col)leadSortDir*=-1;else{leadSortCol=col;leadSortDir=1}
  renderLeads();
}

function changeLeadPage(dir){leadPage+=dir;renderLeads();document.querySelector('#panel-leads .scroll').scrollTop=0}
function clearLeadFilters(){document.getElementById('lead-search').value='';document.getElementById('lead-status-filter').value='';document.getElementById('lead-country-filter').value='';renderLeads()}

// Lead stage dropdown
function openLeadStageDrop(event,idx){
  event.stopPropagation();
  activeLead=idx;
  const drop=document.getElementById('lead-stage-drop');
  const rect=event.target.getBoundingClientRect();
  let top=rect.bottom+4,left=rect.left;
  if(left+185>window.innerWidth)left=window.innerWidth-190;
  if(top+160>window.innerHeight)top=rect.top-165;
  drop.style.top=top+'px';drop.style.left=left+'px';
  const cur=potentialLeads[idx]?potentialLeads[idx].status:'';
  drop.querySelectorAll('.sd-item').forEach(item=>{
    const m=item.getAttribute('onclick').match('\'([^\']+)\'');
    item.classList.toggle('current',m&&m[1]===cur);
  });
  drop.classList.add('open');
}
function setLeadStage(stage){
  if(activeLead!==null&&potentialLeads[activeLead]){
    potentialLeads[activeLead].status=stage;
    saveLeads();
  }
  document.getElementById('lead-stage-drop').classList.remove('open');
  renderLeads();
}
document.addEventListener('click',e=>{
  const drop=document.getElementById('lead-stage-drop');
  if(drop&&drop.classList.contains('open')&&!drop.contains(e.target))drop.classList.remove('open');
});

function renderLeads(){
  const q=document.getElementById('lead-search').value.toLowerCase();
  const sf=document.getElementById('lead-status-filter').value;
  const cf=document.getElementById('lead-country-filter').value;

  let leads=potentialLeads.map((l,i)=>({...l,_idx:i})).filter(l=>{
    if(sf&&l.status!==sf)return false;
    if(cf&&l.country!==cf)return false;
    if(q&&!l.name.toLowerCase().includes(q)&&!(l.country||'').toLowerCase().includes(q)&&!(l.contact||'').toLowerCase().includes(q)&&!(l.notes||'').toLowerCase().includes(q))return false;
    return true;
  });

  leads.sort((a,b)=>{
    let av=leadSortCol==='status'?LEAD_STAGE_ORDER[a.status]??99:a[leadSortCol]||'';
    let bv=leadSortCol==='status'?LEAD_STAGE_ORDER[b.status]??99:b[leadSortCol]||'';
    if(leadSortCol==='status')return(av-bv)*leadSortDir;
    return av.toString().localeCompare(bv.toString())*leadSortDir;
  });

  // KPIs (always off full list)
  document.getElementById('lk-total').textContent=potentialLeads.length;
  document.getElementById('lk-new').textContent=potentialLeads.filter(l=>l.status==='New').length;
  document.getElementById('lk-res').textContent=potentialLeads.filter(l=>l.status==='Researching').length;
  document.getElementById('lk-ready').textContent=potentialLeads.filter(l=>l.status==='Ready to Contact').length;
  document.getElementById('lk-passed').textContent=potentialLeads.filter(l=>l.status==='Passed').length;

  const tbody=document.getElementById('lead-tbody');
  const nores=document.getElementById('lead-nores');

  if(!leads.length){
    tbody.innerHTML='';
    nores.style.display='block';
    nores.textContent=potentialLeads.length?'No leads match your filters':'No potential leads yet — click + Add Lead to get started';
    document.getElementById('lead-pinfo').textContent='0 leads';
    document.getElementById('lead-pprev').disabled=true;
    document.getElementById('lead-pnext').disabled=true;
    return;
  }
  nores.style.display='none';

  const start=(leadPage-1)*PER_PAGE,slice=leads.slice(start,start+PER_PAGE);
  tbody.innerHTML=slice.map(l=>{
    const sc=LEAD_STATUS_BC[l.status]||'b-l0';
    const isPassed=l.status==='Passed';
    const notePreview=l.notes?`<div class="nprev" title="${esc(l.notes)}">${esc(l.notes)}</div>`:'—';
    return `<tr>
      <td><span class="cn">${esc(l.name)}</span><br><span style="font-size:.63rem;color:#64748b">Added ${esc(l.added||'')}</span></td>
      <td style="color:#64748b;font-size:.71rem">${esc(l.country||'—')}</td>
      <td style="font-size:.71rem;color:#334155">${esc(l.contact||'—')}</td>
      <td style="font-size:.71rem;color:#64748b">${esc(l.source||'—')}</td>
      <td><span class="badge ${sc} editable" onclick="openLeadStageDrop(event,${l._idx})">${esc(l.status)}</span></td>
      <td>${notePreview}</td>
      <td style="white-space:nowrap">
        ${!isPassed?`<button onclick="promoteLeadToPipeline(${l._idx})" style="background:#008E9C;border:none;color:#fff;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:.65rem;font-weight:600;margin-right:4px">→ Pipeline</button>`:'<span style="font-size:.65rem;color:#16a34a;margin-right:6px">✓ Added</span>'}
        <button onclick="openAddLead(${l._idx})" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#64748b;padding:3px 7px;border-radius:5px;cursor:pointer;font-size:.65rem">Edit</button>
      </td>
    </tr>`;
  }).join('');

  const total=leads.length,end=Math.min(start+PER_PAGE,total);
  document.getElementById('lead-pinfo').textContent=`Showing ${start+1}–${end} of ${total} leads`;
  document.getElementById('lead-pprev').disabled=leadPage===1;
  document.getElementById('lead-pnext').disabled=end>=total;
}

['search','fm','fs','fc','fg'].forEach(id=>{
  document.getElementById(id).addEventListener('input',applyFilters);
  document.getElementById(id).addEventListener('change',applyFilters);
});

function exportData(){
  const xe=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const cell=v=>'<Cell><Data ss:Type="'+(typeof v==='number'?'Number':'String')+'">'+xe(v)+'</Data></Cell>';
  const sheet=(name,headers,rows)=>
    '<Worksheet ss:Name="'+xe(name)+'"><Table>'+
    '<Row>'+headers.map(h=>'<Cell ss:StyleID="hdr"><Data ss:Type="String">'+xe(h)+'</Data></Cell>').join('')+'</Row>'+
    rows.map(r=>'<Row>'+r.map(cell).join('')+'</Row>').join('')+
    '</Table></Worksheet>';

  // Pipeline: one row per company (highest stage), with all details
  const all=getAllCompanies();
  const seen={};
  const SP={'Meeting / Positive':6,'Call':5,'Retargeted':4,'Not Interested':3,'Email Outreach':2,'Prospected':1};
  const monthsByNk={};
  all.forEach(r=>{
    const nk=r.company.toLowerCase().trim();
    if(!monthsByNk[nk])monthsByNk[nk]=new Set();
    if(r.month)monthsByNk[nk].add(r.month);
    if(!seen[nk])seen[nk]={...r};
    else{
      const cur=SP[getStage(seen[nk])]||0,nw=SP[getStage(r)]||0;
      if(nw>cur)seen[nk]={...r};
    }
  });
  const pipelineRows=Object.values(seen)
    .sort((a,b)=>a.company.localeCompare(b.company))
    .map(r=>{
      const nk=r.company.toLowerCase().trim();
      const allMonths=[...new Set([...(monthsByNk[nk]||[]),...(extraMonths[nk]||[])])].filter(Boolean).join(', ');
      const noteArr=Array.isArray(notes[nk])?notes[nk].map(e=>e.text):(notes[nk]?[notes[nk]]:[]);
      return [
        r.company,
        getField(r,'country')||'',
        getField(r,'mgmt_type')||'',
        allMonths,
        getStage(r),
        isCall(nk)?'Yes':'No',
        r._follow_up||followUps[nk]||'',
        lastContactedDate(nk)||'',
        r._contact_name||'',
        r._contact_email||'',
        r._contact_phone||'',
        noteArr.join(' | ')
      ];
    });

  const leadRows=potentialLeads.map(l=>[
    l.name||'',l.country||'',l.contact||'',l.source||'',
    l.status||'',l.mgmt||'',l.notes||'',l.added||''
  ]);

  const contactRows=[];
  Object.keys(contacts).sort().forEach(nk=>{
    (contacts[nk]||[]).forEach(c=>{
      contactRows.push([nk,c.name||'',c.title||'',c.email||'',c.phone||'']);
    });
  });

  const activityRows=comms
    .slice()
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''))
    .map(c=>[c.date||'',c.timeStr||'',c.company||'',c.type||'',c.text||'']);

  const xml='<?xml version="1.0"?>'+
    '<?mso-application progid="Excel.Sheet"?>'+
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+
    '<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/></Style></Styles>'+
    sheet('Pipeline',['Company','Country','Type','Months','Stage','Called','Follow-up Date','Last Contacted','Contact Name','Contact Email','Contact Phone','Notes'],pipelineRows)+
    sheet('Potential Leads',['Company','Country','Contact','Source','Status','Management Type','Notes','Added'],leadRows)+
    sheet('Contacts',['Company','Name','Title','Email','Phone'],contactRows)+
    sheet('Activities',['Date','Time','Company','Type','Details'],activityRows)+
    '</Workbook>';

  const blob=new Blob([xml],{type:'application/vnd.ms-excel'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='Nautilus_BD_Export_'+new Date().toISOString().slice(0,10)+'.xls';
  a.click();
}
function importData(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const backup=JSON.parse(ev.target.result);
      Object.keys(backup).forEach(k=>localStorage.setItem(k,backup[k]));
      // Reload all state from localStorage
      stageOverrides=JSON.parse(localStorage.getItem('ns_stages')||'{}');
      Object.keys(stageOverrides).forEach(k=>{if(stageOverrides[k]==='2nd Round')stageOverrides[k]='Retargeted'});
      notes=JSON.parse(localStorage.getItem('ns_notes')||'{}');
      communications=JSON.parse(localStorage.getItem('ns_comms')||'[]');
      customCompanies=JSON.parse(localStorage.getItem('ns_custom_cos')||'[]');
      potentialLeads=JSON.parse(localStorage.getItem('ns_leads')||'[]');
      followUps=JSON.parse(localStorage.getItem('ns_followups')||'{}');
      contacts=JSON.parse(localStorage.getItem('ns_contacts')||'{}');
      fieldEdits=JSON.parse(localStorage.getItem('ns_field_edits')||'{}');
      calls=JSON.parse(localStorage.getItem('ns_calls')||'{}');
      deletedCos=JSON.parse(localStorage.getItem('ns_deleted')||'{}');
      extraMonths=JSON.parse(localStorage.getItem('ns_extra_months')||'{}');
      populate();applyFilters();
      alert('✅ Data restored successfully! Your pipeline edits are back.');
    }catch(err){alert('❌ Import failed — make sure you selected the correct backup .json file.');}
  };
  reader.readAsText(file);
  e.target.value='';
}

(async function initFromApi() {
  const [companies] = await Promise.all([loadCompaniesFromApi(), loadLookups()]);
  RAW_BASE = companies;
  await Promise.all([loadFollowUpsFromApi(), loadNotesFromApi(), loadCallActivitiesFromApi(), loadContactsFromApi()]);
  populate();
  applyFilters();
  renderDashboardCharts();
})();
const cfDate=document.getElementById('cf-date');
if(cfDate)cfDate.value=new Date().toISOString().slice(0,10);

window.exportData=exportData;
window.globalSearch=globalSearch;
