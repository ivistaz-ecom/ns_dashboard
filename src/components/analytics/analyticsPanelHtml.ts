export const analyticsPanelHtml = `
<!-- ===== ANALYTICS ===== -->
<div class="panel" id="panel-analytics">
  <div class="page-hero">
    <div><h2 class="greeting">Analytics</h2><p class="greeting-sub">Deep dive into pipeline metrics</p></div>
  </div>
  <div class="analytics-grid">
    <div class="chart-card">
      <div class="chart-title">Pipeline by Stage</div>
      <div class="chart-subtitle">Share of companies in each stage</div>
      <div id="chart-stage" class="chart-body chart-donut-wrap analytics-donut"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Top Countries</div>
      <div class="chart-subtitle">Ranked by company count</div>
      <div id="chart-country" class="chart-body analytics-hbar-wrap"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Management Type</div>
      <div class="chart-subtitle">Mix across management models</div>
      <div id="chart-mgmt" class="chart-body analytics-vbar-wrap"></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Activity by Month</div>
      <div class="chart-subtitle">BD outreach volume over time</div>
      <div id="chart-month" class="chart-body analytics-line-wrap"></div>
    </div>
  </div>
</div>
`
