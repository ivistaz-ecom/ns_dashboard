export const weeklyPanelHtml = `
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
    <div class="wk-kpi"><div class="ik">🏢</div><div><div class="cnt" id="wk-cos" style="color:#0f172a">0</div><div class="nm">Companies</div></div></div>
  </div>
  <div class="comm-form">
    <div id="comm-edit-banner" style="display:none;background:var(--accent-soft);border:1px solid var(--accent);border-radius:6px;padding:6px 10px;margin-bottom:6px;font-size:.74rem;color:var(--accent-hover);display:none;align-items:center;justify-content:space-between">
      <span>Editing entry</span><button onclick="cancelCommEdit()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:.8rem">✕ Cancel</button>
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
`
