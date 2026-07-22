export const dashboardPanelHtml = `
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

  <div class="table-section pipeline-only">
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
