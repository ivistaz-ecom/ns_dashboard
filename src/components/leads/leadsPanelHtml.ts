export const leadsPanelHtml = `
<!-- ===== POTENTIAL LEADS ===== -->
<div class="panel" id="panel-leads" data-view="list">
  <div class="page-hero leads-hero">
    <div class="leads-title-row">
      <span class="leads-count" id="lead-count">0</span>
      <div>
        <h2 class="greeting">Potential Leads</h2>
        <p class="greeting-sub">Qualify companies before adding them to your pipeline</p>
      </div>
    </div>
  </div>

  <div class="table-section leads-section">
    <div class="ctrl">
      <div class="search-field">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="lead-search" placeholder="Search companies, notes..." oninput="renderLeads()">
      </div>
      <div class="ss-wrap month-filter-wrap" id="lead-month-ss">
        <input type="hidden" id="lead-month-filter" value="">
        <button type="button" class="ss-btn" id="lead-month-btn" onclick="toggleLeadMonthFilterDrop(event)" aria-haspopup="dialog" aria-expanded="false">
          <span id="lead-month-label">All Months</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="ss-drop month-filter-drop" id="lead-month-drop" hidden>
          <div class="month-filter-head">
            <button type="button" class="month-filter-nav" id="lead-month-prev" onclick="shiftLeadMonthFilterYear(-1, event)" aria-label="Previous year">‹</button>
            <div class="month-filter-year" id="lead-month-year"></div>
            <button type="button" class="month-filter-nav" id="lead-month-next" onclick="shiftLeadMonthFilterYear(1, event)" aria-label="Next year">›</button>
          </div>
          <div class="month-filter-grid" id="lead-month-grid" role="listbox" aria-label="Select month"></div>
          <button type="button" class="month-filter-all" id="lead-month-all" onclick="selectLeadMonthFilter('')">All Months</button>
        </div>
      </div>
      <div class="ss-wrap" id="lead-stage-ss">
        <input type="hidden" id="lead-stage-filter" value="">
        <button type="button" class="ss-btn" id="lead-stage-btn" onclick="toggleLeadStageDrop(event)" aria-haspopup="listbox" aria-expanded="false">
          <span id="lead-stage-label">All Stages</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="ss-drop" id="lead-stage-drop" hidden>
          <div class="ss-list" id="lead-stage-list" role="listbox" aria-label="Select stage"></div>
        </div>
      </div>
      <div class="ss-wrap" id="lead-country-ss">
        <input type="hidden" id="lead-country-filter" value="">
        <button type="button" class="ss-btn" id="lead-country-btn" onclick="toggleLeadCountryDrop(event)" aria-haspopup="listbox" aria-expanded="false">
          <span id="lead-country-label">All Countries</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="ss-drop" id="lead-country-drop" hidden>
          <div class="ss-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="lead-country-search" placeholder="Search countries..." autocomplete="off" oninput="filterLeadCountryOptions()">
          </div>
          <div class="ss-list" id="lead-country-list" role="listbox"></div>
        </div>
      </div>
      <div class="ss-wrap" id="lead-mgmt-ss">
        <input type="hidden" id="lead-mgmt-filter" value="">
        <button type="button" class="ss-btn" id="lead-mgmt-btn" onclick="toggleLeadMgmtDrop(event)" aria-haspopup="listbox" aria-expanded="false">
          <span id="lead-mgmt-label">All Types</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="ss-drop" id="lead-mgmt-drop" hidden>
          <div class="ss-list" id="lead-mgmt-list" role="listbox" aria-label="Select management type"></div>
        </div>
      </div>
      <button class="cbtn" onclick="clearLeadFilters()">✕ Clear Filters</button>
      <div class="pipeline-primary-actions">
        <button class="add-co-btn" onclick="openAddLead()">+ Add Company</button>
      </div>
      <div class="pipeline-view-toggle" role="group" aria-label="Leads view">
        <button type="button" class="pipeline-view-btn active" id="leads-view-list" onclick="setLeadsView('list')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          List View
        </button>
        <button type="button" class="pipeline-view-btn" id="leads-view-grid" onclick="setLeadsView('grid')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Grid View
        </button>
      </div>
    </div>

    <div class="scroll" id="leads-scroll">
      <table id="lead-table">
        <thead><tr>
          <th onclick="sortLeads('company')">Company <span class="sort-icon">↕</span></th>
          <th onclick="sortLeads('country')">Country <span class="sort-icon">↕</span></th>
          <th onclick="sortLeads('mgmt')">Type <span class="sort-icon">↕</span></th>
          <th onclick="sortLeads('month')">Month <span class="sort-icon">↕</span></th>
          <th onclick="sortLeads('stage')">Stage <span class="sort-icon">↕</span> <span class="th-hint">▾ click to edit</span></th>
          <th>Call</th>
          <th onclick="sortLeads('followup')">Follow-up <span class="sort-icon">↕</span></th>
          <th>Notes</th>
          <th>Actions</th>
        </tr></thead>
        <tbody id="lead-tbody"></tbody>
      </table>
      <div class="pipeline-grid" id="lead-grid" hidden></div>
      <div class="nores" id="lead-nores" style="display:none">No potential leads yet — click + Add Company to add one</div>
    </div>

    <div class="pgn">
      <span id="lead-pinfo">—</span>
      <div class="pbtns">
        <button class="pb" id="lead-pprev" onclick="changeLeadPage(-1)">← Prev</button>
        <button class="pb" id="lead-pnext" onclick="changeLeadPage(1)">Next →</button>
      </div>
    </div>
  </div>
</div>
`
