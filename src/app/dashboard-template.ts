export const dashboardHtml = `
<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-brand">
      <img class="brand-logo" src="/nautilus-logo.png" alt="Nautilus Shipping" />
      <div class="brand-sub">Business Development</div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-item active" data-tab="dashboard" onclick="switchTab('dashboard')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Dashboard
      </div>
      <div class="nav-item" data-tab="pipeline" onclick="switchTab('pipeline')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        Pipeline
      </div>
      <div class="nav-item" data-tab="weekly" onclick="switchTab('weekly')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Weekly Tracker
      </div>
      <div class="nav-item" data-tab="leads" onclick="switchTab('leads')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        Potential Leads
      </div>
      <div class="nav-item" data-tab="analytics" onclick="switchTab('analytics')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        Analytics
      </div>
      <div class="nav-item" data-tab="contacts" onclick="switchTab('contacts')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Contacts
      </div>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="user-avatar">J</div>
        <div class="user-info">
          <div class="user-name">Jerry</div>
          <div class="user-role">BD Manager</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </div>
  </aside>

  <div class="main-area">
    <header class="topbar">
      <div class="topbar-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="global-search" placeholder="Search companies, notes..." oninput="globalSearch(this.value)">
      </div>
      <div class="topbar-actions">
        <button class="topbar-btn" onclick="exportData()" title="Export to Excel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <div class="topbar-avatar">J</div>
      </div>
    </header>

    <div class="main-content" id="main-content">

<!-- ===== DASHBOARD / PIPELINE ===== -->
<div class="panel active" id="panel-dashboard">
  <div class="page-hero dashboard-only">
    <div>
      <h2 class="greeting" id="greeting">Good Afternoon, Jerry 👋</h2>
      <p class="greeting-sub">Here's what's happening with your pipeline today.</p>
    </div>
    <div class="hdate" id="hdate"></div>
  </div>

  <div class="kpi-bar">
    <div class="kpi clickable" onclick="kpiClick('')" id="kpi-total">
      <div class="kpi-icon blue">👥</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Total Companies</span><span class="kpi-trend up" id="t-total"></span></div>
        <div class="num" id="k-total">—</div>
      </div>
    </div>
    <div class="kpi orange clickable" onclick="kpiClick('Retargeted')" id="kpi-ret">
      <div class="kpi-icon orange">🎯</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Retargeted</span><span class="kpi-trend down" id="t-ret"></span></div>
        <div class="num" id="k-ret">—</div>
      </div>
    </div>
    <div class="kpi amber clickable" onclick="kpiClick('Call')" id="kpi-call">
      <div class="kpi-icon amber">📞</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Calls</span><span class="kpi-trend down" id="t-call"></span></div>
        <div class="num" id="k-call">—</div>
      </div>
    </div>
    <div class="kpi green clickable" onclick="kpiClick('Meeting / Positive')" id="kpi-pos">
      <div class="kpi-icon green">📅</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Meetings / Positive</span><span class="kpi-trend up" id="t-pos"></span></div>
        <div class="num" id="k-pos">—</div>
      </div>
    </div>
    <div class="kpi purple clickable" onclick="kpiClick('Not Interested')" id="kpi-neg">
      <div class="kpi-icon purple">👎</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Not Interested</span><span class="kpi-trend up" id="t-neg"></span></div>
        <div class="num" id="k-neg">—</div>
      </div>
    </div>
    <div class="kpi red2 clickable" onclick="kpiClick('__overdue__')" id="kpi-od">
      <div class="kpi-icon red">⏰</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Overdue Follow-up</span><span class="kpi-trend down" id="t-od"></span></div>
        <div class="num" id="k-od">—</div>
      </div>
    </div>
  </div>

  <div class="charts-grid dashboard-only">
    <div class="chart-card">
      <div class="chart-title">Pipeline Trend</div>
      <div id="chart-trend" class="chart-body"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Stage Distribution</div>
      <div id="chart-donut" class="chart-body chart-donut-wrap"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Monthly Activity</div>
      <div id="chart-monthly" class="chart-body"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Top Countries</div>
      <div id="chart-countries" class="chart-body"></div>
    </div>
  </div>

  <div class="table-section">
    <div class="ctrl">
      <div class="search-field">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="search" placeholder="Search companies, notes...">
      </div>
      <select id="fm"><option value="">All Months</option></select>
      <select id="fs"><option value="">All Stages</option></select>
      <select id="fc"><option value="">All Countries</option></select>
      <select id="fg"><option value="">All Types</option></select>
      <button class="cbtn" onclick="clearFilters()">✕ Clear Filters</button>
      <button class="add-co-btn" onclick="openAddCompany()">+ Add Company</button>
    </div>
    <div class="scroll" id="pipeline-scroll">
      <table>
        <thead><tr>
          <th onclick="sortBy('company')">Company ↕</th>
          <th onclick="sortBy('country')">Country ↕</th>
          <th onclick="sortBy('mgmt_type')">Type ↕</th>
          <th onclick="sortBy('month')">Month ↕</th>
          <th onclick="sortBy('stage')">Stage ↕ <span class="th-hint">▾ click to edit</span></th>
          <th>Call</th>
          <th onclick="sortBy('_follow_up')">Follow-up ↕</th>
          <th>Notes</th>
          <th>Actions</th>
        </tr></thead>
        <tbody id="tbody"></tbody>
      </table>
      <div class="nores" id="nores" style="display:none">No companies match your filters</div>
    </div>
    <div class="pgn">
      <span id="pinfo">—</span>
      <div class="pbtns" id="page-btns">
        <button class="pb" id="pprev" onclick="changePage(-1)">← Prev</button>
        <button class="pb" id="pnext" onclick="changePage(1)">Next →</button>
      </div>
    </div>
  </div>
</div>

<!-- ===== WEEKLY TRACKER ===== -->
<div class="panel" id="panel-weekly">
  <div class="page-hero">
    <div><h2 class="greeting">Weekly Tracker</h2><p class="greeting-sub">Log and review your outreach activities</p></div>
  </div>
  <div class="week-nav">
    <button class="wk-btn" onclick="switchTab('dashboard')" style="background:var(--accent);border-color:var(--accent);color:#fff">← Dashboard</button>
    <button class="wk-btn" onclick="changeWeek(-1)">← Prev Week</button>
    <div class="wk-title" id="wk-label">Week of ...</div>
    <button class="wk-btn" onclick="changeWeek(1)">Next Week →</button>
    <button class="wk-today" onclick="goToday()">This Week</button>
  </div>
  <div class="wk-kpis">
    <div class="wk-kpi call"><div class="ik">📞</div><div><div class="cnt" id="wk-calls">0</div><div class="nm">Calls</div></div></div>
    <div class="wk-kpi email"><div class="ik">📧</div><div><div class="cnt" id="wk-emails">0</div><div class="nm">Emails</div></div></div>
    <div class="wk-kpi wa"><div class="ik">💬</div><div><div class="cnt" id="wk-wa">0</div><div class="nm">WhatsApp</div></div></div>
    <div class="wk-kpi li"><div class="ik">🔗</div><div><div class="cnt" id="wk-li">0</div><div class="nm">LinkedIn</div></div></div>
    <div class="wk-kpi"><div class="ik">🏢</div><div><div class="cnt" id="wk-cos" style="color:#e6edf3">0</div><div class="nm">Companies</div></div></div>
  </div>
  <div class="comm-form">
    <div id="comm-edit-banner" style="display:none;background:#1a2940;border:1px solid var(--accent);border-radius:6px;padding:6px 10px;margin-bottom:6px;font-size:.74rem;color:#58a6ff;display:none;align-items:center;justify-content:space-between">
      <span>✏️ Editing entry</span><button onclick="cancelCommEdit()" style="background:none;border:none;color:#8b949e;cursor:pointer;font-size:.8rem">✕ Cancel</button>
    </div>
    <div class="cf-row">
      <input class="cf-co" type="text" id="cf-company" placeholder="Company name..." list="co-list">
      <datalist id="co-list"></datalist>
      <select class="cf-type" id="cf-type">
        <option value="call">📞 Call</option>
        <option value="email">📧 Email</option>
        <option value="whatsapp">💬 WhatsApp</option>
        <option value="linkedin">🔗 LinkedIn</option>
        <option value="follow-up">🔁 Follow-up</option>
      </select>
      <input type="date" id="cf-date">
    </div>
    <textarea class="cf-ta" id="cf-text" placeholder="What happened? Outcome, next steps..."></textarea>
    <div class="cf-footer"><button class="addbtn" id="comm-save-btn" onclick="addComm()">+ Log Activity</button></div>
  </div>
  <div class="comm-list" id="comm-list"><div class="comm-empty">No activities logged this week yet — add one above</div></div>
</div>

<!-- ===== POTENTIAL LEADS ===== -->
<div class="panel" id="panel-leads">
  <div class="page-hero">
    <div><h2 class="greeting">Potential Leads</h2><p class="greeting-sub">Research and qualify new opportunities</p></div>
  </div>
  <div class="kpi-bar" id="lead-kpi-bar">
    <div class="kpi"><div class="kpi-body"><div class="lbl">Total Leads</div><div class="num" id="lk-total">0</div></div></div>
    <div class="kpi"><div class="kpi-body"><div class="lbl">New</div><div class="num" id="lk-new" style="color:#8b949e">0</div></div></div>
    <div class="kpi purple"><div class="kpi-body"><div class="lbl">Researching</div><div class="num" id="lk-res">0</div></div></div>
    <div class="kpi green"><div class="kpi-body"><div class="lbl">Ready to Contact</div><div class="num" id="lk-ready">0</div></div></div>
    <div class="kpi amber"><div class="kpi-body"><div class="lbl">Added to Pipeline</div><div class="num" id="lk-passed">0</div></div></div>
  </div>
  <div class="ctrl">
    <div class="search-field">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="lead-search" placeholder="Search companies, notes..." oninput="renderLeads()">
    </div>
    <select id="lead-status-filter" onchange="renderLeads()">
      <option value="">All Stages</option>
      <option value="New">New</option>
      <option value="Researching">Researching</option>
      <option value="Ready to Contact">Ready to Contact</option>
      <option value="Passed">Added to Pipeline</option>
    </select>
    <select id="lead-country-filter" onchange="renderLeads()"><option value="">All Countries</option></select>
    <button class="cbtn" onclick="clearLeadFilters()">✕ Clear</button>
    <button class="add-co-btn" onclick="openAddLead()">+ Add Lead</button>
  </div>
  <div class="scroll">
    <table>
      <thead><tr>
        <th onclick="sortLeads('name')">Company ↕</th>
        <th onclick="sortLeads('country')">Country ↕</th>
        <th onclick="sortLeads('contact')">Contact ↕</th>
        <th onclick="sortLeads('source')">Source ↕</th>
        <th onclick="sortLeads('status')">Stage ↕</th>
        <th>Notes</th>
        <th>Action</th>
      </tr></thead>
      <tbody id="lead-tbody"></tbody>
    </table>
    <div class="nores" id="lead-nores" style="display:none">No leads match your filters</div>
  </div>
  <div class="pgn">
    <span id="lead-pinfo">—</span>
    <div class="pbtns">
      <button class="pb" id="lead-pprev" onclick="changeLeadPage(-1)">← Prev</button>
      <button class="pb" id="lead-pnext" onclick="changeLeadPage(1)">Next →</button>
    </div>
  </div>
</div>

<!-- ===== ANALYTICS ===== -->
<div class="panel" id="panel-analytics">
  <div class="page-hero">
    <div><h2 class="greeting">Analytics</h2><p class="greeting-sub">Deep dive into pipeline metrics</p></div>
  </div>
  <div class="analytics-grid">
    <div class="chart-card"><div class="chart-title">Pipeline by Stage</div><div id="chart-stage"></div></div>
    <div class="chart-card"><div class="chart-title">Top Countries</div><div id="chart-country"></div></div>
    <div class="chart-card"><div class="chart-title">Management Type</div><div id="chart-mgmt"></div></div>
    <div class="chart-card"><div class="chart-title">Activity by Month (BD Outreach)</div><div id="chart-month"></div></div>
  </div>
</div>

<!-- ===== CONTACTS ===== -->
<div class="panel" id="panel-contacts">
  <div class="page-hero">
    <div><h2 class="greeting">Contacts</h2><p class="greeting-sub">Manage company contact information</p></div>
  </div>
  <div class="ctrl">
    <div class="search-field">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="ct-search" placeholder="Search companies, notes..." oninput="renderContactsTab()">
    </div>
    <select id="ct-has-filter" onchange="renderContactsTab()">
      <option value="">All Companies</option>
      <option value="yes">Has Contacts</option>
      <option value="no">No Contacts Yet</option>
    </select>
    <button class="cbtn" onclick="document.getElementById('ct-search').value='';document.getElementById('ct-has-filter').value='';renderContactsTab()">✕ Clear</button>
  </div>
  <div class="scroll">
    <table>
      <thead><tr>
        <th>Company</th><th>Country</th><th>Stage</th><th>Contact Name</th><th>Title</th><th>Email</th><th>Phone</th><th>Action</th>
      </tr></thead>
      <tbody id="ct-tbody"></tbody>
    </table>
    <div class="nores" id="ct-nores" style="display:none">No results</div>
  </div>
  <div class="pgn">
    <span id="ct-pinfo">—</span>
    <div class="pbtns">
      <button class="pb" id="ct-pprev" onclick="changeCtPage(-1)">← Prev</button>
      <button class="pb" id="ct-ppnext" onclick="changeCtPage(1)">Next →</button>
    </div>
  </div>
</div>

    </div><!-- /main-content -->
  </div><!-- /main-area -->
</div><!-- /app-shell -->

<!-- LEAD STAGE DROPDOWN -->
<div id="lead-stage-drop" class="stage-drop">
  <div class="sd-hint">Change Stage</div>
  <div class="sd-item" onclick="setLeadStage('New')"><div class="sd-dot" style="background:#8b949e"></div>New</div>
  <div class="sd-item" onclick="setLeadStage('Researching')"><div class="sd-dot" style="background:#bc8cff"></div>Researching</div>
  <div class="sd-item" onclick="setLeadStage('Ready to Contact')"><div class="sd-dot" style="background:#3fb950"></div>Ready to Contact</div>
  <div class="sd-item" onclick="setLeadStage('Passed')"><div class="sd-dot" style="background:#e3b341"></div>Added to Pipeline</div>
</div>

<!-- STAGE DROPDOWN -->
<div id="stage-drop" class="stage-drop">
  <div class="sd-hint">Change Stage</div>
  <div class="sd-item" onclick="setStage('Email Outreach')"><div class="sd-dot" style="background:#58a6ff"></div>Email Outreach</div>
  <div class="sd-item" onclick="setStage('Retargeted')"><div class="sd-dot" style="background:#e3b341"></div>Retargeted</div>
  <div class="sd-item" onclick="setStage('Meeting / Positive')"><div class="sd-dot" style="background:#2ea043"></div>Meeting / Positive</div>
  <div class="sd-item" onclick="setStage('Not Interested')"><div class="sd-dot" style="background:#f85149"></div>Not Interested</div>
</div>

<!-- ADD/EDIT COMPANY MODAL -->
<div class="overlay" id="co-modal">
  <div class="modal">
    <h3 id="co-modal-title">Add Company to Pipeline</h3>
    <div class="mrow"><div class="half"><div class="mlbl">Company Name *</div><input type="text" id="co-name" placeholder="e.g. Maersk Line"></div><div class="half"><div class="mlbl">Country</div><input type="text" id="co-country" placeholder="e.g. Denmark"></div></div>
    <div class="mrow"><div class="half"><div class="mlbl">Management Type</div><select id="co-mgmt"><option value="">—</option><option value="Inhouse">Inhouse</option><option value="Outsourced">Outsourced</option><option value="Both">Both</option><option value="Unsure">Unsure</option></select></div><div class="half"><div class="mlbl">Stage</div><select id="co-stage"><option value="Email Outreach">Email Outreach</option><option value="Retargeted">Retargeted</option><option value="Call">Call</option><option value="Meeting / Positive">Meeting / Positive</option><option value="Not Interested">Not Interested</option><option value="Prospected">Prospected</option></select></div></div>
    <div class="mrow"><div class="half"><div class="mlbl">Month</div><select id="co-month"><option value="Jul 2026">Jul 2026</option><option value="Jun 2026">Jun 2026</option><option value="May 2026">May 2026</option><option value="Apr 2026">Apr 2026</option><option value="Mar 2026">Mar 2026</option><option value="Feb 2026">Feb 2026</option><option value="Jan 2026">Jan 2026</option></select></div><div class="half"><div class="mlbl">Status Detail</div><input type="text" id="co-status" placeholder="e.g. Email Outreach sent"></div></div>
    <div class="mrow"><div class="half"><div class="mlbl">Contact Person Name</div><input type="text" id="co-contact-name" placeholder="e.g. John Smith"></div><div class="half"><div class="mlbl">Contact Email</div><input type="email" id="co-contact-email" placeholder="e.g. john@company.com"></div></div>
    <div class="mrow"><div class="half"><div class="mlbl">Contact Phone</div><input type="text" id="co-contact-phone" placeholder="e.g. +1 555 000 0000"></div><div class="half"><div class="mlbl">Follow-up Date</div><input type="date" id="co-followup"></div></div>
    <div class="mrow"><div style="width:100%"><div class="mlbl">Notes</div><textarea id="co-notes" placeholder="Any notes about this company..."></textarea></div></div>
    <div class="mbtns">
      <button class="bcancel" onclick="closeCoModal()">Cancel</button>
      <button class="bsave" onclick="saveCompany()">Save</button>
    </div>
  </div>
</div>

<!-- ADD/EDIT LEAD MODAL -->
<div class="overlay" id="lead-modal">
  <div class="modal">
    <h3 id="lead-modal-title">Add Potential Lead</h3>
    <div class="mrow"><div class="half"><div class="mlbl">Company Name *</div><input type="text" id="lead-name" placeholder="e.g. Pacific Carriers"></div><div class="half"><div class="mlbl">Country</div><input type="text" id="lead-country" placeholder="e.g. Singapore"></div></div>
    <div class="mrow"><div class="half"><div class="mlbl">Contact Person</div><input type="text" id="lead-contact" placeholder="e.g. John Smith, CEO"></div><div class="half"><div class="mlbl">Status</div><select id="lead-status"><option value="New">New</option><option value="Researching">Researching</option><option value="Ready to Contact">Ready to Contact</option></select></div></div>
    <div class="mrow"><div class="half"><div class="mlbl">Source</div><input type="text" id="lead-source" placeholder="e.g. LinkedIn, Event, Referral"></div><div class="half"><div class="mlbl">Management Type</div><select id="lead-mgmt"><option value="">—</option><option value="Inhouse">Inhouse</option><option value="Outsourced">Outsourced</option></select></div></div>
    <div class="mrow"><div style="width:100%"><div class="mlbl">Why this lead? Notes</div><textarea id="lead-notes" placeholder="Why are they a potential lead?..."></textarea></div></div>
    <div class="mbtns">
      <button class="bdanger" id="lead-delete-btn" style="display:none" onclick="deleteLead()">Delete</button>
      <button class="bcancel" onclick="closeLeadModal()">Cancel</button>
      <button class="bsave" onclick="saveLead()">Save Lead</button>
    </div>
  </div>
</div>

<!-- NOTE MODAL -->
<div class="overlay" id="note-modal">
  <div class="modal" style="width:500px">
    <div class="modal-header">
      <div><div id="modal-co" class="modal-title"></div><div id="modal-sub" style="font-size:.72rem;color:#8b949e"></div></div>
      <button class="modal-close" onclick="closeNote()">✕</button>
    </div>
    <div id="note-history" style="max-height:260px;overflow-y:auto;margin-bottom:12px;display:flex;flex-direction:column;gap:8px"></div>
    <div style="border-top:1px solid #21262d;padding-top:12px">
      <div style="font-size:.7rem;color:#8b949e;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Add New Note</div>
      <textarea id="note-text" placeholder="Type your note..." style="min-height:70px"></textarea>
      <div class="mbtns">
        <button class="bcancel" onclick="closeNote()">Close</button>
        <button class="bsave" onclick="saveNote()">+ Add Note</button>
      </div>
    </div>
  </div>
</div>

<!-- FIELD EDIT POPOVER -->
<div id="field-edit-pop" style="display:none;position:fixed;z-index:9999;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,.6);min-width:200px">
  <div id="field-edit-label" style="font-size:.68rem;color:#8b949e;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em"></div>
  <input id="field-edit-inp" type="text" style="background:#0d1117;border:1px solid #30363d;color:#e6edf3;border-radius:6px;padding:5px 8px;font-size:.76rem;width:100%;box-sizing:border-box;outline:none" onkeydown="if(event.key==='Enter')saveFieldEdit()">
  <div id="field-edit-mgmt-btns" style="display:none;flex-direction:column;gap:5px">
    <button onclick="pickMgmt('')" style="background:#21262d;border:1px solid #30363d;color:#8b949e;border-radius:6px;padding:6px 10px;font-size:.76rem;cursor:pointer;text-align:left">— Clear</button>
    <button onclick="pickMgmt('Inhouse')" style="background:#0d2137;border:1px solid #1e6091;color:#58a6ff;border-radius:6px;padding:6px 10px;font-size:.76rem;cursor:pointer;text-align:left">Inhouse</button>
    <button onclick="pickMgmt('Outsourced')" style="background:#2e1a00;border:1px solid #8b6914;color:#e3b341;border-radius:6px;padding:6px 10px;font-size:.76rem;cursor:pointer;text-align:left">Outsourced</button>
    <button onclick="pickMgmt('Both')" style="background:#1a1a2e;border:1px solid #553098;color:#bc8cff;border-radius:6px;padding:6px 10px;font-size:.76rem;cursor:pointer;text-align:left">Both</button>
    <button onclick="pickMgmt('Unsure')" style="background:#21262d;border:1px solid #30363d;color:#8b949e;border-radius:6px;padding:6px 10px;font-size:.76rem;cursor:pointer;text-align:left">Unsure</button>
  </div>
  <div id="field-edit-inp-row" style="display:flex;gap:6px;margin-top:8px">
    <button onclick="saveFieldEdit()" style="flex:1;background:var(--accent);color:#fff;border:none;border-radius:5px;padding:5px;cursor:pointer;font-size:.72rem;font-weight:600">Save</button>
    <button onclick="document.getElementById('field-edit-pop').style.display='none'" style="flex:1;background:#21262d;color:#8b949e;border:1px solid #30363d;border-radius:5px;padding:5px;cursor:pointer;font-size:.72rem">Cancel</button>
  </div>
</div>

<!-- MONTH PICKER POPOVER -->
<div id="month-picker-pop" style="display:none;position:fixed;z-index:9999;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,.6);min-width:190px">
  <div style="font-size:.68rem;color:#8b949e;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Select Months</div>
  <div id="month-picker-list" style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:1px"></div>
  <div style="display:flex;gap:6px;margin-top:10px">
    <button onclick="saveMonthPicker()" style="flex:1;background:var(--accent);color:#fff;border:none;border-radius:5px;padding:5px;cursor:pointer;font-size:.72rem;font-weight:600">Save</button>
    <button onclick="document.getElementById('month-picker-pop').style.display='none'" style="flex:1;background:#21262d;color:#8b949e;border:1px solid #30363d;border-radius:5px;padding:5px;cursor:pointer;font-size:.72rem">Cancel</button>
  </div>
</div>

<!-- CONTACTS MODAL -->
<div class="overlay" id="contacts-modal" style="display:none" onclick="if(event.target===this)closeContacts()">
  <div class="modal" style="width:520px">
    <div class="modal-header">
      <div><div class="modal-title">Contacts</div><div id="contacts-co-name" style="font-size:.72rem;color:#8b949e"></div></div>
      <button class="modal-close" onclick="closeContacts()">✕</button>
    </div>
    <div id="contacts-list" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;margin-bottom:14px"></div>
    <div style="border-top:1px solid #21262d;padding-top:12px">
      <div style="font-size:.7rem;color:#8b949e;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Add / Edit Contact</div>
      <div class="mrow"><div class="half"><div class="mlbl">Name *</div><input type="text" id="ct-name" placeholder="e.g. John Smith"></div><div class="half"><div class="mlbl">Title / Role</div><input type="text" id="ct-title" placeholder="e.g. Fleet Manager"></div></div>
      <div class="mrow"><div class="half"><div class="mlbl">Email</div><input type="email" id="ct-email" placeholder="john@company.com"></div><div class="half"><div class="mlbl">Phone</div><input type="text" id="ct-phone" placeholder="+1 555 000 0000"></div></div>
      <div class="mbtns">
        <button class="bcancel" onclick="closeContacts()">Close</button>
        <button class="bsave" id="ct-save-btn" onclick="saveContact()">+ Add Contact</button>
      </div>
    </div>
  </div>
</div>

<!-- FOLLOW-UP PICKER -->
<div id="fu-pop">
  <div style="font-size:.72rem;color:#8b949e;margin-bottom:6px">Set Follow-up Date</div>
  <input type="date" id="fu-picker">
  <div class="fu-btns">
    <button onclick="saveFU()" style="background:var(--accent);color:#fff">Save</button>
    <button onclick="followUps[fuTarget]&&(delete followUps[fuTarget],saveFollowUps(),document.getElementById('fu-pop').style.display='none',renderTable(),updateKPIs())" style="background:#21262d;color:#f85149;border:1px solid #f85149">Clear</button>
    <button onclick="document.getElementById('fu-pop').style.display='none'" style="background:#21262d;color:#8b949e">Cancel</button>
  </div>
</div>

<!-- CONTACT CONFIRM MODAL -->
<div class="overlay" id="confirm-modal"><div class="modal">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title" id="confirm-modal-title">Confirm Contact</div>
      <button class="modal-close" onclick="closeConfirmModal()">✕</button>
    </div>
    <div class="form-row">
      <label>How did you contact them?</label>
      <select id="confirm-method"><option value="Email">Email</option><option value="Call">Call</option><option value="WhatsApp">WhatsApp</option><option value="LinkedIn">LinkedIn</option><option value="Meeting">Meeting</option></select>
    </div>
    <div class="form-row">
      <label>Stage after contact</label>
      <select id="confirm-stage"><option value="Email Outreach">Email Outreach</option><option value="Call">Call</option><option value="Meeting / Positive">Meeting / Positive</option><option value="Retargeted">Retargeted</option></select>
    </div>
    <div class="form-row">
      <label>Notes</label>
      <textarea id="confirm-notes" rows="3" placeholder="What was discussed, outcome, next steps..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeConfirmModal()">Cancel</button>
      <button class="btn-primary" onclick="saveConfirmContact()">✓ Confirm Contacted</button>
    </div>
  </div>
</div></div>
`
