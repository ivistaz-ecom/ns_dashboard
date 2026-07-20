export const leadsPanelHtml = `
<!-- ===== POTENTIAL LEADS ===== -->
<div class="panel" id="panel-leads">
  <div class="page-hero">
    <div><h2 class="greeting">Potential Leads</h2><p class="greeting-sub">Research and qualify new opportunities</p></div>
  </div>
  <div class="kpi-bar" id="lead-kpi-bar">
    <div class="kpi"><div class="kpi-body"><div class="lbl">Total Leads</div><div class="num" id="lk-total">0</div></div></div>
    <div class="kpi"><div class="kpi-body"><div class="lbl">New</div><div class="num" id="lk-new" style="color:#64748b">0</div></div></div>
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
`
