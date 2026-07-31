export const weeklyPanelHtml = `
<!-- ===== WEEKLY TRACKER ===== -->
<div class="panel" id="panel-weekly">
  <div class="page-hero">
    <div>
      <h2 class="greeting">Weekly Tracker (Activity Timeline)</h2>
      <p class="greeting-sub">Log and review your outreach activities</p>
    </div>
  </div>

  <div class="wk-card">
    <div class="wk-toolbar">
      <div class="wk-toolbar-title">Weekly Tracker</div>
      <div class="wk-date-nav">
        <button type="button" class="wk-arrow" onclick="changeWeek(-1)" title="Previous week" aria-label="Previous week">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="wk-date-wrap hdate-range">
          <input
            type="date"
            class="hdate wk-hdate"
            id="wk-date-from"
            aria-label="From date"
            onchange="onWeekRangeChanged()"
            title="From date"
          />
          <span class="hdate-sep" aria-hidden="true">–</span>
          <input
            type="date"
            class="hdate wk-hdate"
            id="wk-date-to"
            aria-label="To date"
            onchange="onWeekRangeChanged()"
            title="To date"
          />
        </div>
        <button type="button" class="wk-arrow" onclick="changeWeek(1)" title="Next week" aria-label="Next week">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div class="wk-toolbar-actions">
        <button type="button" class="wk-btn-primary" onclick="toggleCommForm(true)">+ Log Activity</button>
      </div>
    </div>

    <div class="wk-tabs" id="wk-tabs" role="tablist">
      <button type="button" class="wk-tab active" data-filter="all" onclick="setWeeklyFilter('all')">All Activity</button>
      <button type="button" class="wk-tab" data-filter="call" onclick="setWeeklyFilter('call')">Calls</button>
      <button type="button" class="wk-tab" data-filter="ads" onclick="setWeeklyFilter('ads')">Ads</button>
      <button type="button" class="wk-tab" data-filter="email" onclick="setWeeklyFilter('email')">Emails</button>
      <button type="button" class="wk-tab" data-filter="meeting" onclick="setWeeklyFilter('meeting')">Meetings</button>
      <button type="button" class="wk-tab" data-filter="whatsapp" onclick="setWeeklyFilter('whatsapp')">WhatsApp</button>
      <button type="button" class="wk-tab" data-filter="linkedin" onclick="setWeeklyFilter('linkedin')">LinkedIn</button>
      <button type="button" class="wk-tab" data-filter="not-interested" onclick="setWeeklyFilter('not-interested')">Not Interested</button>
      <button type="button" class="wk-tab" data-filter="task" onclick="setWeeklyFilter('task')">Tasks</button>
    </div>

    <div class="comm-form" id="comm-form" style="display:none">
      <div id="comm-edit-banner" style="display:none;align-items:center;justify-content:space-between">
        <span>Editing entry</span>
        <button type="button" onclick="cancelCommEdit()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:.8rem">✕ Cancel</button>
      </div>
      <div class="cf-row">
        <input class="cf-co" type="text" id="cf-company" placeholder="Company name..." list="co-list">
        <datalist id="co-list"></datalist>
        <select class="cf-type" id="cf-type">
          <option value="call">Call</option>
          <option value="ads">Ads</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="task">Task</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="linkedin">LinkedIn</option>
        </select>
        <input type="date" id="cf-date">
      </div>
      <textarea class="cf-ta" id="cf-text" placeholder="What happened? Outcome, next steps..."></textarea>
      <div class="cf-footer">
        <button type="button" class="wk-btn-outline" onclick="toggleCommForm(false)">Cancel</button>
        <button type="button" class="addbtn wk-btn-primary" id="comm-save-btn" onclick="addComm()">+ Log Activity</button>
      </div>
    </div>

    <div class="comm-list" id="comm-list">
      <div class="comm-empty">Loading activities…</div>
    </div>
  </div>
</div>
`
