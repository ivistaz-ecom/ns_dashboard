export const dashboardPanelHtml = `
<!-- ===== DASHBOARD / PIPELINE ===== -->
<div class="panel active" id="panel-dashboard">
  <div class="page-hero dashboard-only">
    <div></div>
    <div class="hdate-range">
      <input type="date" class="hdate" id="hdate-from" aria-label="From date" />
      <span class="hdate-sep">–</span>
      <input type="date" class="hdate" id="hdate-to" aria-label="To date" />
    </div>
  </div>

  <div class="kpi-bar">
    <div class="kpi clickable" onclick="kpiClick('')" id="kpi-total">
      <div class="kpi-icon blue">👥</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Total Companies</span></div>
        <div class="num" id="k-total">—</div>
      </div>
    </div>
    <div class="kpi orange clickable" onclick="kpiClick('Retargeted')" id="kpi-ret">
      <div class="kpi-icon orange">🎯</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Retargeted (Stage)</span></div>
        <div class="num" id="k-ret">—</div>
      </div>
    </div>
    <div class="kpi amber clickable" onclick="kpiClick('Call')" id="kpi-call" title="Companies called in this date range — click to list them">
      <div class="kpi-icon amber">📞</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Calls</span></div>
        <div class="num" id="k-call">—</div>
      </div>
    </div>
    <div class="kpi green clickable" onclick="kpiClick('Meeting / Positive')" id="kpi-pos">
      <div class="kpi-icon green">📅</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Meetings / Positive</span></div>
        <div class="num" id="k-pos">—</div>
      </div>
    </div>
    <div class="kpi purple clickable" onclick="kpiClick('Not Interested')" id="kpi-neg">
      <div class="kpi-icon purple">👎</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Not Interested</span></div>
        <div class="num" id="k-neg">—</div>
      </div>
    </div>
    <div class="kpi red2 clickable" onclick="kpiClick('__overdue__')" id="kpi-od">
      <div class="kpi-icon red">⏰</div>
      <div class="kpi-body">
        <div class="kpi-top"><span class="lbl">Overdue Follow-up</span></div>
        <div class="num" id="k-od">—</div>
      </div>
    </div>
  </div>

  <div class="charts-grid dashboard-only">
    <div class="chart-card">
      <div class="chart-title">Pipeline by Stage</div>
      <div class="chart-subtitle">Share of companies in each stage</div>
      <div id="dash-chart-stage" class="chart-body chart-donut-wrap analytics-donut"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Top Countries</div>
      <div class="chart-subtitle">Ranked by company count</div>
      <div id="dash-chart-country" class="chart-body analytics-hbar-wrap"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Management Type</div>
      <div class="chart-subtitle">Mix across management models</div>
      <div id="dash-chart-mgmt" class="chart-body analytics-vbar-wrap"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Activity by Month</div>
      <div class="chart-subtitle">BD outreach volume over time</div>
      <div id="dash-chart-month" class="chart-body analytics-line-wrap"></div>
    </div>
  </div>

  <div class="table-section pipeline-only">
    <div class="ctrl">
      <div class="search-field">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="search" placeholder="Search companies, notes...">
      </div>
      <div class="ss-wrap month-filter-wrap" id="pipeline-month-ss">
        <input type="hidden" id="fm" value="">
        <button type="button" class="ss-btn" id="pipeline-month-btn" onclick="toggleMonthFilterDrop(event)" aria-haspopup="dialog" aria-expanded="false">
          <span id="pipeline-month-label">All Months</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="ss-drop month-filter-drop" id="pipeline-month-drop" hidden>
          <div class="month-filter-head">
            <button type="button" class="month-filter-nav" id="pipeline-month-prev" onclick="shiftMonthFilterYear(-1, event)" aria-label="Previous year">‹</button>
            <div class="month-filter-year" id="pipeline-month-year"></div>
            <button type="button" class="month-filter-nav" id="pipeline-month-next" onclick="shiftMonthFilterYear(1, event)" aria-label="Next year">›</button>
          </div>
          <div class="month-filter-grid" id="pipeline-month-grid" role="listbox" aria-label="Select month"></div>
          <button type="button" class="month-filter-all" id="pipeline-month-all" onclick="selectMonthFilter('')">All Months</button>
        </div>
      </div>
      <div class="ss-wrap" id="pipeline-stage-ss">
        <input type="hidden" id="fs" value="">
        <button type="button" class="ss-btn" id="pipeline-stage-btn" onclick="togglePipelineStageDrop(event)" aria-haspopup="listbox" aria-expanded="false">
          <span id="pipeline-stage-label">All Stages</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="ss-drop" id="pipeline-stage-drop" hidden>
          <div class="ss-list" id="pipeline-stage-list" role="listbox" aria-label="Select stage"></div>
        </div>
      </div>
      <div class="ss-wrap" id="pipeline-country-ss">
        <input type="hidden" id="fc" value="">
        <button type="button" class="ss-btn" id="pipeline-country-btn" onclick="togglePipelineCountryDrop(event)" aria-haspopup="listbox" aria-expanded="false">
          <span id="pipeline-country-label">All Countries</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="ss-drop" id="pipeline-country-drop" hidden>
          <div class="ss-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="pipeline-country-search" placeholder="Search countries..." autocomplete="off" oninput="filterPipelineCountryOptions()">
          </div>
          <div class="ss-list" id="pipeline-country-list" role="listbox"></div>
        </div>
      </div>
      <div class="ss-wrap" id="pipeline-mgmt-ss">
        <input type="hidden" id="fg" value="">
        <button type="button" class="ss-btn" id="pipeline-mgmt-btn" onclick="togglePipelineMgmtDrop(event)" aria-haspopup="listbox" aria-expanded="false">
          <span id="pipeline-mgmt-label">All Types</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="ss-drop" id="pipeline-mgmt-drop" hidden>
          <div class="ss-list" id="pipeline-mgmt-list" role="listbox" aria-label="Select management type"></div>
        </div>
      </div>
      <button class="cbtn" onclick="clearFilters()">✕ Clear Filters</button>
      <div class="pipeline-primary-actions">
        <button class="add-co-btn" onclick="openAddCompany()">+ Add Company</button>
      </div>
      <div class="pipeline-view-toggle" role="group" aria-label="Pipeline view">
        <button type="button" class="pipeline-view-btn active" id="pipeline-view-list" onclick="setPipelineView('list')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          List View
        </button>
        <button type="button" class="pipeline-view-btn" id="pipeline-view-grid" onclick="setPipelineView('grid')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Grid View
        </button>
      </div>
    </div>
    <div class="scroll" id="pipeline-scroll">
      <table id="pipeline-table">
        <thead><tr>
          <th onclick="sortBy('company')">Company <span class="sort-icon">↕</span></th>
          <th onclick="sortBy('country')">Country <span class="sort-icon">↕</span></th>
          <th onclick="sortBy('mgmt_type')">Type <span class="sort-icon">↕</span></th>
          <th onclick="sortBy('month')">Month <span class="sort-icon">↕</span></th>
          <th onclick="sortBy('stage')">Stage <span class="sort-icon">↕</span> <span class="th-hint">▾ click to edit</span></th>
          <th>Call</th>
          <th onclick="sortBy('_follow_up')">Follow-up <span class="sort-icon">↕</span></th>
          <th>Notes</th>
          <th>Actions</th>
        </tr></thead>
        <tbody id="tbody"></tbody>
      </table>
      <div class="pipeline-grid" id="pipeline-grid" hidden></div>
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
`
