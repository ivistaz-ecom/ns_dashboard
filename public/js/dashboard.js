/* eslint-disable */
let RAW_BASE = []

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
  if (typeof window === "undefined" || !window.NsApi) {
    console.warn(
      "[dashboard] window.NsApi not found — check that api-client.js loaded before dashboard.js",
    )
    return []
  }
  const perPage = 200
  let page = 1
  const rows = []
  for (;;) {
    let res
    try {
      res = await window.NsApi.listCompanies({
        page,
        per_page: perPage,
        include_deleted: 0,
      })
    } catch (err) {
      console.error("[dashboard] failed to load companies from API:", err)
      break
    }
    const items = (res && res.items) || []
    items.forEach((r) => {
      rows.push({
        _id: r.id,
        code: r.company_code || "",
        company: r.company_name || "",
        country: r.country_name || "",
        mgmt_type: r.mgmt_type_name || "",
        status: r.status_detail || "",
        stage: r.stage_name || "",
        month: r.month || "",
        date: r.week_label || "",
        reply_status: r.reply_status || "",
        is_retarget: !!Number(r.is_retarget),
      })
    })
    if (items.length < perPage) break
    page += 1
  }
  return rows
}

function formatLeadDate(iso) {
  if (!iso) return "—"
  const raw = String(iso)
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"))
  if (isNaN(d.getTime())) return raw.slice(0, 10)
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** Extra lead fields not always returned by the API (email, phone, month, etc.). */
let leadExtras = JSON.parse(localStorage.getItem("ns_lead_extras") || "{}")
function saveLeadExtras() {
  localStorage.setItem("ns_lead_extras", JSON.stringify(leadExtras))
}

function mapLeadFromApi(r) {
  const id = r.id
  const extras = leadExtras[id] || {}
  const primary =
    extras.monthless === true
      ? ""
      : r.month ||
        extras.month ||
        (Array.isArray(extras.months) && extras.months[0]) ||
        monthLabelNow()
  const allMonths = [
    ...new Set(
      [
        ...(Array.isArray(extras.months) ? extras.months : []),
        primary,
        r.month,
        extras.month,
      ].filter((m) => m && isValidMonthLabel(m)),
    ),
  ]
  return {
    id,
    name: r.company_name || "",
    country: r.country_name || "",
    country_id: r.country_id != null ? Number(r.country_id) : null,
    contact: r.contact_name || extras.contact || "",
    contact_email: r.contact_email || extras.contact_email || "",
    contact_phone: r.contact_phone || extras.contact_phone || "",
    source: r.source || extras.source || "",
    // lead_status = pipeline state (New / Converted / …)
    status: r.lead_status || "New",
    // status column = row lifecycle (active / inactive) — used for soft-delete
    record_status: String(r.status || "active").toLowerCase(),
    stage: extras.stage || "Email Outreach",
    status_detail: r.status_detail || extras.status_detail || "",
    month: primary,
    _all_months: allMonths.length
      ? allMonths
      : [primary].filter(isValidMonthLabel),
    called: !!extras.called,
    followup: r.follow_up_date || extras.followup || "",
    mgmt: r.mgmt_type_name || "",
    mgmt_type_id: r.mgmt_type_id != null ? Number(r.mgmt_type_id) : null,
    notes: r.notes || "",
    added: formatLeadDate(r.created_on),
    created_on: r.created_on || "",
    converted_company_id: r.converted_company_id || null,
  }
}

/** Pulls potential leads from the live API into the shape renderLeads() expects. */
async function loadLeadsFromApi() {
  if (typeof window === "undefined" || !window.NsApi) {
    console.warn(
      "[dashboard] window.NsApi not found — cannot load leads from API",
    )
    return []
  }
  const perPage = 200
  let page = 1
  const rows = []
  for (;;) {
    let res
    try {
      res = await window.NsApi.listLeads({ page, per_page: perPage })
    } catch (err) {
      console.error("[dashboard] failed to load leads from API:", err)
      break
    }
    const items = (res && res.items) || []
    items.forEach((r) => {
      const mapped = mapLeadFromApi(r)
      // Soft-deleted rows (status = inactive) never enter local state
      if (!isActiveLeadRecord(mapped)) return
      rows.push(mapped)
    })
    if (items.length < perPage) break
    page += 1
  }
  return rows
}
const STAGE_ORDER = {
  Retargeted: 0,
  "Email Outreach": 1,
  Call: 2,
  "Meeting / Positive": 3,
  "Not Interested": 4,
  Prospected: 5,
}

/** Fallback when lookups haven't loaded yet (matches current `stage` table). */
const DASHBOARD_STAGE_FALLBACK = [
  "Email Outreach",
  "Retargeted",
  "Meeting / Positive",
  "Not Interested",
  "Prospected",
  "Call",
]

const STAGE_DOT_COLORS = {
  Retargeted: "#d97706",
  "Email Outreach": "#2563eb",
  Call: "#7c3aed",
  "Meeting / Positive": "#16a34a",
  "Not Interested": "#dc2626",
  Prospected: "#64748b",
}

/**
 * Every row in `stage` with status = 'active' — used site-wide.
 * Add a new row in phpMyAdmin (status = active) → it shows after refresh.
 * Set status = inactive → it disappears. No frontend code changes needed.
 */
function getActiveStageLookups() {
  return (NS_LOOKUPS.stages || []).filter((s) => {
    const name = String(s.status_name || "").trim()
    if (!name) return false
    const st = String(s.status != null ? s.status : "active").toLowerCase()
    return st !== "inactive"
  })
}

/**
 * Every row in `type` (management type) with status = 'active' — used site-wide.
 * Same rule as stages: inactive rows are hidden from filters and pickers.
 */
function getActiveMgmtTypeLookups() {
  return (NS_LOOKUPS.mgmt_types || []).filter((t) => {
    const name = String(t.type_name || "").trim()
    if (!name) return false
    const st = String(t.status != null ? t.status : "active").toLowerCase()
    return st !== "inactive"
  })
}

function getDashboardMgmtTypeOptions() {
  return getActiveMgmtTypeLookups()
    .map((t) => String(t.type_name || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

/**
 * Every row in `country` with status = 'active' — used site-wide.
 * Enable/disable in Settings; inactive countries disappear from filters,
 * forms, and pickers after refresh (lookups.php already returns active-only).
 */
function getActiveCountryLookups() {
  return (NS_LOOKUPS.countries || []).filter((c) => {
    const name = String(c.country_name || "").trim()
    if (!name) return false
    const st = String(c.status != null ? c.status : "active").toLowerCase()
    return st !== "inactive"
  })
}

function getDashboardCountryOptions() {
  return getActiveCountryLookups()
    .map((c) => String(c.country_name || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

function getDashboardStageOptions() {
  const fromApi = getActiveStageLookups().map((s) =>
    String(s.status_name || "").trim(),
  )
  const names = fromApi.length
    ? fromApi.slice()
    : DASHBOARD_STAGE_FALLBACK.slice()
  return names.sort((a, b) => {
    const ao = STAGE_ORDER[a]
    const bo = STAGE_ORDER[b]
    if (ao != null && bo != null) return ao - bo
    if (ao != null) return -1
    if (bo != null) return 1
    return a.localeCompare(b)
  })
}

/** Same list as getDashboardStageOptions, but full lookup rows (id + name). */
function getDashboardStageRecords() {
  const order = getDashboardStageOptions()
  const byName = new Map(getActiveStageLookups().map((s) => [s.status_name, s]))
  return order.map(
    (name) => byName.get(name) || { id: null, status_name: name },
  )
}

function stageDotColor(name) {
  return STAGE_DOT_COLORS[name] || "#64748b"
}

/** Rebuild the shared Change Stage popup from Dashboard stage options. */
function renderStageDropOptions() {
  const drop = document.getElementById("stage-drop")
  if (!drop) return
  const stages = getDashboardStageOptions()
  drop.innerHTML =
    `<div class="sd-hint">Change Stage</div>` +
    stages
      .map((name) => {
        const color = stageDotColor(name)
        return `<div class="sd-item" role="option" data-stage="${esc(name)}" onclick="setStage(this.getAttribute('data-stage'))"><div class="sd-dot" style="background:${color}"></div>${esc(name)}</div>`
      })
      .join("")
}

function populateConfirmStageOptions(preferred) {
  const sel = document.getElementById("confirm-stage")
  if (!sel) return
  const stages = getDashboardStageOptions()
  const cur = preferred || sel.value || "Email Outreach"
  sel.innerHTML = stages
    .map(
      (name) =>
        `<option value="${esc(name)}"${name === cur ? " selected" : ""}>${esc(name)}</option>`,
    )
    .join("")
  if (stages.includes(cur)) sel.value = cur
  else if (stages.includes("Email Outreach")) sel.value = "Email Outreach"
  else if (stages.length) sel.value = stages[0]
}
// Generated (not hardcoded) so it always covers "now" — previously this was
// a fixed literal capped at 'Jul 2026', so anything added after that month
// silently fell out of sort order and dropdown lists.
const MONTH_ORDER = (function () {
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  // Keep one shared, comprehensive range for every month picker and filter.
  const start = new Date(2000, 0, 1)
  const end = new Date(2100, 11, 1)
  const map = {}
  let i = 0
  const d = new Date(start)
  while (d <= end) {
    map[names[d.getMonth()] + " " + d.getFullYear()] = i++
    d.setMonth(d.getMonth() + 1)
  }
  return map
})()
/** Month labels in chronological order, e.g. for populating <select> dropdowns. */
function getMonthOptions() {
  return Object.keys(MONTH_ORDER).sort(
    (a, b) => MONTH_ORDER[a] - MONTH_ORDER[b],
  )
}

/** Cached country/stage/mgmt-type lookups pulled from the DB (not hardcoded lists). */
let NS_LOOKUPS = { countries: [], stages: [], mgmt_types: [] }

/**
 * Lookups.php only returns countries with status = 'active'.
 * Rows whose country is missing from that list are treated as disabled
 * and hidden across Pipeline / Dashboard / Weekly / Leads / Contacts.
 * Empty country (or lookups not loaded yet) stays visible.
 */
function isActiveCountryName(countryName) {
  const name = String(countryName || "")
    .trim()
    .toLowerCase()
  if (!name) return true
  const active = getActiveCountryLookups()
  if (!active.length) return true
  return active.some(
    (c) =>
      String(c.country_name || "")
        .trim()
        .toLowerCase() === name,
  )
}

function isActiveLeadRecord(lead) {
  if (!lead) return false
  const recordStatus = String(lead.record_status || "active").toLowerCase()
  return recordStatus !== "inactive"
}

async function loadLookups() {
  if (!window.NsApi) return
  try {
    NS_LOOKUPS = await window.NsApi.getLookups()
  } catch (err) {
    console.error("[dashboard] failed to load lookups:", err)
  }
}

/** After Settings enable/disable, refresh every view that depends on active countries. */
async function reloadNsLookups() {
  await loadLookups()
  try {
    renderStageDropOptions()
    populateConfirmStageOptions()
    populate()
    applyFilters()
    populateLeadFilters()
    populateLeadFormLookups()
    renderLeads()
    renderDashboardCharts()
    mergePipelineCommsIntoTracker()
    if (typeof saveComms === "function") saveComms()
    renderWeekly()
    if (typeof renderContactsTab === "function") renderContactsTab()
  } catch (err) {
    console.error("[dashboard] failed to refresh after lookups reload:", err)
  }
}
window.reloadNsLookups = reloadNsLookups

/** Small toast notification (SweetAlert2 if loaded, console fallback otherwise). */
function nsToast(msg, icon) {
  icon = icon || "success"
  if (typeof Swal === "undefined") {
    console.log("[" + icon + "]", msg)
    return
  }
  Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
  }).fire({ icon, title: msg })
}

/**
 * Centered destructive-action confirm. Single place so every Delete/Remove in
 * the app gets the same dialog; falls back to native confirm() when the
 * SweetAlert2 CDN script hasn't loaded.
 */
async function nsConfirmDelete(opts) {
  const { title, text, confirmButtonText } = opts || {}
  if (typeof Swal === "undefined") {
    return window.confirm(text ? `${title}\n\n${text}` : title)
  }
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    focusCancel: true,
    reverseButtons: true,
    buttonsStyling: false,
    confirmButtonText: confirmButtonText || "Yes, delete it",
    cancelButtonText: "Cancel",
    customClass: {
      popup: "ns-confirm-popup",
      title: "ns-confirm-title",
      htmlContainer: "ns-confirm-text",
      actions: "ns-confirm-actions",
      confirmButton: "ns-confirm-yes",
      cancelButton: "ns-confirm-no",
    },
  })
  return !!result.isConfirmed
}
window.nsConfirmDelete = nsConfirmDelete

let notes = JSON.parse(localStorage.getItem("ns_notes") || "{}")
/**
 * Notes, follow-ups, and call-log all attach to one specific `companies` row
 * (company_id), but a company can have several real rows (one per month).
 * We always anchor to the row with the LOWEST id (the earliest/original one)
 * so the same note/follow-up/call keeps showing up regardless of which row
 * currently "wins" the stage-priority display — that winner can change as
 * stages update, but this anchor never does.
 */
function resolveCompanyId(company) {
  const nk = company.toLowerCase().trim()
  const rows = RAW_BASE.filter(
    (r) => r.company.toLowerCase().trim() === nk && r._id,
  )
  if (!rows.length) return null
  return rows.reduce((min, r) => (r._id < min ? r._id : min), rows[0]._id)
}

let followUpIdByCompany = {} // company name key -> real follow_ups.id, for update/delete
let noteIdByCompanyIdx = {} // "company||idx" -> real notes.id, for delete

async function loadFollowUpsFromApi() {
  if (!window.NsApi) return
  const perPage = 200
  let page = 1
  for (;;) {
    let res
    try {
      res = await window.NsApi.listFollowUps({ page, per_page: perPage })
    } catch (err) {
      console.error("[dashboard] failed to load follow-ups:", err)
      break
    }
    const items = (res && res.items) || []
    items.forEach((fu) => {
      const row = RAW_BASE.find((r) => r._id === fu.company_id)
      if (!row) return
      const nk = row.company.toLowerCase().trim()
      followUps[nk] = fu.due_date
      followUpIdByCompany[nk] = fu.id
    })
    if (items.length < perPage) break
    page += 1
  }
}

async function loadNotesFromApi() {
  if (!window.NsApi) return
  const perPage = 200
  let page = 1
  const byCompany = {}
  for (;;) {
    let res
    try {
      res = await window.NsApi.listNotes({ page, per_page: perPage })
    } catch (err) {
      console.error("[dashboard] failed to load notes:", err)
      break
    }
    const items = (res && res.items) || []
    items.forEach((n) => {
      const row = RAW_BASE.find((r) => r._id === n.company_id)
      if (!row) return
      const nk = row.company.toLowerCase().trim()
      if (!byCompany[nk]) byCompany[nk] = []
      byCompany[nk].push({
        id: n.id != null ? Number(n.id) || n.id : null,
        text: n.note_text,
        ts: n.created_on,
      })
    })
    if (items.length < perPage) break
    page += 1
  }
  Object.keys(byCompany).forEach((nk) => {
    notes[nk] = byCompany[nk].sort((a, b) => new Date(a.ts) - new Date(b.ts))
  })
}
let callActivityIdByCompany = {} // company key -> latest 'Call' activity's real id (undefined = not called)
const ACTIVITY_UI_TO_API = {
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  meeting: "Meeting",
  task: "Demo",
  demo: "Demo",
  "follow-up": "Demo",
}
const ACTIVITY_API_TO_UI = {
  Call: "call",
  Email: "email",
  WhatsApp: "whatsapp",
  LinkedIn: "linkedin",
  Meeting: "meeting",
  Demo: "task",
}

function formatActivityTime(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

/** Company row by id, tolerant of string vs number ids across API endpoints. */
function findCompanyRowById(id) {
  if (id === null || id === undefined || id === "") return null
  const exact = RAW_BASE.find((r) => r._id === id)
  if (exact) return exact
  const num = Number(id)
  if (Number.isNaN(num)) return null
  return RAW_BASE.find((r) => Number(r._id) === num) || null
}

function mapActivityFromApi(a) {
  const row = findCompanyRowById(a.company_id)
  const dateRaw = a.activity_date || a.created_on || ""
  const date =
    typeof dateRaw === "string" && dateRaw.length >= 10
      ? dateRaw.slice(0, 10)
      : ""
  const tsSource = a.created_on || a.activity_date || date
  const ts = tsSource ? new Date(tsSource).getTime() : Date.now()
  return {
    id: a.id,
    company_id: a.company_id,
    company: row ? row.company : "",
    type:
      ACTIVITY_API_TO_UI[a.activity_type] ||
      String(a.activity_type || "")
        .toLowerCase()
        .replace(/\s+/g, "-"),
    text: a.notes || "",
    date,
    ts: Number.isNaN(ts) ? Date.now() : ts,
    timeStr: formatActivityTime(a.created_on || a.activity_date),
  }
}

async function loadActivitiesFromApi() {
  if (!window.NsApi) return
  const perPage = 200
  let page = 1
  const loaded = []
  let loadedOk = false
  for (;;) {
    let res
    try {
      res = await window.NsApi.listActivities({
        page,
        per_page: perPage,
      })
      loadedOk = true
    } catch (err) {
      console.error("[dashboard] failed to load activities:", err)
      break
    }
    const items = (res && res.items) || []
    items.forEach((a) => loaded.push(mapActivityFromApi(a)))
    if (items.length < perPage) break
    page += 1
  }
  if (!loadedOk) {
    // Keep the pipeline Call column usable from the cached activity log
    rebuildCallIndexFromComms()
    return
  }
  comms = loaded
  saveComms()
}

/** Parse "Jul 2026" → Date mid-month (for week/month matching). */
function parseMonthLabel(month) {
  if (!month || typeof month !== "string") return null
  const m = month.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/)
  if (!m) return null
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  const idx = names.indexOf(m[1])
  if (idx < 0) return null
  return new Date(Number(m[2]), idx, 15, 12, 0, 0)
}

/** True for real calendar months like "Jul 2026" — rejects junk like "2025 BD". */
function isValidMonthLabel(m) {
  if (!m || typeof m !== "string") return false
  const t = m.trim()
  if (!t) return false
  if (MONTH_ORDER[t] !== undefined) return true
  return !!parseMonthLabel(t)
}

/** Drop legacy local-only pipeline clutter (Added rows + junk month tags). */
function purgeLegacyLocalPipeline() {
  let changed = false
  if (customCompanies.length) {
    customCompanies = []
    saveCustom()
    changed = true
  }
  Object.keys(extraMonths).forEach((nk) => {
    const prev = extraMonths[nk] || []
    const cleaned = prev.filter(isValidMonthLabel)
    if (cleaned.length !== prev.length) {
      changed = true
      if (cleaned.length) extraMonths[nk] = cleaned
      else delete extraMonths[nk]
    }
  })
  if (changed) saveExtraMonths()
}

function monthLabelsForDateRange(fromStr, toStr) {
  const from = new Date((fromStr || "") + "T12:00:00")
  const to = new Date((toStr || "") + "T12:00:00")
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
    return new Set()
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
  const set = new Set()
  const cur = new Date(from.getFullYear(), from.getMonth(), 1, 12, 0, 0)
  const end = new Date(to.getFullYear(), to.getMonth(), 1, 12, 0, 0)
  while (cur <= end) {
    set.add(fmt(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return set
}

function monthLabelsForWeek(offset) {
  const { monStr, sunStr } = getWeekRange(offset)
  return monthLabelsForDateRange(monStr, sunStr)
}

function latestNoteText(company) {
  const nk = (company || "").toLowerCase().trim()
  const list = notes[nk]
  if (!list) return ""
  if (typeof list === "string") return list
  if (!Array.isArray(list) || !list.length) return ""
  const last = list[list.length - 1]
  return (last && last.text) || ""
}

/**
 * Prefer a concrete day from pipeline week_label (e.g. "18th June", "21 – 24 Jul")
 * within the campaign month; otherwise mid-month.
 */
function dateStrFromPipelineWeek(weekLabel, monthLabel) {
  const monthDate = parseMonthLabel(monthLabel)
  if (!monthDate) return null
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const m = String(weekLabel || "").match(/(\d{1,2})/)
  if (m) {
    const day = Number(m[1])
    if (day >= 1 && day <= 31) {
      const d = new Date(year, month, day, 12, 0, 0)
      if (d.getMonth() === month) {
        return typeof localDateInputValue === "function"
          ? localDateInputValue(d)
          : d.toISOString().slice(0, 10)
      }
    }
  }
  return typeof localDateInputValue === "function"
    ? localDateInputValue(monthDate)
    : monthDate.toISOString().slice(0, 10)
}

/**
 * Surface pipeline stages on the weekly timeline when a matching
 * activities.php row does not already exist.
 * Stages: Prospected, Email Outreach, Meeting / Positive, Not Interested.
 */
function mergePipelineCommsIntoTracker() {
  const haveEmail = new Set()
  const haveMeeting = new Set()
  const haveProspected = new Set()
  const haveNotInterested = new Set()
  comms.forEach((c) => {
    if (!c.company_id) return
    if (c.type === "email") haveEmail.add(c.company_id)
    if (c.type === "meeting") haveMeeting.add(c.company_id)
    if (c.type === "prospected") haveProspected.add(c.company_id)
    if (c.type === "not-interested") haveNotInterested.add(c.company_id)
  })

  // One row per company (prefer higher STAGE_ORDER via raw stage)
  const byNk = {}
  RAW_BASE.forEach((r) => {
    if (!r._id || !r.company) return
    if (!isActiveCountryName(r.country)) return
    const nk = r.company.toLowerCase().trim()
    const prev = byNk[nk]
    if (!prev) {
      byNk[nk] = r
      return
    }
    const ps = STAGE_ORDER[prev.stage] ?? STAGE_ORDER[getStage(prev)] ?? -1
    const ns = STAGE_ORDER[r.stage] ?? STAGE_ORDER[getStage(r)] ?? -1
    if (ns >= ps) byNk[nk] = r
  })

  const extras = []
  Object.values(byNk).forEach((r) => {
    // Use raw stage so Prospected is not collapsed into Email Outreach
    const stage = r.stage || ""
    const monthLabel = String(r.month || "").trim()
    const weekLabel = String(r.date || "").trim()
    const dateStr = dateStrFromPipelineWeek(weekLabel, monthLabel)
    // Skip rows without a real "Mon YYYY" month — otherwise they all
    // collapse onto "today" and show garbage like "2025 BD" in the timeline.
    if (!dateStr) return
    const monthDate = parseMonthLabel(monthLabel)
    const ts = monthDate
      ? monthDate.getTime()
      : Date.parse(dateStr + "T12:00:00")
    const note = latestNoteText(r.company)
    const detail = (r.status || "").trim()
    const base = {
      company_id: r._id,
      company: r.company,
      date: dateStr,
      monthLabel,
      weekLabel,
      ts: Number.isFinite(ts) ? ts : 0,
      timeStr: "",
      synthetic: true,
      source: "pipeline",
    }

    if (stage === "Prospected" && !haveProspected.has(r._id)) {
      extras.push({
        ...base,
        id: "pipe-prospected-" + r._id,
        type: "prospected",
        text: detail || note || "Prospected — added to pipeline",
      })
    }

    if (stage === "Email Outreach" && !haveEmail.has(r._id)) {
      extras.push({
        ...base,
        id: "pipe-email-" + r._id,
        type: "email",
        text: detail || note || "Email outreach logged from pipeline",
      })
    }

    if (stage === "Meeting / Positive" && !haveMeeting.has(r._id)) {
      extras.push({
        ...base,
        id: "pipe-meeting-" + r._id,
        type: "meeting",
        text:
          detail || note || "Meeting / positive outcome — report from pipeline",
      })
    }

    if (stage === "Not Interested" && !haveNotInterested.has(r._id)) {
      extras.push({
        ...base,
        id: "pipe-not-interested-" + r._id,
        type: "not-interested",
        text: detail || note || "Marked not interested",
      })
    }
  })

  if (extras.length) {
    comms = comms.concat(extras)
  }
}

/** @deprecated use loadActivitiesFromApi — kept as alias for older call sites */
async function loadCallActivitiesFromApi() {
  return loadActivitiesFromApi()
}
let comms = JSON.parse(localStorage.getItem("ns_comms") || "[]")

async function loadContactsFromApi() {
  if (!window.NsApi) return
  const perPage = 200
  let page = 1
  const byCompany = {}
  // When the API is unreachable we keep whatever was cached locally instead of
  // blanking the Contacts tab.
  let apiReachable = false
  for (;;) {
    let res
    try {
      res = await window.NsApi.listContacts({ page, per_page: perPage })
    } catch (err) {
      console.error("[dashboard] failed to load contacts:", err)
      break
    }
    apiReachable = true
    const items = (res && res.items) || []
    items.forEach((c) => {
      const companyId = Number(c.company_id)
      const row = RAW_BASE.find((r) => Number(r._id) === companyId)
      if (!row || !row.company) return
      const nk = row.company.toLowerCase().trim()
      if (!byCompany[nk]) byCompany[nk] = []
      byCompany[nk].push({
        id: c.id,
        name: c.name,
        title: c.title,
        email: c.email,
        phone: c.phone,
      })
    })
    if (items.length < perPage) break
    page += 1
  }
  if (!apiReachable) return
  Object.keys(byCompany).forEach((nk) => {
    // Newest contacts first (higher id = added later)
    byCompany[nk].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
    contacts[nk] = byCompany[nk]
  })
  saveContacts()
}
let stageOverrides = JSON.parse(localStorage.getItem("ns_stages") || "{}")
let customCompanies = JSON.parse(localStorage.getItem("ns_custom_cos") || "[]")
let potentialLeads = []
let followUps = JSON.parse(localStorage.getItem("ns_followups") || "{}")
let kpiActiveFilter = ""
let contacts = JSON.parse(localStorage.getItem("ns_contacts") || "{}")
let fieldEdits = JSON.parse(localStorage.getItem("ns_field_edits") || "{}")
let callLog = JSON.parse(localStorage.getItem("ns_calls") || "{}")
let deletedCos = JSON.parse(localStorage.getItem("ns_deleted") || "{}")
let trashedCompanies = JSON.parse(
  localStorage.getItem("ns_trashed_cos") || "[]",
)
let extraMonths = JSON.parse(localStorage.getItem("ns_extra_months") || "{}")
let uniqueMode = true
let retargetedNKs = new Set()

// Migrate 2nd Round → Retargeted in overrides
Object.keys(stageOverrides).forEach((k) => {
  if (stageOverrides[k] === "2nd Round") stageOverrides[k] = "Retargeted"
})

function saveNotes() {
  localStorage.setItem("ns_notes", JSON.stringify(notes))
}
function saveComms() {
  localStorage.setItem("ns_comms", JSON.stringify(comms))
  rebuildCallIndexFromComms()
}
function saveSO() {
  localStorage.setItem("ns_stages", JSON.stringify(stageOverrides))
}
function saveCustom() {
  localStorage.setItem("ns_custom_cos", JSON.stringify(customCompanies))
}
function saveLeads() {
  /* Leads are persisted via NsApi — kept as a no-op for legacy call sites. */
}

function getAllCompanies() {
  // Qualified leads can appear alongside pipeline until converted
  const leadEntries = potentialLeads
    .filter(
      (l) =>
        l.status === "Qualified" &&
        isActiveLeadRecord(l) &&
        isActiveCountryName(l.country),
    )
    .map((l) => ({
      company: l.name,
      country: l.country || "",
      mgmt: l.mgmt || "",
      stage: "Prospected",
      month: "Lead",
      status_detail: "",
      is_retarget: false,
      _from_lead: true,
      _lead_status: l.status,
      _lead_idx: potentialLeads.indexOf(l),
    }))

  // Prefer live API rows over legacy localStorage "Added" rows with the same name.
  // Local-only customs often have no `_id`, which blocks country/type/stage edits.
  const rawNames = new Set(
    RAW_BASE.map((r) => (r.company || "").toLowerCase().trim()).filter(Boolean),
  )
  const customs = customCompanies
    .filter(
      (c) => c && c.company && !rawNames.has(c.company.toLowerCase().trim()),
    )
    .map((c) => {
      const resolvedId = resolveCompanyId(c.company)
      return {
        ...c,
        _custom: true,
        _id: c._id || resolvedId || null,
        country: c.country || "",
        mgmt_type: c.mgmt_type || c.mgmt || "",
        stage: c.stage || "Prospected",
        month: c.month || "",
        status: c.status || c.status_detail || "",
      }
    })

  const customNames = new Set(
    customs.map((c) => c.company.toLowerCase().trim()),
  )
  const filteredLeads = leadEntries.filter(
    (l) =>
      !customNames.has(l.company.toLowerCase().trim()) &&
      !rawNames.has(l.company.toLowerCase().trim()),
  )
  return [...RAW_BASE, ...customs, ...filteredLeads].filter((r) => {
    if (deletedCos[(r.company || "").toLowerCase().trim()]) return false
    // Settings: only show rows for enabled (active) countries site-wide
    return isActiveCountryName(r.country)
  })
}

let curTab = "dashboard"
let filtered = [],
  sortCol = "_id",
  sortDir = -1,
  page = 1
const PER_PAGE = 50
let weekOffset = 0
let activeStageKey = ""

function stageKey(r) {
  return r.company.toLowerCase().trim() + "__" + (r.month || "custom")
}
function ck(r) {
  return r.company.toLowerCase().trim()
}
function getField(r, field) {
  if (field === "country" || field === "mgmt_type") return r[field] || ""
  return fieldEdits[ck(r)] && fieldEdits[ck(r)][field] !== undefined
    ? fieldEdits[ck(r)][field]
    : r[field] || ""
}
function setField(company, field, value) {
  const k = company.toLowerCase().trim()
  if (!fieldEdits[k]) fieldEdits[k] = {}
  fieldEdits[k][field] = value
  const scrollEl = document.querySelector("#panel-dashboard .scroll")
  const scrollTop = scrollEl ? scrollEl.scrollTop : 0
  const winY = window.scrollY
  saveFieldEdits()
  // Filters are lookup-driven (active only) — refresh from DB list
  if (field === "country") {
    populatePipelineCountryFilter(getDashboardCountryOptions())
  } else if (field === "mgmt_type") {
    populatePipelineMgmtFilter(getDashboardMgmtTypeOptions())
  }
  applyFilters(true)
  // Double rAF ensures scroll restores after browser layout+paint settle
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (scrollEl) scrollEl.scrollTop = scrollTop
      if (winY) window.scrollTo(0, winY)
    }),
  )
}
function companyMonthCount(r) {
  if (!r) return 0
  const nk = (r.company || "").toLowerCase().trim()
  const months = new Set()
  ;(r._all_months || []).forEach((m) => {
    if (isValidMonthLabel(m)) months.add(m.trim())
  })
  ;((typeof extraMonths !== "undefined" && extraMonths[nk]) || []).forEach(
    (m) => {
      if (isValidMonthLabel(m)) months.add(m.trim())
    },
  )
  if (isValidMonthLabel(r.month)) months.add(String(r.month).trim())
  return months.size
}

function getStage(r) {
  let s =
    r && r.stage === "Prospected" ? "Email Outreach" : (r && r.stage) || ""
  const keepAsIs =
    s === "Meeting / Positive" || s === "Call" || s === "Not Interested"
  if (keepAsIs) return s
  // 2+ months (or retarget flag) ⇒ Retargeted; otherwise Email Outreach
  if (r.is_retarget || companyMonthCount(r) >= 2) return "Retargeted"
  if (s === "Retargeted") return "Email Outreach"
  return s || "Email Outreach"
}

function activateTab(t) {
  curTab = t === "pipeline" ? "dashboard" : t
  const activeTab = t === "pipeline" ? "pipeline" : t
  document.querySelectorAll(".nav-item[data-tab]").forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === activeTab)
  })
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"))
  const panelId =
    t === "pipeline" || t === "dashboard" ? "panel-dashboard" : "panel-" + t
  const panel = document.getElementById(panelId)
  if (panel) panel.classList.add("active")
  const main = document.getElementById("main-content")
  if (main) main.classList.toggle("view-pipeline", t === "pipeline")
  if (t === "weekly") renderWeekly()
  if (t === "leads") {
    populateLeadFilters()
    renderLeads()
  }
  if (t === "contacts") renderContactsTab()
  if (t === "analytics") renderAnalytics && renderAnalytics()
  if (t === "dashboard" || t === "pipeline") {
    if (typeof populate === "function") populate()
    if (typeof applyFilters === "function") applyFilters()
    if (typeof renderDashboardCharts === "function") renderDashboardCharts()
  }
}

function switchTab(t) {
  const routes = {
    dashboard: "/",
    pipeline: "/pipeline",
    weekly: "/weekly",
    leads: "/leads",
    analytics: "/analytics",
    contacts: "/contacts",
    settings: "/settings",
  }
  const target = routes[t]
  if (target && window.location.pathname !== target) {
    if (typeof window.__nsNavigate === "function") {
      window.__nsNavigate(t)
      return
    }
    window.location.assign(target)
    return
  }
  activateTab(t)
}

window.switchTab = switchTab
window.__nsActivateTab = activateTab
window.globalSearch = globalSearch
window.exportData = exportData

function globalSearch(q) {
  const search = document.getElementById("search")
  if (search) {
    search.value = q
    applyFilters()
  }
}

/**
 * Earliest real campaign month across pipeline rows + locally tagged extras.
 * Used for the default dashboard "from" date: a hardcoded start year silently
 * drops companies tagged with older months, so Dashboard KPIs would disagree
 * with Pipeline Total Companies.
 */
function earliestDataMonthDate() {
  let minOrd = null
  let minLabel = ""
  const consider = (m) => {
    if (!isValidMonthLabel(m)) return
    const label = String(m).trim()
    const ord = MONTH_ORDER[label]
    if (ord === undefined) return
    if (minOrd == null || ord < minOrd) {
      minOrd = ord
      minLabel = label
    }
  }
  getAllCompanies().forEach((r) => consider(r.month))
  Object.keys(extraMonths || {}).forEach((nk) =>
    (extraMonths[nk] || []).forEach(consider),
  )
  const d = minLabel ? parseMonthLabel(minLabel) : null
  return d ? new Date(d.getFullYear(), d.getMonth(), 1) : null
}

function setHeaderDate() {
  const fromEl = document.getElementById("hdate-from")
  const toEl = document.getElementById("hdate-to")
  // Back-compat if an older single #hdate is still in the DOM
  const single = document.getElementById("hdate")
  if (!fromEl && !toEl && !single) return

  const today = localDateInputValue(new Date())
  if (fromEl && (!fromEl.value || fromEl.dataset.autoRange === "1")) {
    // Default from = first month that actually has data, so the untouched
    // Dashboard covers every company. A manual pick clears autoRange and wins.
    const earliest = earliestDataMonthDate()
    fromEl.value = earliest ? localDateInputValue(earliest) : "2022-01-01"
    fromEl.dataset.autoRange = "1"
  }
  if (toEl && !toEl.value) toEl.value = today
  if (single && !single.value) single.value = today
  ;[fromEl, toEl, single].forEach((el) => {
    if (!el || el.dataset.bound) return
    el.dataset.bound = "1"
    el.addEventListener("change", onDashboardDateChange)
  })
}

/** YYYY-MM-DD in local time (avoids UTC day-shift from toISOString). */
function localDateInputValue(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return y + "-" + m + "-" + day
}

/** True only on the Dashboard overview (not Pipeline, Analytics, etc.). */
function isDashboardPage() {
  const main = document.getElementById("main-content")
  const panel = document.getElementById("panel-dashboard")
  return (
    !!panel &&
    panel.classList.contains("active") &&
    !!main &&
    !main.classList.contains("view-pipeline")
  )
}

function monthKeyFromDate(d) {
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  return names[d.getMonth()] + " " + d.getFullYear()
}

function parseDateInput(el) {
  if (!el || !el.value) return null
  const d = new Date(el.value + "T12:00:00")
  return isNaN(d.getTime()) ? null : d
}

/**
 * Dashboard date range → inclusive month ordinals [fromOrd, toOrd].
 * Campaign rows use free-text month labels ("Jul 2026"), so filtering is
 * month-granular. Analytics / Pipeline ignore this range.
 *
 * When "to" is today or later, toOrd is left open (null) so companies tagged
 * with upcoming campaign months (e.g. Aug 2026 while today is still Jul)
 * still count — matching Pipeline Total Companies.
 */
function getDashboardMonthRange() {
  if (!isDashboardPage()) return null
  const fromEl = document.getElementById("hdate-from")
  const toEl = document.getElementById("hdate-to")
  const single = document.getElementById("hdate")

  let fromD = parseDateInput(fromEl)
  let toD = parseDateInput(toEl)
  if (!fromD && !toD && single) {
    // Legacy single picker = as-of / through date
    toD = parseDateInput(single)
  }
  if (!fromD && !toD) return null

  let fromOrd = fromD ? MONTH_ORDER[monthKeyFromDate(fromD)] : null
  let toOrd = null
  if (toD) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const toDay = new Date(toD)
    toDay.setHours(0, 0, 0, 0)
    if (toDay < today) {
      toOrd = MONTH_ORDER[monthKeyFromDate(toD)]
      if (toOrd === undefined) toOrd = null
    }
    // toDay >= today → no upper bound (include future-tagged months)
  }
  if (fromOrd == null && toOrd == null) {
    // Only a "through today" upper date was set — treat as no filter
    if (!fromD && toD) return null
  }
  if (fromOrd != null && toOrd != null && fromOrd > toOrd) {
    const tmp = fromOrd
    fromOrd = toOrd
    toOrd = tmp
  }
  if (fromOrd == null && toOrd == null) return null
  return { fromOrd, toOrd }
}

/**
 * Dashboard date range → inclusive YYYY-MM-DD bounds for activity rows.
 * Activities carry a real activity_date, so they filter by day rather than by
 * the month-granular campaign labels used for companies. As in
 * getDashboardMonthRange, a "to" of today or later leaves the upper bound open
 * so activities logged with a future date still count.
 */
function getDashboardActivityRange() {
  if (!isDashboardPage()) return null
  const fromEl = document.getElementById("hdate-from")
  const toEl = document.getElementById("hdate-to")
  const single = document.getElementById("hdate")

  let fromD = parseDateInput(fromEl)
  let toD = parseDateInput(toEl)
  if (!fromD && !toD && single) toD = parseDateInput(single)
  if (!fromD && !toD) return null
  if (fromD && toD && fromD > toD) {
    const tmp = fromD
    fromD = toD
    toD = tmp
  }

  let toStr = null
  if (toD) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const toDay = new Date(toD)
    toDay.setHours(0, 0, 0, 0)
    if (toDay < today) toStr = localDateInputValue(toD)
  }
  const fromStr = fromD ? localDateInputValue(fromD) : null
  if (!fromStr && !toStr) return null
  return { fromStr, toStr }
}

/** True if company has any campaign month inside the dashboard date range. */
function companyMonthsInRange(nk, rowMonths, range) {
  if (!range) return true
  const { fromOrd, toOrd } = range
  const months = new Set()
  ;(rowMonths || []).forEach((m) => {
    if (m && m !== "Lead") months.add(String(m).trim())
  })
  ;(extraMonths[nk] || []).forEach((m) => {
    if (isValidMonthLabel(m)) months.add(String(m).trim())
  })
  const dated = [...months].filter((m) => MONTH_ORDER[m] !== undefined)
  // Undated / Lead / unknown labels → always include (same as Pipeline)
  if (!dated.length) return true
  return dated.some((m) => {
    const ord = MONTH_ORDER[m]
    if (fromOrd != null && ord < fromOrd) return false
    if (toOrd != null && ord > toOrd) return false
    return true
  })
}

function filterRowsByDashboardDate(rows) {
  const range = getDashboardMonthRange()
  if (!range) return rows
  // Company-level: keep every row for a company that has any month in range
  // (including extraMonths), so Total matches Pipeline when the range covers them.
  const byNk = {}
  rows.forEach((r) => {
    const nk = (r.company || "").toLowerCase().trim()
    if (!nk) return
    if (!byNk[nk]) byNk[nk] = []
    byNk[nk].push(r)
  })
  const out = []
  Object.keys(byNk).forEach((nk) => {
    const group = byNk[nk]
    const rowMonths = group.map((r) => r.month).filter(Boolean)
    if (companyMonthsInRange(nk, rowMonths, range)) out.push(...group)
  })
  return out
}

function dedupeCompaniesHighestStage(rows) {
  const seen = {}
  const SP = {
    "Meeting / Positive": 6,
    Call: 5,
    Retargeted: 4,
    "Not Interested": 3,
    "Email Outreach": 2,
    Prospected: 1,
  }
  rows.forEach((r) => {
    const k = r.company.toLowerCase().trim()
    if (!seen[k]) {
      seen[k] = {
        ...r,
        _all_months: [r.month].filter(Boolean),
        is_retarget: !!r.is_retarget,
      }
    } else {
      seen[k]._all_months.push(r.month)
      if (r.is_retarget) seen[k].is_retarget = true
      const cur = SP[getStage(seen[k])] || 0
      const nw = SP[getStage(r)] || 0
      if (nw > cur) {
        const m = seen[k]._all_months
        const wasR = seen[k].is_retarget
        seen[k] = {
          ...r,
          _all_months: m,
          is_retarget: wasR || !!r.is_retarget,
        }
      }
    }
  })
  return Object.values(seen).map((r) => {
    const nk = r.company.toLowerCase().trim()
    const extra = extraMonths[nk] || []
    const allM = [...new Set([...(r._all_months || []), ...extra])].filter(
      isValidMonthLabel,
    )
    return { ...r, _all_months: allM }
  })
}

/** Unique companies — same basis as Pipeline with no table filters applied. */
function getUniquePipelineCompanies() {
  return dedupeCompaniesHighestStage(getAllCompanies())
}

/** Companies used for Dashboard KPIs + charts (date-scoped when picker set). */
function getDashboardMetricCompanies() {
  return dedupeCompaniesHighestStage(
    filterRowsByDashboardDate(getAllCompanies()),
  )
}

function onDashboardDateChange(event) {
  if (!isDashboardPage()) return
  const edited = event && event.currentTarget
  if (edited && edited.dataset) edited.dataset.autoRange = ""
  // Keep from ≤ to when the user edits either end
  const fromEl = document.getElementById("hdate-from")
  const toEl = document.getElementById("hdate-to")
  if (
    fromEl &&
    toEl &&
    fromEl.value &&
    toEl.value &&
    fromEl.value > toEl.value
  ) {
    if (document.activeElement === fromEl) toEl.value = fromEl.value
    else fromEl.value = toEl.value
  }
  updateKPIs()
  renderDashboardCharts()
}

function bc(s) {
  return (
    {
      Prospected: "b-1",
      "Email Outreach": "b-1",
      Retargeted: "b-r",
      Call: "b-c",
      "Meeting / Positive": "b-m",
      "Not Interested": "b-n",
    }[s] || "b-1"
  )
}

function populate() {
  const all = getAllCompanies()
  // Month filter uses the year/month grid picker (sync label only).
  // Stage / Country / Type filters = active lookup rows only (Settings).
  const stages = getDashboardStageOptions()
  const countries = getDashboardCountryOptions()
  const mgmts = getDashboardMgmtTypeOptions()
  // Drop a selected country filter if that country was disabled in Settings
  const fc = document.getElementById("fc")
  if (fc && fc.value && !countries.includes(fc.value)) {
    fc.value = ""
  }
  syncMonthFilterLabel()
  populatePipelineStageFilter(stages)
  populatePipelineCountryFilter(countries)
  populatePipelineMgmtFilter(mgmts)
  const dl = document.getElementById("co-list")
  if (dl) {
    dl.innerHTML = ""
    ;[...new Set(all.map((r) => r.company))].sort().forEach((c) => {
      const o = document.createElement("option")
      o.value = c
      dl.appendChild(o)
    })
  }
  setHeaderDate()
}

function applyFilters(keepPage) {
  const all = getAllCompanies()
  const q = document.getElementById("search").value.toLowerCase()
  const fm = document.getElementById("fm").value
  const fs = document.getElementById("fs").value
  const fc = document.getElementById("fc").value
  const fg = document.getElementById("fg").value
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Pre-compute retargeted set: 2+ unique months OR is_retarget flag from data.
  // The stored stage string is ignored on purpose: it can still read
  // "Retargeted" after a month was removed, which getStage() downgrades.
  const monthsByNk = {}
  all.forEach((r) => {
    const nk = r.company.toLowerCase().trim()
    if (!monthsByNk[nk]) monthsByNk[nk] = { months: new Set(), ret: false }
    if (isValidMonthLabel(r.month))
      monthsByNk[nk].months.add(String(r.month).trim())
    if (r.is_retarget) monthsByNk[nk].ret = true
  })
  retargetedNKs = new Set()
  Object.keys(monthsByNk).forEach((nk) => {
    const extra = (extraMonths[nk] || [])
      .filter(isValidMonthLabel)
      .map((m) => String(m).trim())
    const total = new Set([...monthsByNk[nk].months, ...extra])
    if (total.size >= 2 || monthsByNk[nk].ret) retargetedNKs.add(nk)
  })
  filtered = all.filter((r) => {
    const es = getStage(r)
    const nk = r.company.toLowerCase().trim()
    if (
      q &&
      !r.company.toLowerCase().includes(q) &&
      !getField(r, "country").toLowerCase().includes(q) &&
      !(r._contact_name || "").toLowerCase().includes(q)
    )
      return false
    // Retargeted spans several months, so its KPI overrides the month + stage
    // dropdowns but still respects country / type. Every row of a candidate
    // company is kept here so the unique-mode merge below sees all its months.
    const retKpi = kpiActiveFilter === "Retargeted"
    if (retKpi && !retargetedNKs.has(nk)) return false
    if (!retKpi) {
      if (fm && r.month !== fm) return false
      if (fs && es !== fs) return false
    }
    if (fc && getField(r, "country") !== fc) return false
    if (fg && getField(r, "mgmt_type") !== fg) return false
    if (retKpi) return true
    // other KPI filters
    if (kpiActiveFilter === "Call") return isCall(nk)
    if (kpiActiveFilter === "Meeting / Positive")
      return es === "Meeting / Positive"
    if (kpiActiveFilter === "Not Interested") return es === "Not Interested"
    if (kpiActiveFilter === "__overdue__") {
      const fu = r._follow_up || followUps[nk] || ""
      if (!fu) return false
      const d = new Date(fu)
      d.setHours(0, 0, 0, 0)
      return d < today
    }
    return true
  })
  // Unique mode: one row per company, highest stage, all months noted
  if (uniqueMode) {
    const seen = {}
    const STAGE_PRIORITY = {
      "Meeting / Positive": 6,
      Call: 5,
      Retargeted: 4,
      "Not Interested": 3,
      "Email Outreach": 2,
      Prospected: 1,
    }
    filtered.forEach((r) => {
      const ck = r.company.toLowerCase().trim()
      if (!seen[ck]) {
        seen[ck] = {
          ...r,
          _all_months: [r.month].filter(Boolean),
          is_retarget: !!r.is_retarget,
        }
      } else {
        seen[ck]._all_months.push(r.month)
        if (r.is_retarget) seen[ck].is_retarget = true // carry retarget flag from any record
        // Prefer the highest DB id so "newest first" sort stays correct
        if (r._id && (!seen[ck]._id || r._id > seen[ck]._id)) {
          seen[ck]._id = r._id
          if (r.code) seen[ck].code = r.code
        }
        if (!seen[ck].code && r.code) seen[ck].code = r.code
        const cur = STAGE_PRIORITY[getStage(seen[ck])] || 0
        const nw = STAGE_PRIORITY[getStage(r)] || 0
        if (nw > cur) {
          const months = seen[ck]._all_months
          const wasRet = seen[ck].is_retarget
          const keptId =
            Math.max(r._id || 0, seen[ck]._id || 0) || r._id || seen[ck]._id
          const keptCode = r.code || seen[ck].code
          seen[ck] = {
            ...r,
            _id: keptId,
            code: keptCode,
            _all_months: months,
            is_retarget: wasRet || !!r.is_retarget,
            // Drop local-only flag once we have a real API row
            _custom: keptId ? false : !!(r._custom || seen[ck]._custom),
          }
        }
      }
    })
    // Use ALL months from full dataset (not just filtered records) + extraMonths
    // This ensures months always show correctly regardless of active filters
    filtered = Object.values(seen).map((r) => {
      const nk = r.company.toLowerCase().trim()
      const extra = extraMonths[nk] || []
      const rawAll = [...(monthsByNk[nk]?.months || new Set())]
      const allM = [...new Set([...rawAll, ...extra])].filter(isValidMonthLabel)
      return { ...r, _all_months: allM }
    })
    // Narrow the company-wide candidate set to rows whose Stage badge really
    // reads "Retargeted", so the list never shows another stage.
    if (kpiActiveFilter === "Retargeted") {
      filtered = filtered.filter((r) => getStage(r) === "Retargeted")
    }
  }
  applySort()
  if (!keepPage) page = 1
  renderTable()
  updateKPIs()
  renderDashboardCharts()
}

function applySort() {
  filtered.sort((a, b) => {
    if (sortCol === "_id") {
      // Newest first (higher DB id = added later)
      return ((b._id || 0) - (a._id || 0)) * (sortDir < 0 ? 1 : -1)
    }
    let av = sortCol === "stage" ? getStage(a) : a[sortCol] || ""
    let bv = sortCol === "stage" ? getStage(b) : b[sortCol] || ""
    if (sortCol === "month") {
      av = MONTH_ORDER[av] ?? 99
      bv = MONTH_ORDER[bv] ?? 99
      return (av - bv) * sortDir
    }
    if (sortCol === "stage") {
      av = STAGE_ORDER[av] ?? 99
      bv = STAGE_ORDER[bv] ?? 99
      return (av - bv) * sortDir
    }
    const cmp = av.toString().localeCompare(bv.toString()) * sortDir
    if (cmp !== 0) return cmp
    // Tie-break: newer companies first
    return (b._id || 0) - (a._id || 0)
  })
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1
  else {
    sortCol = col
    sortDir = 1
  }
  document.querySelectorAll("#panel-dashboard thead th").forEach((th) => {
    const isActive = th.getAttribute("onclick") === `sortBy('${col}')`
    th.classList.toggle("sorted", isActive)
    const icon = th.querySelector(".sort-icon")
    if (icon) icon.textContent = isActive ? (sortDir === 1 ? "↑" : "↓") : "↕"
  })
  applySort()
  renderTable()
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function positionPopover(pop, rect, opts = {}) {
  const pad = opts.pad || 12
  pop.style.display = "block"
  pop.style.visibility = "hidden"
  pop.style.top = "0"
  pop.style.left = "0"
  const w = pop.offsetWidth
  const h = pop.offsetHeight
  pop.style.visibility = "visible"

  let top = rect.bottom + 4
  let left = rect.left
  const roomBelow = window.innerHeight - pad - top
  const roomAbove = rect.top - pad - 4

  if (h > roomBelow && roomAbove > roomBelow) top = rect.top - h - 4
  if (top + h > window.innerHeight - pad)
    top = Math.max(pad, window.innerHeight - pad - h)
  if (top < pad) top = pad
  if (left + w > window.innerWidth - pad) left = window.innerWidth - pad - w
  if (left < pad) left = pad

  pop.style.top = top + "px"
  pop.style.left = left + "px"
}

function ensurePipelineGridStyles() {
  if (document.getElementById("pipeline-grid-css")) return
  const style = document.createElement("style")
  style.id = "pipeline-grid-css"
  const both = (suffix) => `#pipeline-grid${suffix}, #lead-grid${suffix}`
  const child = (sel) => `#pipeline-grid ${sel}, #lead-grid ${sel}`
  style.textContent = `
${both(".pipeline-grid")}{
  display:grid !important;
  grid-template-columns:repeat(auto-fill,minmax(300px,1fr)) !important;
  gap:16px !important;
  padding:16px !important;
  align-content:start !important;
  background:#eef3f6 !important;
}
${both(".pipeline-grid[hidden]")}{display:none !important}
#pipeline-table[hidden],#lead-table[hidden]{display:none !important}
${child(".pg-card")}{
  display:flex !important;
  flex-direction:column !important;
  gap:12px !important;
  background:#fff !important;
  border:1px solid #dbe3ee !important;
  border-radius:16px !important;
  padding:16px !important;
  min-width:0 !important;
  box-shadow:0 1px 3px rgba(15,23,42,.05) !important;
  border-top:3px solid #008e9c !important;
}
${child(".pg-card.stage-b-r")}{border-top-color:#ea580c !important}
${child(".pg-card.stage-b-c")}{border-top-color:#7c3aed !important}
${child(".pg-card.stage-b-m")}{border-top-color:#16a34a !important}
${child(".pg-card.stage-b-n")}{border-top-color:#dc2626 !important}
${child(".pg-card.stage-b-1")}{border-top-color:#008e9c !important}
${child(".pg-card:hover")}{box-shadow:0 12px 28px rgba(15,23,42,.1) !important;transform:translateY(-2px);transition:box-shadow .18s ease,transform .18s ease}
${child(".pg-card.is-muted")}{opacity:.55}
${child(".pg-card-top")}{display:flex !important;align-items:center !important;justify-content:space-between !important;gap:8px !important}
${child(".pg-stage")}{border:none !important;cursor:pointer !important;font-size:.625rem !important;padding:3px 8px !important}
${child(".pg-name")}{margin:0 !important;font-size:1.05rem !important;font-weight:700 !important;color:#0f172a !important;line-height:1.3 !important;letter-spacing:-.02em !important;display:-webkit-box !important;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden !important}
${child(".pg-meta")}{display:flex !important;align-items:center !important;flex-wrap:wrap !important;gap:8px !important}
${child(".pg-code")}{font-size:.6875rem !important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace !important;color:#94a3b8 !important}
${child(".pg-chip")}{border:none !important;background:#eef6f7 !important;color:#007a86 !important;border-radius:999px !important;padding:4px 10px !important;font-size:.6875rem !important;font-weight:600 !important;font-family:inherit !important;cursor:pointer !important}
${child(".pg-chip:hover")}{background:#d9eef0 !important}
${child(".pg-tiles")}{display:grid !important;grid-template-columns:1fr 1fr !important;gap:8px !important}
${child(".pg-tile")}{display:flex !important;flex-direction:column !important;align-items:flex-start !important;gap:5px !important;min-width:0 !important;width:100% !important;padding:11px 12px !important;border:1px solid #e8eef5 !important;border-radius:12px !important;background:#f8fafc !important;cursor:pointer !important;font-family:inherit !important;text-align:left !important;box-sizing:border-box !important}
${child(".pg-tile:hover")}{background:#f1f5f9 !important;border-color:#d5dee9 !important}
${child(".pg-tile-lbl")}{display:block !important;font-size:.625rem !important;font-weight:700 !important;letter-spacing:.07em !important;text-transform:uppercase !important;color:#94a3b8 !important;line-height:1 !important}
${child(".pg-tile-val")}{display:block !important;font-size:.8125rem !important;font-weight:650 !important;color:#0f172a !important;line-height:1.3 !important;max-width:100% !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important}
${child(".pg-tile-val.muted")}{color:#94a3b8 !important;font-weight:500 !important}
${child(".pg-tile-val.yes")}{color:#007a86 !important}
${child(".pg-extra")}{color:#64748b !important;font-weight:500 !important;font-size:.75rem !important}
${child(".pg-rows")}{display:flex !important;flex-direction:column !important;gap:6px !important}
${child(".pg-row")}{display:flex !important;align-items:center !important;justify-content:space-between !important;gap:10px !important;width:100% !important;padding:10px 12px !important;border:1px solid #e8eef5 !important;border-radius:10px !important;background:#fff !important;cursor:pointer !important;font-family:inherit !important;text-align:left !important;box-sizing:border-box !important}
${child(".pg-row:hover")}{background:#f8fafc !important;border-color:#d5dee9 !important}
${child(".pg-row-lbl")}{flex-shrink:0 !important;font-size:.6875rem !important;font-weight:700 !important;color:#94a3b8 !important;text-transform:uppercase !important;letter-spacing:.04em !important}
${child(".pg-row-val")}{min-width:0 !important;font-size:.8125rem !important;font-weight:600 !important;color:#0f172a !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important}
${child(".pg-row-val.muted")}{color:#94a3b8 !important;font-weight:500 !important}
${child(".pg-row-val.fu-ok")}{color:#15803d !important}
${child(".pg-row-val.fu-today")}{color:#b45309 !important}
${child(".pg-row-val.fu-overdue")}{color:#dc2626 !important}
${child(".pg-row-val.fu-neutral")}{color:#64748b !important;font-weight:500 !important}
${child(".pg-actions")}{display:grid !important;grid-template-columns:repeat(4,minmax(0,1fr)) !important;gap:6px !important;margin-top:auto !important;padding-top:4px !important}
${child(".pg-btn")}{border:1px solid #e2e8f0 !important;background:#fff !important;color:#475569 !important;border-radius:9px !important;padding:9px 6px !important;font-size:.6875rem !important;font-weight:600 !important;font-family:inherit !important;cursor:pointer !important}
${child(".pg-btn:hover")}{background:#f8fafc !important;color:#0f172a !important;border-color:#cbd5e1 !important}
${child(".pg-btn-primary")}{background:#008e9c !important;border-color:#008e9c !important;color:#fff !important}
${child(".pg-btn-primary:hover")}{background:#007a86 !important;border-color:#007a86 !important;color:#fff !important}
@media (max-width:1100px){${both(".pipeline-grid")}{grid-template-columns:repeat(auto-fill,minmax(260px,1fr)) !important}}
@media (max-width:700px){${both(".pipeline-grid")}{grid-template-columns:1fr !important}${child(".pg-actions")}{grid-template-columns:1fr 1fr !important}}
`
  document.head.appendChild(style)
}

function renderTable() {
  ensurePipelineGridStyles()
  const start = (page - 1) * PER_PAGE,
    slice = filtered.slice(start, start + PER_PAGE)
  const tbody = document.getElementById("tbody")
  const grid = document.getElementById("pipeline-grid")
  const table = document.getElementById("pipeline-table")
  const nores = document.getElementById("nores")
  if (!tbody) return

  const isGrid = pipelineViewMode === "grid"
  if (table) table.hidden = isGrid
  if (grid) grid.hidden = !isGrid

  if (!filtered.length) {
    tbody.innerHTML = ""
    if (grid) grid.innerHTML = ""
    if (nores) nores.style.display = "block"
    document.getElementById("pinfo").textContent = "Showing 0 of 0"
    document.getElementById("pprev").disabled = true
    document.getElementById("pnext").disabled = true
    renderPageNumbers(0)
    return
  }
  if (nores) nores.style.display = "none"

  if (isGrid) {
    tbody.innerHTML = ""
    if (grid) grid.innerHTML = slice.map(renderPipelineGridCard).join("")
  } else {
    if (grid) grid.innerHTML = ""
    tbody.innerHTML = slice.map(renderPipelineTableRow).join("")
  }

  const total = filtered.length,
    end = Math.min(start + PER_PAGE, total)
  document.getElementById("pinfo").textContent =
    `Showing ${start + 1} – ${end} of ${total.toLocaleString()}`
  document.getElementById("pprev").disabled = page === 1
  document.getElementById("pnext").disabled = end >= total
  renderPageNumbers(total)
  syncPipelineViewButtons()
}

let pipelineViewMode =
  localStorage.getItem("ns_pipeline_view") === "grid" ? "grid" : "list"

function setPipelineView(mode) {
  pipelineViewMode = mode === "grid" ? "grid" : "list"
  localStorage.setItem("ns_pipeline_view", pipelineViewMode)
  syncPipelineViewButtons()
  renderTable()
}
window.setPipelineView = setPipelineView

function syncPipelineViewButtons() {
  const listBtn = document.getElementById("pipeline-view-list")
  const gridBtn = document.getElementById("pipeline-view-grid")
  if (listBtn) listBtn.classList.toggle("active", pipelineViewMode === "list")
  if (gridBtn) gridBtn.classList.toggle("active", pipelineViewMode === "grid")
}

function renderPipelineTableRow(r) {
  const nk = r.company.toLowerCase().trim()
  const eco = esc(r.company),
    ect = esc(r.country || "")
  const _noteArr = Array.isArray(notes[nk])
    ? notes[nk]
    : notes[nk]
      ? [{ text: notes[nk], ts: null }]
      : []
  const note = _noteArr.length ? _noteArr[_noteArr.length - 1].text : ""
  const _noteCount = Array.isArray(notes[nk]) ? notes[nk].length : 0
  const _moreTag =
    _noteCount > 1
      ? '<span style="color:#64748b;font-size:.58rem;margin-left:4px">(+' +
        (_noteCount - 1) +
        " more)</span>"
      : ""
  const np = note
    ? '<div class="nprev clickable-note" data-co="' +
      eco +
      '" data-ct="' +
      ect +
      '" onclick="openNote(this.dataset.co,this.dataset.ct)" title="Click to see all notes">' +
      esc(note) +
      _moreTag +
      "</div>"
    : ""
  const es = getStage(r)
  const isEdited = false // stage now comes straight from the DB, so there's no local "edited" divergence to flag
  const isCustom = !!r._custom
  const addedTag = isCustom
    ? '<span class="custom-tag">Added</span>'
    : r._from_lead
      ? '<span class="custom-tag" style="background:#eff6ff;color:#1d4ed8;border-color:#93c5fd">🎯 Lead</span>'
      : ""
  // Follow-up
  const fu = r._follow_up || followUps[nk] || ""
  let fuCell = '<span style="color:#94a3b8;font-size:.65rem">—</span>'
  if (fu) {
    const fuDate = new Date(fu),
      today = new Date()
    today.setHours(0, 0, 0, 0)
    fuDate.setHours(0, 0, 0, 0)
    const diff = Math.round((fuDate - today) / (1000 * 60 * 60 * 24))
    const fuLabel = fuDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    const fuStyle =
      diff < 0
        ? "color:#dc2626;font-weight:600"
        : diff === 0
          ? "color:#d97706;font-weight:600"
          : "color:#16a34a"
    const fuIcon = diff < 0 ? "🔴 " : diff === 0 ? "🟡 " : ""
    fuCell =
      '<span style="font-size:.66rem;' +
      fuStyle +
      '">' +
      fuIcon +
      fuLabel +
      '</span><button data-co="' +
      eco +
      '" onclick="setFollowUp(this.dataset.co,event)" style="display:block;margin-top:2px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.6rem;padding:0" title="Edit follow-up">Edit</button>'
  } else {
    fuCell =
      '<button data-co="' +
      eco +
      '" onclick="setFollowUp(this.dataset.co,event)" style="background:none;border:1px dashed #cbd5e1;color:#64748b;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:.6rem">＋ Set</button>'
  }

  // Month display — only real "Mon YYYY" labels (hide junk like "2025 BD")
  const baseMonths = r._all_months
    ? r._all_months.filter((m, i, a) => m && a.indexOf(m) === i)
    : []
  const allMonths = [
    ...new Set([...baseMonths, ...(extraMonths[nk] || [])]),
  ].filter(isValidMonthLabel)
  const curMonth = isValidMonthLabel(getField(r, "month") || r.month)
    ? getField(r, "month") || r.month
    : allMonths[0] || ""
  const otherMonths = allMonths.filter((m) => m && m !== curMonth)
  const monthDisplay =
    `<span class="mtag editable" onclick="openMonthPicker(event,'${eco}')" title="Click to edit months">${esc(curMonth || "—")}</span>` +
    (otherMonths.length
      ? `<span style="font-size:.55rem;color:#64748b;display:block;margin-top:2px">${otherMonths.map((m) => `+${esc(m)}`).join(", ")}</span>`
      : "")

  return `<tr${es === "Not Interested" ? ' style="opacity:.55"' : ""}>
      <td><span class="cn">${esc(r.company)}</span>${r.code ? `<span style="display:block;font-size:.6rem;color:#94a3b8;font-family:monospace">${esc(r.code)}</span>` : ""}${addedTag}<span class="cell-chips">${noteChip(`openNote('${eco}','${ect}')`, !!note)}${contactsChip("openContacts(this.dataset.co)", (contacts[nk] || []).length, `data-co="${eco}"`)}</span></td>
      <td><span class="editable-cell" onclick="openFieldEdit(event,${r._id || "null"},'${eco}','country','${esc(getField(r, "country"))}')">${esc(getField(r, "country") || "—")}</span></td>
      <td><span class="editable-cell" onclick="openFieldEdit(event,${r._id || "null"},'${eco}','mgmt_type','${esc(getField(r, "mgmt_type"))}')">${esc(getField(r, "mgmt_type") || "—")}</span></td>
      <td>${monthDisplay}</td>
      <td><span class="badge ${bc(es)} editable${isEdited ? " edited" : ""}" onclick="openStageDrop(event,'${eco}','${esc(r.month || "custom")}',${r._id || "null"})">${esc(es)}</span></td>
      <td><span data-co="${eco}" onclick="toggleCall(this.dataset.co)" class="${isCall(nk) ? "call-yes" : "call-no"}">${isCall(nk) ? "📞 Yes" : "—"}</span></td>
      <td>${fuCell}</td>
      <td>${np}${note ? "" : `<button class="add-note-btn" onclick="addNote('${eco}')">＋ Note</button>`}</td>
      <td><div class="row-actions">${rowActionButton("edit", `rowActionEdit(event,'${eco}',${r._id || "null"})`, "Edit")}${rowActionButton("delete", `rowActionDelete(event,'${eco}',${r._id || "null"})`, "Delete", "is-danger")}</div></td>
    </tr>`
}

function renderPipelineGridCard(r) {
  const nk = r.company.toLowerCase().trim()
  const eco = esc(r.company)
  const ect = esc(r.country || "")
  const es = getStage(r)
  const country = getField(r, "country") || "—"
  const type = getField(r, "mgmt_type") || "—"
  const baseMonths = r._all_months
    ? r._all_months.filter((m, i, a) => m && a.indexOf(m) === i)
    : []
  const allMonths = [
    ...new Set([...baseMonths, ...(extraMonths[nk] || [])]),
  ].filter(isValidMonthLabel)
  const curMonth = isValidMonthLabel(getField(r, "month") || r.month)
    ? getField(r, "month") || r.month
    : allMonths[0] || ""
  const otherMonths = allMonths.filter((m) => m && m !== curMonth)
  const noteArr = Array.isArray(notes[nk])
    ? notes[nk]
    : notes[nk]
      ? [{ text: notes[nk], ts: null }]
      : []
  const note = noteArr.length ? noteArr[noteArr.length - 1].text : ""
  const noteCount = noteArr.length
  const contactCount =
    contacts[nk] && contacts[nk].length ? contacts[nk].length : 0
  const fu = r._follow_up || followUps[nk] || ""
  const idAttr = r._id != null ? String(r._id) : "null"
  const called = isCall(nk)
  let fuLabel = "Set date"
  let fuTone = "neutral"
  if (fu) {
    const fuDate = new Date(fu)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    fuDate.setHours(0, 0, 0, 0)
    const diff = Math.round((fuDate - today) / (1000 * 60 * 60 * 24))
    fuLabel = fuDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    fuTone = diff < 0 ? "overdue" : diff === 0 ? "today" : "ok"
  }
  const stageClass = bc(es) || "b-1"
  const monthLine = esc(curMonth || "—")
  const monthExtra = otherMonths.length
    ? ` <span class="pg-extra">+${otherMonths.length}</span>`
    : ""

  return `<article class="pg-card stage-${stageClass}${es === "Not Interested" ? " is-muted" : ""}">
    <div class="pg-card-top">
      <button type="button" class="pg-stage badge ${stageClass} editable" onclick="openStageDrop(event,'${eco}','${esc(r.month || "custom")}',${idAttr})">${esc(es)}</button>
      <div class="row-actions">${rowActionButton("edit", `rowActionEdit(event,'${eco}',${idAttr})`, "Edit")}${rowActionButton("delete", `rowActionDelete(event,'${eco}',${idAttr})`, "Delete", "is-danger")}</div>
    </div>
    <h3 class="pg-name" title="${esc(r.company)}">${esc(r.company)}</h3>
    <div class="pg-meta">
      ${r.code ? `<span class="pg-code">${esc(r.code)}</span>` : ""}
      <button type="button" class="pg-chip" data-co="${eco}" onclick="openContacts(this.dataset.co)">${CELL_ICONS.contacts}${contactCount ? contactCount + " contacts" : "Contacts"}</button>
    </div>

    <div class="pg-tiles">
      <div class="pg-tile" role="button" tabindex="0" onclick="openFieldEdit(event,${idAttr},'${eco}','country','${esc(country === "—" ? "" : country)}')">
        <span class="pg-tile-lbl">Country</span>
        <span class="pg-tile-val">${esc(country)}</span>
      </div>
      <div class="pg-tile" role="button" tabindex="0" onclick="openFieldEdit(event,${idAttr},'${eco}','mgmt_type','${esc(type === "—" ? "" : type)}')">
        <span class="pg-tile-lbl">Type</span>
        <span class="pg-tile-val" title="${esc(type)}">${esc(type)}</span>
      </div>
      <div class="pg-tile" role="button" tabindex="0" onclick="openMonthPicker(event,'${eco}')">
        <span class="pg-tile-lbl">Month</span>
        <span class="pg-tile-val">${monthLine}${monthExtra}</span>
      </div>
      <div class="pg-tile" role="button" tabindex="0" data-co="${eco}" onclick="toggleCall(this.dataset.co)">
        <span class="pg-tile-lbl">Call</span>
        <span class="pg-tile-val ${called ? "yes" : "muted"}">${called ? "Yes" : "—"}</span>
      </div>
    </div>

    <div class="pg-rows">
      <div class="pg-row" role="button" tabindex="0" data-co="${eco}" onclick="setFollowUp(this.dataset.co,event)">
        <span class="pg-row-lbl">Follow-up</span>
        <span class="pg-row-val fu-${fuTone}">${esc(fuLabel)}</span>
      </div>
      <div class="pg-row" role="button" tabindex="0" onclick="${note ? `openNote('${eco}','${ect}')` : `addNote('${eco}')`}">
        <span class="pg-row-lbl">Notes</span>
        <span class="pg-row-val ${note ? "" : "muted"}" title="${note ? esc(note) : ""}">${note ? esc(note) : "Add note"}</span>
      </div>
    </div>

    <div class="pg-actions">
      <button type="button" class="pg-btn pg-btn-primary" onclick="editPipelineCompany(${idAttr})">Edit</button>
      <button type="button" class="pg-btn" onclick="openNote('${eco}','${ect}')">Notes${noteCount ? ` (${noteCount})` : ""}</button>
      <button type="button" class="pg-btn" data-co="${eco}" onclick="openContacts(this.dataset.co)">Contacts</button>
      <button type="button" class="pg-btn" data-co="${eco}" onclick="setFollowUp(this.dataset.co,event)">Follow-up</button>
    </div>
  </article>`
}

function editPipelineCompany(id) {
  if (id == null) {
    openAddCompany()
    return
  }
  const row = RAW_BASE.find((r) => r._id === id)
  if (row) openAddCompany(row)
  else openAddCompany()
}

const ROW_ACTION_ICONS = {
  edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  delete:
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  promote:
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><polyline points="5 12 12 5 19 12"/></svg>',
}

function rowActionButton(icon, onclick, label, variant) {
  // data-tooltip drives the custom tooltip; no title attr so the delayed native one stays out of the way.
  return `<button type="button" class="row-action-btn${variant ? " " + variant : ""}" onclick="${onclick}" data-tooltip="${label}" aria-label="${label}">${ROW_ACTION_ICONS[icon]}</button>`
}

const CELL_ICONS = {
  note: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>',
  noteAdd:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="9" y1="10" x2="15" y2="10"/></svg>',
  contacts:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
}

/** Compact icon chip used inside the company / lead name cell. */
function cellChip(icon, onclick, label, opts) {
  const { count, active, attrs } = opts || {}
  return `<button type="button" class="cell-chip${active ? " is-active" : ""}"${attrs ? " " + attrs : ""} onclick="${onclick}" data-tooltip="${label}" aria-label="${label}">${CELL_ICONS[icon]}${count ? `<span class="cell-chip-count">${count}</span>` : ""}</button>`
}

function noteChip(onclick, hasNote) {
  return cellChip(hasNote ? "note" : "noteAdd", onclick, hasNote ? "View note" : "Add note", {
    active: hasNote,
  })
}

function contactsChip(onclick, count, attrs) {
  return cellChip("contacts", onclick, count ? `${count} contacts` : "Add contact", {
    count,
    active: !!count,
    attrs,
  })
}

/* Tooltips for [data-tooltip] live on <body> so scrollable tables can't clip them. */
let uiTipEl = null
let uiTipAnchor = null

function positionUiTooltip() {
  if (!uiTipEl || !uiTipAnchor) return
  if (!uiTipAnchor.isConnected) {
    hideUiTooltip()
    return
  }
  const pad = 8
  const gap = 8
  const anchor = uiTipAnchor.getBoundingClientRect()
  const tip = uiTipEl.getBoundingClientRect()
  let top = anchor.top - tip.height - gap
  const below = top < pad
  if (below) top = anchor.bottom + gap
  const centered = anchor.left + anchor.width / 2 - tip.width / 2
  const left = Math.max(pad, Math.min(centered, window.innerWidth - tip.width - pad))
  uiTipEl.style.top = `${Math.round(top)}px`
  uiTipEl.style.left = `${Math.round(left)}px`
  uiTipEl.classList.toggle("below", below)
  const caret = Math.max(
    10,
    Math.min(anchor.left + anchor.width / 2 - left, tip.width - 10)
  )
  uiTipEl.style.setProperty("--tip-caret", `${Math.round(caret)}px`)
}

function showUiTooltip(anchor) {
  const label = anchor.getAttribute("data-tooltip")
  if (!label) return
  if (!uiTipEl) {
    uiTipEl = document.createElement("div")
    uiTipEl.className = "ui-tooltip"
    uiTipEl.setAttribute("role", "tooltip")
    document.body.appendChild(uiTipEl)
  }
  uiTipAnchor = anchor
  uiTipEl.textContent = label
  uiTipEl.classList.add("show")
  positionUiTooltip()
}

function hideUiTooltip() {
  uiTipAnchor = null
  if (uiTipEl) uiTipEl.classList.remove("show")
}

document.addEventListener("mouseover", (e) => {
  const target = e.target && e.target.closest ? e.target.closest("[data-tooltip]") : null
  if (target === uiTipAnchor) return
  if (target) showUiTooltip(target)
  else hideUiTooltip()
})

document.addEventListener("focusin", (e) => {
  const target = e.target && e.target.closest ? e.target.closest("[data-tooltip]") : null
  if (target) showUiTooltip(target)
})

document.addEventListener("focusout", hideUiTooltip)
document.addEventListener("mouseleave", hideUiTooltip)
document.addEventListener("click", hideUiTooltip, true)
window.addEventListener("scroll", hideUiTooltip, true)
window.addEventListener("resize", hideUiTooltip)
let rowActionsTarget = null

function rowActionEdit(event, company, id) {
  event.stopPropagation()
  rowActionsTarget = { company: String(company).replace(/&#39;/g, "'"), id }
  handleRowActionEdit()
}

function rowActionDelete(event, company, id) {
  event.stopPropagation()
  rowActionsTarget = { company: String(company).replace(/&#39;/g, "'"), id }
  handleRowActionDelete()
}

window.rowActionButton = rowActionButton
window.rowActionEdit = rowActionEdit
window.rowActionDelete = rowActionDelete

function ensureRowActionsMenu() {
  if (document.getElementById("row-actions-menu")) return
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="row-actions-menu" style="display:none;position:fixed;z-index:9999;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.12);min-width:130px;overflow:hidden">
    <button onclick="handleRowActionEdit()" style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:.76rem;color:#0f172a">✏️ Edit</button>
    <button onclick="handleRowActionDelete()" style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:.76rem;color:#dc2626;border-top:1px solid #f1f5f9">🗑️ Delete</button>
  </div>`,
  )
}
function openRowActions(event, company, id) {
  event.stopPropagation()
  ensureRowActionsMenu()
  rowActionsTarget = { company: company.replace(/&#39;/g, "'"), id }
  const menu = document.getElementById("row-actions-menu")
  const rect = event.target.getBoundingClientRect()
  positionPopover(menu, rect)
  menu.style.display = "block"
}
document.addEventListener("click", (e) => {
  const menu = document.getElementById("row-actions-menu")
  if (menu && menu.style.display !== "none" && !menu.contains(e.target))
    menu.style.display = "none"
})
function closeRowActionsMenu() {
  const menu = document.getElementById("row-actions-menu")
  if (menu) menu.style.display = "none"
}
function handleRowActionEdit() {
  closeRowActionsMenu()
  if (!rowActionsTarget) return
  const row = RAW_BASE.find((r) => r._id === rowActionsTarget.id)
  if (!row) {
    nsToast(
      "This row has no database id — refresh the page and try again.",
      "error",
    )
    return
  }
  openAddCompany(row)
}
async function handleRowActionDelete() {
  closeRowActionsMenu()
  if (!rowActionsTarget) return
  const { company, id } = rowActionsTarget
  if (!id) {
    nsToast(
      "This row has no database id — refresh the page and try again.",
      "error",
    )
    return
  }
  const confirmed = await nsConfirmDelete({
    title: "Remove this company?",
    text: '"' + company + '" will be removed from the pipeline.',
    confirmButtonText: "Yes, remove it",
  })
  if (confirmed) deleteCompanyById(id)
}
async function deleteCompanyById(id) {
  try {
    const row = RAW_BASE.find((r) => r._id === id)
    await window.NsApi.deleteCompany(id)
    if (row) {
      const snap = {
        _id: row._id,
        company: row.company || "",
        country: row.country || "",
        stage: getStage(row) || "",
        month: row.month || "",
        deleted_at: Date.now(),
      }
      trashedCompanies = [
        snap,
        ...trashedCompanies.filter((t) => t._id !== snap._id),
      ]
      saveTrashedCompanies()
      const nk = (row.company || "").toLowerCase().trim()
      if (nk) {
        deletedCos[nk] = true
        saveDeleted()
      }
    }
    RAW_BASE = RAW_BASE.filter((r) => r._id !== id)
    applyFilters(true)
    updatePipelineTrashCount()
    nsToast("Company moved to trash")
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Delete failed", "error")
  }
}

function renderPageNumbers(total) {
  const container = document.getElementById("page-btns")
  if (!container) return
  const totalPages = Math.ceil(total / PER_PAGE) || 1
  let html =
    '<button class="pb" id="pprev" onclick="changePage(-1)"' +
    (page === 1 ? " disabled" : "") +
    ">← Prev</button>"
  const pages = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push("...")
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    )
      pages.push(i)
    if (page < totalPages - 2) pages.push("...")
    pages.push(totalPages)
  }
  pages.forEach((p) => {
    if (p === "...") html += '<span class="page-ellipsis">…</span>'
    else
      html +=
        '<button class="page-num' +
        (p === page ? " active" : "") +
        '" onclick="goToPage(' +
        p +
        ')">' +
        p +
        "</button>"
  })
  html +=
    '<button class="pb" id="pnext" onclick="changePage(1)"' +
    (page >= totalPages ? " disabled" : "") +
    ">Next →</button>"
  container.innerHTML = html
}

function goToPage(p) {
  page = p
  renderTable()
  document.getElementById("pipeline-scroll").scrollTop = 0
}

function saveFollowUps() {
  localStorage.setItem("ns_followups", JSON.stringify(followUps))
}
function saveContacts() {
  localStorage.setItem("ns_contacts", JSON.stringify(contacts))
}
function saveFieldEdits() {
  localStorage.setItem("ns_field_edits", JSON.stringify(fieldEdits))
}
function saveCallLog() {
  localStorage.setItem("ns_calls", JSON.stringify(callLog))
}
function saveDeleted() {
  localStorage.setItem("ns_deleted", JSON.stringify(deletedCos))
}
function saveTrashedCompanies() {
  localStorage.setItem("ns_trashed_cos", JSON.stringify(trashedCompanies))
}
function updatePipelineTrashCount() {
  /* count badge removed from UI */
}
function getSelectedTrashIndexes() {
  return Array.from(
    document.querySelectorAll(
      "#pipeline-trash-list .pipeline-trash-item-check:checked",
    ),
  ).map((el) => Number(el.value))
}
function updatePipelineTrashSelectionUi() {
  const selectAll = document.getElementById("pipeline-trash-select-all")
  const toolbar = document.getElementById("pipeline-trash-toolbar")
  const countEl = document.getElementById("pipeline-trash-selected-count")
  const deleteBtn = document.getElementById(
    "pipeline-trash-delete-selected-btn",
  )
  const checks = Array.from(
    document.querySelectorAll(
      "#pipeline-trash-list .pipeline-trash-item-check",
    ),
  )
  const selected = checks.filter((c) => c.checked)
  const hasItems = checks.length > 0

  if (toolbar) toolbar.hidden = !hasItems
  if (selectAll) {
    selectAll.checked = hasItems && selected.length === checks.length
    selectAll.indeterminate =
      selected.length > 0 && selected.length < checks.length
  }
  if (countEl) {
    countEl.textContent = selected.length ? `${selected.length} selected` : ""
  }
  if (deleteBtn) deleteBtn.disabled = selected.length === 0

  document
    .querySelectorAll("#pipeline-trash-list .pipeline-trash-item")
    .forEach((row) => {
      const check = row.querySelector(".pipeline-trash-item-check")
      row.classList.toggle("is-selected", !!(check && check.checked))
    })
}
function togglePipelineTrashSelectAll(checked) {
  document
    .querySelectorAll("#pipeline-trash-list .pipeline-trash-item-check")
    .forEach((el) => {
      el.checked = !!checked
    })
  updatePipelineTrashSelectionUi()
}
function togglePipelineTrashItem() {
  updatePipelineTrashSelectionUi()
}
function openPipelineTrash() {
  const modal = document.getElementById("pipeline-trash-modal")
  const list = document.getElementById("pipeline-trash-list")
  if (!modal || !list) return
  if (!trashedCompanies.length) {
    list.innerHTML =
      '<div style="padding:28px 12px;text-align:center;color:#94a3b8;font-size:.875rem">Trash is empty</div>'
  } else {
    list.innerHTML = trashedCompanies
      .map((item, idx) => {
        const name = esc(item.company || "Untitled")
        const meta = [item.country, item.stage, item.month]
          .filter(Boolean)
          .map(esc)
          .join(" · ")
        return `<div class="pipeline-trash-item">
          <input type="checkbox" class="pipeline-trash-item-check" value="${idx}" aria-label="Select ${name}" onchange="togglePipelineTrashItem()" />
          <div class="pipeline-trash-item-main">
            <div class="pipeline-trash-item-name">${name}</div>
            ${meta ? `<div class="pipeline-trash-item-meta">${meta}</div>` : ""}
          </div>
          <button type="button" class="pipeline-trash-restore" onclick="restoreTrashedCompany(${idx})">Restore</button>
        </div>`
      })
      .join("")
  }
  modal.classList.add("open")
  updatePipelineTrashSelectionUi()
  updatePipelineTrashCount()
}
function closePipelineTrash() {
  const modal = document.getElementById("pipeline-trash-modal")
  if (modal) modal.classList.remove("open")
}
async function restoreTrashedCompany(idx) {
  const item = trashedCompanies[idx]
  if (!item) return
  try {
    if (item._id && window.NsApi) {
      // Soft-deleted API rows: pull back by reloading with deleted included,
      // then clear local hide flags. If still missing, recreate is not attempted.
      const res = await window.NsApi.listCompanies({
        page: 1,
        per_page: 200,
        include_deleted: 1,
      })
      const found = ((res && res.items) || []).find(
        (r) => Number(r.id) === Number(item._id),
      )
      if (found && window.NsApi.updateCompany) {
        try {
          await window.NsApi.updateCompany(item._id, { is_deleted: 0 })
        } catch (_) {
          /* some backends restore by omitting soft-delete only */
        }
      }
      const companies = await loadCompaniesFromApi()
      RAW_BASE = companies
    }
    const nk = (item.company || "").toLowerCase().trim()
    if (nk && deletedCos[nk]) {
      delete deletedCos[nk]
      saveDeleted()
    }
    trashedCompanies.splice(idx, 1)
    saveTrashedCompanies()
    populate()
    applyFilters(true)
    openPipelineTrash()
    updatePipelineTrashCount()
    nsToast("Company restored")
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Restore failed", "error")
  }
}
async function deleteSelectedTrashedCompanies() {
  const indexes = getSelectedTrashIndexes().sort((a, b) => b - a)
  if (!indexes.length) return
  const confirmed = await nsConfirmDelete({
    title:
      indexes.length === 1
        ? "Permanently delete this company?"
        : `Permanently delete ${indexes.length} companies?`,
    text: "This can't be undone — the items will be removed from trash for good.",
    confirmButtonText: "Yes, delete permanently",
  })
  if (!confirmed) return
  indexes.forEach((idx) => {
    if (idx >= 0 && idx < trashedCompanies.length) {
      trashedCompanies.splice(idx, 1)
    }
  })
  saveTrashedCompanies()
  openPipelineTrash()
  updatePipelineTrashCount()
  nsToast(
    indexes.length === 1
      ? "Company permanently deleted"
      : `${indexes.length} companies permanently deleted`,
  )
}
function saveExtraMonths() {
  localStorage.setItem("ns_extra_months", JSON.stringify(extraMonths))
}

// MONTH PICKER
let monthPickerTarget = ""
let monthPickerMode = "pipeline" // "pipeline" | "lead"
let monthPickerLeadId = null
let monthPickerSelected = new Set()
let monthPickerPrimary = ""

function openMonthPicker(event, company) {
  event.stopPropagation()
  monthPickerMode = "pipeline"
  monthPickerLeadId = null
  monthPickerTarget = company.replace(/&#39;/g, "'")
  const nk = monthPickerTarget.toLowerCase().trim()
  const pop = document.getElementById("month-picker-pop")
  // Collect every real month this company has (API rows + local extras)
  const rawMonths = RAW_BASE.filter(
    (r) => r.company.toLowerCase().trim() === nk,
  )
    .map((r) => r.month)
    .filter(isValidMonthLabel)
  const allCos = getAllCompanies()
  const rec = allCos.find((r) => r.company.toLowerCase().trim() === nk)
  const fromRec = (rec && rec._all_months ? rec._all_months : []).filter(
    isValidMonthLabel,
  )
  const extra = (extraMonths[nk] || []).filter(isValidMonthLabel)
  const selected = new Set([...rawMonths, ...fromRec, ...extra])
  if (rec && isValidMonthLabel(rec.month)) selected.add(rec.month)
  const curPrimary = (rec && rec.month) || ""
  initMonthPickerState(selected, curPrimary)
  fillMonthPickerList()
  positionMonthPickerPop(pop, event.target.getBoundingClientRect())
}

/** Same SELECT MONTHS UI as Pipeline, wired to a potential lead. */
function openLeadMonthPicker(event, leadId) {
  event.stopPropagation()
  monthPickerMode = "lead"
  monthPickerLeadId = leadId
  monthPickerTarget = ""
  const lead = potentialLeads.find((l) => sameLeadId(l.id, leadId))
  if (!lead) return
  const extras = leadExtras[leadId] || {}
  const selected = new Set(
    [
      ...(Array.isArray(extras.months) ? extras.months : []),
      lead.month,
      extras.month,
      ...(Array.isArray(lead._all_months) ? lead._all_months : []),
    ].filter(isValidMonthLabel),
  )
  if (!selected.size) {
    const now = monthLabelNow()
    if (isValidMonthLabel(now)) selected.add(now)
  }
  const curPrimary =
    (isValidMonthLabel(lead.month) && lead.month) ||
    (isValidMonthLabel(extras.month) && extras.month) ||
    [...selected][0] ||
    ""
  initMonthPickerState(selected, curPrimary)
  fillMonthPickerList()
  positionMonthPickerPop(
    document.getElementById("month-picker-pop"),
    event.currentTarget.getBoundingClientRect(),
  )
}
window.openLeadMonthPicker = openLeadMonthPicker

function initMonthPickerState(selected, curPrimary) {
  monthPickerSelected = new Set(selected)
  monthPickerPrimary = curPrimary || ""
}

function syncMonthPickerChecksFromDom() {
  document
    .querySelectorAll("#month-picker-list input[type=checkbox]")
    .forEach((cb) => {
      if (cb.checked) monthPickerSelected.add(cb.value)
      else monthPickerSelected.delete(cb.value)
    })
}

function updateMonthPickerHint() {
  const hint = document.getElementById("month-picker-selected-hint")
  if (!hint) return
  const n = monthPickerSelected.size
  if (!n) {
    hint.textContent = "No months selected"
    return
  }
  const years = [
    ...new Set(
      [...monthPickerSelected].map((m) => {
        const p = parseMonthLabel(m)
        return p ? p.getFullYear() : null
      }),
    ),
  ]
    .filter((y) => y != null)
    .sort((a, b) => a - b)
  hint.textContent =
    n === 1
      ? `1 month selected${years.length ? ` (${years[0]})` : ""}`
      : `${n} months selected${years.length ? ` · ${years.join(", ")}` : ""}`
}

function fillMonthPickerList() {
  const list = document.getElementById("month-picker-list")
  if (!list) return

  list.innerHTML = getMonthOptions()
    .map((m) => {
      const checked = monthPickerSelected.has(m)
      return `
    <label class="month-pick-row${checked ? " is-checked" : ""}" style="display:flex;align-items:center;gap:7px;padding:4px 0;cursor:pointer;font-size:.76rem;color:#334155">
      <input type="checkbox" value="${esc(m)}"${checked ? " checked" : ""}
        onchange="onMonthPickerToggle(this)"
        style="accent-color:#008E9C;width:13px;height:13px;cursor:pointer">
      <span>${esc(m)}</span>${m === monthPickerPrimary ? '<span style="font-size:.6rem;color:#2563eb;margin-left:4px">(primary)</span>' : ""}
    </label>`
    })
    .join("")
  updateMonthPickerHint()
}

function onMonthPickerToggle(cb) {
  if (!cb) return
  if (cb.checked) monthPickerSelected.add(cb.value)
  else monthPickerSelected.delete(cb.value)
  const row = cb.closest("label")
  if (row) row.classList.toggle("is-checked", cb.checked)
  updateMonthPickerHint()
}
window.onMonthPickerToggle = onMonthPickerToggle

function positionMonthPickerPop(pop, rect) {
  const list = document.getElementById("month-picker-list")
  const pad = 12
  const chrome = 120
  const spaceBelow = window.innerHeight - rect.bottom - pad
  const spaceAbove = rect.top - pad
  const maxList = Math.min(
    280,
    Math.max(140, Math.max(spaceBelow, spaceAbove) - chrome),
  )
  if (list) list.style.maxHeight = maxList + "px"
  positionPopover(pop, rect)
  requestAnimationFrame(() => {
    if (!list) return
    const anchor =
      list.querySelector(`input[value="${CSS.escape(monthPickerPrimary)}"]`) ||
      list.querySelector("input:checked")
    if (anchor) anchor.closest("label")?.scrollIntoView({ block: "center" })
  })
}

function lookupId(list, nameField, name) {
  const m = list.find((x) => x[nameField] === name)
  return m ? m.id : null
}
let extraMonthRowId = {} // "nk|month" -> real companies.id created via this picker

function saveLeadMonthPicker(checked) {
  const leadId = monthPickerLeadId
  const lead = potentialLeads.find((l) => sameLeadId(l.id, leadId))
  if (!lead) {
    document.getElementById("month-picker-pop").style.display = "none"
    return
  }
  const sorted = checked
    .slice()
    .sort((a, b) => (MONTH_ORDER[a] ?? 99) - (MONTH_ORDER[b] ?? 99))
  const prevPrimary = isValidMonthLabel(lead.month) ? lead.month : ""
  const primary =
    (prevPrimary && sorted.includes(prevPrimary) && prevPrimary) ||
    sorted[0] ||
    ""
  const extras = { ...(leadExtras[leadId] || {}) }
  extras.month = primary
  extras.months = sorted
  if (sorted.length) delete extras.monthless
  else extras.monthless = true
  // Mirror pipeline: 2+ months ⇒ Retargeted
  if (sorted.length >= 2) {
    extras.stage = "Retargeted"
    extras.is_retarget = true
  } else if (extras.stage === "Retargeted" || extras.is_retarget) {
    extras.stage = "Email Outreach"
    extras.is_retarget = false
  }
  leadExtras[leadId] = extras
  saveLeadExtras()

  lead.month = primary
  lead._all_months = sorted
  if (extras.stage) lead.stage = extras.stage

  document.getElementById("month-picker-pop").style.display = "none"
  monthPickerMode = "pipeline"
  monthPickerLeadId = null
  renderLeads()
  nsToast(
    !sorted.length
      ? "Months cleared — lead kept"
      : sorted.length >= 2
        ? "Months updated — stage set to Retargeted"
        : "Months updated — stage set to Email Outreach",
  )
}

async function saveCompanyWithoutMonths() {
  const nk = monthPickerTarget.toLowerCase().trim()
  const companyRows = RAW_BASE.filter(
    (r) => (r.company || "").toLowerCase().trim() === nk,
  )
  const keeper = companyRows[0]
  if (!keeper) {
    document.getElementById("month-picker-pop").style.display = "none"
    return
  }

  const emailStageId = lookupId(
    NS_LOOKUPS.stages,
    "status_name",
    "Email Outreach",
  )
  const wasRetargeted = getStage(keeper) === "Retargeted"

  try {
    // Keep one company record alive and make it explicitly monthless.
    if (keeper._id && window.NsApi) {
      await window.NsApi.updateCompany(keeper._id, {
        month: null,
        ...(wasRetargeted && emailStageId ? { stage_id: emailStageId } : {}),
        is_retarget: 0,
      })
    }

    // Other rows represent additional month tags; remove only those duplicates.
    for (const row of companyRows.slice(1)) {
      if (row._id && window.NsApi) await window.NsApi.deleteCompany(row._id)
    }

    const removedRows = new Set(companyRows.slice(1))
    RAW_BASE = RAW_BASE.filter((r) => !removedRows.has(r))
    keeper.month = ""
    keeper._all_months = []
    keeper.is_retarget = false
    if (wasRetargeted) keeper.stage = "Email Outreach"

    delete extraMonths[nk]
    Object.keys(extraMonthRowId).forEach((key) => {
      if (key.startsWith(nk + "|")) delete extraMonthRowId[key]
    })
    saveExtraMonths()

    document.getElementById("month-picker-pop").style.display = "none"
    applyFilters(true)
    nsToast("Months cleared — company kept in pipeline")
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Update failed", "error")
  }
}

async function saveMonthPicker() {
  syncMonthPickerChecksFromDom()
  const checked = [...monthPickerSelected]
    .filter(isValidMonthLabel)
    .sort((a, b) => (MONTH_ORDER[a] ?? 99) - (MONTH_ORDER[b] ?? 99))
  if (!checked.length) {
    if (monthPickerMode === "lead") {
      saveLeadMonthPicker([])
      return
    }
    await saveCompanyWithoutMonths()
    return
  }
  if (monthPickerMode === "lead") {
    saveLeadMonthPicker(checked)
    return
  }
  const nk = monthPickerTarget.toLowerCase().trim()
  const companyRows = RAW_BASE.filter(
    (r) => r.company.toLowerCase().trim() === nk,
  )
  const rec = companyRows[0]
  if (!rec) {
    document.getElementById("month-picker-pop").style.display = "none"
    return
  }
  const rawMonths = new Set(
    companyRows.map((r) => r.month).filter(isValidMonthLabel),
  )
  const previousExtra = extraMonths[nk] || []
  const toCreate = checked.filter(
    (m) => !rawMonths.has(m) && !extraMonthRowId[nk + "|" + m],
  )
  // Extra-only tags that were unchecked
  const toRemoveExtra = [
    ...new Set([
      ...previousExtra,
      ...Object.keys(extraMonthRowId)
        .filter((k) => k.startsWith(nk + "|"))
        .map((k) => k.slice(nk.length + 1)),
    ]),
  ].filter((m) => !checked.includes(m) && !rawMonths.has(m))

  // Real DB month-rows that were unchecked (keep at least one / primary if possible)
  const primaryMonth = rec.month
  const toRemoveRaw = companyRows.filter(
    (r) =>
      isValidMonthLabel(r.month) &&
      !checked.includes(r.month) &&
      r.month !== primaryMonth &&
      r._id,
  )
  // If primary was unchecked but another checked month remains, drop primary row too
  const primaryUnchecked =
    primaryMonth &&
    !checked.includes(primaryMonth) &&
    checked.length >= 1 &&
    companyRows.length > 1
  const primaryRowToRemove = primaryUnchecked
    ? companyRows.find((r) => r.month === primaryMonth && r._id)
    : null

  const countryId = lookupId(NS_LOOKUPS.countries, "country_name", rec.country)
  const mgmtId = lookupId(NS_LOOKUPS.mgmt_types, "type_name", rec.mgmt_type)
  const nextStageName = checked.length >= 2 ? "Retargeted" : "Email Outreach"
  const stageId =
    lookupId(NS_LOOKUPS.stages, "status_name", nextStageName) ||
    lookupId(NS_LOOKUPS.stages, "status_name", rec.stage)

  try {
    for (const m of toCreate) {
      const created = await window.NsApi.createCompany({
        company_name: rec.company,
        country_id: countryId,
        mgmt_type_id: mgmtId,
        stage_id: stageId,
        month: m,
        is_retarget: checked.length >= 2 ? 1 : 0,
      })
      extraMonthRowId[nk + "|" + m] = created.id
      RAW_BASE.push({
        _id: created.id,
        code: created.company_code || "",
        company: rec.company,
        country: rec.country,
        mgmt_type: rec.mgmt_type,
        status: "",
        stage: nextStageName,
        month: m,
        date: created.week_label || "",
        reply_status: "",
        is_retarget: checked.length >= 2,
      })
    }
    for (const m of toRemoveExtra) {
      const rid = extraMonthRowId[nk + "|" + m]
      if (rid) {
        await window.NsApi.deleteCompany(rid)
        RAW_BASE = RAW_BASE.filter((r) => r._id !== rid)
        delete extraMonthRowId[nk + "|" + m]
      }
    }
    const rawDeletes = [
      ...toRemoveRaw,
      ...(primaryRowToRemove ? [primaryRowToRemove] : []),
    ]
    for (const row of rawDeletes) {
      await window.NsApi.deleteCompany(row._id)
      RAW_BASE = RAW_BASE.filter((r) => r._id !== row._id)
      delete extraMonthRowId[nk + "|" + row.month]
    }

    // Sync stage on remaining rows: 2+ months → Retargeted, 1 month → Email Outreach
    const remaining = RAW_BASE.filter(
      (r) => r.company.toLowerCase().trim() === nk,
    )
    for (const row of remaining) {
      row.stage = nextStageName
      row.is_retarget = checked.length >= 2
      if (row._id && stageId) {
        try {
          await window.NsApi.updateCompany(row._id, {
            stage_id: stageId,
            is_retarget: checked.length >= 2 ? 1 : 0,
          })
        } catch (e) {
          /* best-effort stage sync */
        }
      }
    }

    delete extraMonths[nk]
    saveExtraMonths()
    document.getElementById("month-picker-pop").style.display = "none"
    applyFilters(true)
    nsToast(
      checked.length >= 2
        ? "Months updated — stage set to Retargeted"
        : "Months updated — stage set to Email Outreach",
    )
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Update failed", "error")
  }
}
document.addEventListener("click", (e) => {
  const pop = document.getElementById("month-picker-pop")
  if (pop && pop.style.display !== "none" && !pop.contains(e.target))
    pop.style.display = "none"
})
async function deleteCompany(company) {
  const co = company.replace(/&#39;/g, "'")
  const nk = co.toLowerCase().trim()
  const confirmed = await nsConfirmDelete({
    title: "Remove this company?",
    text: `"${co}" will be hidden from your dashboard. You can restore it from the trash bin.`,
    confirmButtonText: "Yes, remove it",
  })
  if (!confirmed) return
  deletedCos[nk] = true
  saveDeleted()
  const row = RAW_BASE.find(
    (r) => (r.company || "").toLowerCase().trim() === nk,
  )
  if (row) {
    trashedCompanies = [
      {
        _id: row._id || null,
        company: row.company || co,
        country: row.country || "",
        stage: getStage(row) || "",
        month: row.month || "",
        deleted_at: Date.now(),
      },
      ...trashedCompanies.filter(
        (t) => (t.company || "").toLowerCase().trim() !== nk,
      ),
    ]
    saveTrashedCompanies()
  }
  populate()
  applyFilters()
  updatePipelineTrashCount()
}

function isCall(nk) {
  return !!callActivityIdByCompany[nk]
}

/**
 * Rebuild company key → latest Call activity id from `comms`, so the Pipeline
 * "Call" column, the Calls KPI and the Weekly Tracker all read one source.
 * Companies are resolved by company_id first and by stored name second, and the
 * index is derived from `comms` rather than only from a live response, so a
 * failed activities request can't leave the pipeline thinking nobody was called.
 */
function rebuildCallIndexFromComms() {
  const map = {}
  ;(comms || [])
    .filter(
      (c) =>
        c &&
        !c.synthetic &&
        c.type === "call" &&
        c.id !== null &&
        c.id !== undefined,
    )
    // Newest first, so the first entry seen per company is the one to unlog
    .sort(
      (a, b) =>
        (Number(b.ts) || 0) - (Number(a.ts) || 0) ||
        (Number(b.id) || 0) - (Number(a.id) || 0),
    )
    .forEach((c) => {
      const row = findCompanyRowById(c.company_id)
      const nk = (row ? row.company : c.company || "").toLowerCase().trim()
      if (!nk || map[nk] !== undefined) return
      map[nk] = c.id
    })
  callActivityIdByCompany = map
}

/**
 * Number of Call rows from the activities table, optionally limited to an
 * inclusive {fromStr, toStr} day range. This is the same unit the Weekly
 * Tracker "Calls" tab lists — every logged call, including calls whose company
 * is no longer in the pipeline and repeat calls on the same company.
 */
function countCallActivities(range) {
  const counted = new Set()
  ;(comms || []).forEach((c) => {
    if (!c || c.synthetic || c.type !== "call" || !c.date) return
    if (range) {
      if (range.fromStr && c.date < range.fromStr) return
      if (range.toStr && c.date > range.toStr) return
    }
    const key =
      c.id !== null && c.id !== undefined
        ? "id:" + c.id
        : [c.company_id, c.date, c.text].join("|")
    if (counted.has(key)) return
    counted.add(key)
  })
  return counted.size
}

/**
 * Company keys with at least one logged call, optionally limited to an
 * inclusive {fromStr, toStr} day range. Without a range this is exactly what
 * the pipeline "Call" column reads (isCall), so the Calls KPI count and the
 * rows its filter shows can't disagree.
 */
function callCompanyKeys(range) {
  if (!range) return new Set(Object.keys(callActivityIdByCompany || {}))
  const keys = new Set()
  ;(comms || []).forEach((c) => {
    if (!c || c.synthetic || c.type !== "call" || !c.date) return
    if (range.fromStr && c.date < range.fromStr) return
    if (range.toStr && c.date > range.toStr) return
    const row = findCompanyRowById(c.company_id)
    const nk = (row ? row.company : c.company || "").toLowerCase().trim()
    if (nk) keys.add(nk)
  })
  return keys
}

function logToTracker(company, type, text, extra) {
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const entry = {
    id: (extra && extra.id) || Date.now(),
    company_id: extra && extra.company_id,
    company,
    type,
    text,
    date: (extra && extra.date) || today,
    ts: Date.now(),
    timeStr: formatActivityTime(now.toISOString()),
  }
  comms.unshift(entry)
  saveComms()
  if (document.getElementById("panel-weekly")) renderWeekly()
}

async function toggleCall(company) {
  const co = company.replace(/&#39;/g, "'")
  const nk = co.toLowerCase().trim()
  const companyId = resolveCompanyId(co)
  if (!companyId) {
    nsToast(
      "This row has no database id — refresh the page and try again.",
      "error",
    )
    return
  }
  try {
    if (callActivityIdByCompany[nk]) {
      const delId = callActivityIdByCompany[nk]
      await window.NsApi.deleteActivity(delId)
      delete callActivityIdByCompany[nk]
      comms = comms.filter((c) => c.id !== delId)
      saveComms()
      if (document.getElementById("panel-weekly")) renderWeekly()
    } else {
      const created = await window.NsApi.createActivity({
        company_id: companyId,
        activity_type: "Call",
        notes: "Call logged from pipeline",
      })
      callActivityIdByCompany[nk] = created.id
      logToTracker(co, "call", "Call logged from pipeline", {
        id: created.id,
        company_id: companyId,
      })
    }
    renderTable()
    updateKPIs()
    if (typeof renderDashboardCharts === "function") renderDashboardCharts()
    if (typeof renderAnalytics === "function" && document.getElementById("chart-stage"))
      renderAnalytics()
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Update failed", "error")
  }
}

// Last contacted: pull from comms log
function lastContactedDate(nk) {
  const entries = comms.filter(
    (c) => c.company && c.company.toLowerCase().trim() === nk,
  )
  if (!entries.length) return null
  const latest = entries.sort((a, b) => b.date.localeCompare(a.date))[0]
  const d = new Date(latest.date)
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

// Follow-up setter (inline date picker)
let fuTarget = ""
let fuMode = "pipeline" // "pipeline" | "lead"
let fuLeadId = null

function openFuPop(event, existing) {
  const inp = document.getElementById("fu-picker")
  inp.value = existing || ""
  const rect = (event.currentTarget || event.target).getBoundingClientRect()
  positionPopover(document.getElementById("fu-pop"), rect)
  inp.focus()
}

function setFollowUp(company, event) {
  event.stopPropagation()
  fuMode = "pipeline"
  fuLeadId = null
  fuTarget = company.replace(/&#39;/g, "'").toLowerCase().trim()
  openFuPop(event, followUps[fuTarget] || "")
}

/** Same follow-up date popover as Pipeline, wired to a potential lead. */
function setLeadFollowUp(leadId, event) {
  event.stopPropagation()
  fuMode = "lead"
  fuLeadId = leadId
  fuTarget = ""
  const lead = potentialLeads.find((l) => sameLeadId(l.id, leadId))
  openFuPop(event, (lead && lead.followup) || "")
}
window.setLeadFollowUp = setLeadFollowUp

function saveLeadFU(v) {
  const leadId = fuLeadId
  const lead = potentialLeads.find((l) => sameLeadId(l.id, leadId))
  document.getElementById("fu-pop").style.display = "none"
  fuMode = "pipeline"
  fuLeadId = null
  if (!lead) return
  const extras = { ...(leadExtras[leadId] || {}) }
  if (v) extras.followup = v
  else delete extras.followup
  leadExtras[leadId] = extras
  saveLeadExtras()
  lead.followup = v || ""
  renderLeads()
  nsToast(v ? "Follow-up saved" : "Follow-up cleared")
}

async function saveFU() {
  const v = document.getElementById("fu-picker").value
  if (fuMode === "lead") {
    if (!v) {
      saveLeadFU("")
      return
    }
    saveLeadFU(v)
    return
  }
  if (!v) {
    await clearFU()
    return
  }
  const companyId = resolveCompanyId(fuTarget)
  if (!companyId) {
    nsToast(
      "This row has no database id — refresh the page and try again.",
      "error",
    )
    return
  }
  try {
    const existingId = followUpIdByCompany[fuTarget]
    if (existingId) {
      await window.NsApi.updateFollowUp(existingId, { due_date: v })
    } else {
      const created = await window.NsApi.upsertFollowUp({
        company_id: companyId,
        due_date: v,
      })
      followUpIdByCompany[fuTarget] = created.id
    }
    followUps[fuTarget] = v
    document.getElementById("fu-pop").style.display = "none"
    renderTable()
    updateKPIs()
    nsToast("Follow-up saved")
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Save failed", "error")
  }
}
async function clearFU() {
  if (fuMode === "lead") {
    saveLeadFU("")
    return
  }
  const existingId = followUpIdByCompany[fuTarget]
  try {
    if (existingId) await window.NsApi.deleteFollowUp(existingId)
    delete followUps[fuTarget]
    delete followUpIdByCompany[fuTarget]
    document.getElementById("fu-pop").style.display = "none"
    renderTable()
    updateKPIs()
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Clear failed", "error")
  }
}
document.addEventListener("click", (e) => {
  const pop = document.getElementById("fu-pop")
  if (pop && pop.style.display !== "none" && !pop.contains(e.target))
    pop.style.display = "none"
})

// KPI click filter
function kpiClick(filter) {
  if (kpiActiveFilter === filter) {
    kpiActiveFilter = ""
    document
      .querySelectorAll(".kpi.clickable")
      .forEach((k) => k.classList.remove("kpi-active"))
  } else {
    kpiActiveFilter = filter
    document
      .querySelectorAll(".kpi.clickable")
      .forEach((k) => k.classList.remove("kpi-active"))
    if (filter) {
      const map = {
        Retargeted: "kpi-ret",
        Call: "kpi-call",
        "Meeting / Positive": "kpi-pos",
        "Not Interested": "kpi-neg",
        __overdue__: "kpi-od",
      }
      if (map[filter])
        document.getElementById(map[filter]).classList.add("kpi-active")
    }
  }
  applyFilters()
  const main = document.getElementById("main-content")
  if (main && !main.classList.contains("view-pipeline")) {
    if (typeof window.__nsNavigate === "function")
      window.__nsNavigate("pipeline")
    else switchTab("pipeline")
  }
}

function updateKPIs() {
  // Dashboard: KPIs + charts follow the header date range.
  // Pipeline: full unique-company universe (table filters only affect #pinfo).
  const onDash = isDashboardPage()
  const all = onDash
    ? filterRowsByDashboardDate(getAllCompanies())
    : getAllCompanies()
  const rows = onDash
    ? getDashboardMetricCompanies()
    : getUniquePipelineCompanies()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const toEl =
    document.getElementById("hdate-to") || document.getElementById("hdate")
  const asOf = onDash && toEl ? parseDateInput(toEl) || today : today
  asOf.setHours(0, 0, 0, 0)

  // Retargeted within the (possibly date-scoped) row set
  const monthsByNk = {}
  all.forEach((r) => {
    const nk = r.company.toLowerCase().trim()
    if (!monthsByNk[nk]) monthsByNk[nk] = { months: new Set(), ret: false }
    if (isValidMonthLabel(r.month))
      monthsByNk[nk].months.add(String(r.month).trim())
    if (r.is_retarget) monthsByNk[nk].ret = true
  })
  const range = onDash ? getDashboardMonthRange() : null
  const retSet = new Set()
  Object.keys(monthsByNk).forEach((nk) => {
    const extra = (extraMonths[nk] || [])
      .filter(isValidMonthLabel)
      .map((m) => String(m).trim())
      .filter((m) => {
        if (!range) return true
        const ord = MONTH_ORDER[m]
        if (ord === undefined) return true
        if (range.fromOrd != null && ord < range.fromOrd) return false
        if (range.toOrd != null && ord > range.toOrd) return false
        return true
      })
    const monthTotal = new Set([...monthsByNk[nk].months, ...extra])
    if (monthTotal.size >= 2 || monthsByNk[nk].ret) retSet.add(nk)
  })
  if (!onDash) retargetedNKs = retSet

  const total = rows.length
  document.getElementById("k-total").textContent = total.toLocaleString()
  // Count what the Stage badge shows so the card matches the list you get
  // after clicking it
  const retCount = rows.filter((r) => getStage(r) === "Retargeted").length
  document.getElementById("k-ret").textContent = retCount
  // Companies called, so the card matches the list it opens. Weekly Tracker
  // only lists activities for active pipeline companies (same active set).
  const callKeys = callCompanyKeys(onDash ? getDashboardActivityRange() : null)
  const callCount = rows.filter((r) =>
    callKeys.has(r.company.toLowerCase().trim()),
  ).length
  document.getElementById("k-call").textContent = callCount
  const posCount = rows.filter(
    (r) => getStage(r) === "Meeting / Positive",
  ).length
  document.getElementById("k-pos").textContent = posCount
  const negCount = rows.filter((r) => getStage(r) === "Not Interested").length
  document.getElementById("k-neg").textContent = negCount
  const od = rows.filter((r) => {
    const nk = r.company.toLowerCase().trim()
    const fu = r._follow_up || followUps[nk] || ""
    if (!fu) return false
    const d = new Date(fu)
    d.setHours(0, 0, 0, 0)
    return d < asOf
  })
  const odCount = new Set(
    od.map((r) => r.company.toLowerCase().trim()).filter(Boolean),
  ).size
  document.getElementById("k-od").textContent = odCount
  document.getElementById("kpi-od").style.display = odCount ? "" : "none"
}

// DASHBOARD CHARTS
function renderDashboardCharts() {
  // Dashboard overview charts respect the header date filter so the stage
  // donut center matches date-scoped Total Companies.
  const companies = isDashboardPage()
    ? filterRowsByDashboardDate(getAllCompanies())
    : getAllCompanies()
  renderMetricCharts(
    {
      stage: "dash-chart-stage",
      country: "dash-chart-country",
      mgmt: "dash-chart-mgmt",
      month: "dash-chart-month",
    },
    { gradientId: "dash-lg", companies },
  )
}

// Chart hover tooltip — only on chart marks, kept inside the chart card
function ensureChartTip(host) {
  if (!host) return null
  let tip = host.querySelector(":scope > .chart-tip")
  if (!tip) {
    tip = document.createElement("div")
    tip.className = "chart-tip"
    tip.setAttribute("role", "tooltip")
    host.appendChild(tip)
  }
  return tip
}

function hideAllChartTips() {
  document
    .querySelectorAll(".chart-tip.show")
    .forEach((t) => t.classList.remove("show"))
  document
    .querySelectorAll(".tip-active")
    .forEach((el) => el.classList.remove("tip-active"))
}

function positionChartTip(tip, host, anchorEl, clientX, clientY) {
  if (!tip || !host) return
  const hostRect = host.getBoundingClientRect()
  const tipW = tip.offsetWidth || 180
  const tipH = tip.offsetHeight || 70
  const pad = 10
  let x, y
  if (anchorEl && anchorEl.getBoundingClientRect) {
    const r = anchorEl.getBoundingClientRect()
    x = r.left + r.width / 2 - hostRect.left - tipW / 2
    y = r.top - hostRect.top - tipH - 8
    if (y < pad) y = r.bottom - hostRect.top + 8
  } else {
    x = (clientX || 0) - hostRect.left + 12
    y = (clientY || 0) - hostRect.top + 12
  }
  x = Math.max(pad, Math.min(x, hostRect.width - tipW - pad))
  y = Math.max(pad, Math.min(y, hostRect.height - tipH - pad))
  tip.style.left = x + "px"
  tip.style.top = y + "px"
}

function showChartTip(host, anchorEl, html, clientX, clientY) {
  hideAllChartTips()
  const tip = ensureChartTip(host)
  if (!tip) return
  tip.innerHTML = html
  tip.classList.add("show")
  positionChartTip(tip, host, anchorEl, clientX, clientY)
}

function chartTipHtml(title, rows, color) {
  const items = (rows || [])
    .map(
      (r) =>
        `<div class="chart-tip-row"><span>${r[0]}</span><strong>${r[1]}</strong></div>`,
    )
    .join("")
  return `<div class="chart-tip-title">${color ? `<span class="chart-tip-dot" style="background:${color}"></span>` : ""}${title}</div>${items}`
}

function tipAttr(html) {
  return encodeURIComponent(html)
}

function bindChartTips(root) {
  if (!root) return
  const host = root.closest(".chart-card") || root
  if (getComputedStyle(host).position === "static")
    host.style.position = "relative"
  root.querySelectorAll("[data-tip]").forEach((el) => {
    el.addEventListener("mouseenter", (e) => {
      e.stopPropagation()
      let html = ""
      try {
        html = decodeURIComponent(el.getAttribute("data-tip") || "")
      } catch (_) {
        return
      }
      if (!html) return
      showChartTip(host, el, html, e.clientX, e.clientY)
      el.classList.add("tip-active")
    })
    el.addEventListener("mousemove", (e) => {
      e.stopPropagation()
      const tip = host.querySelector(":scope > .chart-tip")
      if (tip && tip.classList.contains("show"))
        positionChartTip(tip, host, el, e.clientX, e.clientY)
    })
    el.addEventListener("mouseleave", (e) => {
      e.stopPropagation()
      const tip = host.querySelector(":scope > .chart-tip")
      if (tip) tip.classList.remove("show")
      el.classList.remove("tip-active")
    })
  })
}

/** Shared metric charts used by Analytics and Dashboard (same visuals). */
function renderMetricCharts(ids, opts) {
  ids = ids || {}
  opts = opts || {}
  const gradientId = opts.gradientId || "analytics-lg"
  const stageId = ids.stage || "chart-stage"
  const countryId = ids.country || "chart-country"
  const mgmtId = ids.mgmt || "chart-mgmt"
  const monthId = ids.month || "chart-month"

  // opts.companies: optional pre-filtered rows (Dashboard date scope).
  // Analytics omits this and always uses the full company set.
  const all = opts.companies || getAllCompanies()
  const cos = dedupeCompaniesHighestStage(all)

  // 1. Pipeline by Stage — donut from active DB stages (no manual list)
  const stageOrder = getDashboardStageOptions()
  // Include any live stage on a row that isn't in lookups yet (legacy data)
  cos.forEach((r) => {
    const s = getStage(r)
    if (s && !stageOrder.includes(s)) stageOrder.push(s)
  })
  // "Call" on the donut must match the Calls KPI / pipeline Call column
  // (logged call activity), not the Stage field alone.
  const callKeys = callCompanyKeys(
    isDashboardPage() ? getDashboardActivityRange() : null,
  )
  if (callKeys.size && !stageOrder.includes("Call")) stageOrder.push("Call")
  const stageCols = {}
  stageOrder.forEach((s) => {
    stageCols[s] = s === "Email Outreach" ? "#008E9C" : stageDotColor(s)
  })
  const stageCounts = {}
  stageOrder.forEach((s) => (stageCounts[s] = 0))
  const fallbackStage = stageOrder.includes("Email Outreach")
    ? "Email Outreach"
    : stageOrder[0] || "Email Outreach"
  // Companies with a logged call → Call slice. Stale Stage="Call" without a
  // logged call falls back so the slice doesn't inflate past the KPI.
  cos.forEach((r) => {
    const nk = (r.company || "").toLowerCase().trim()
    let s = getStage(r)
    if (callKeys.has(nk)) s = "Call"
    else if (s === "Call") s = fallbackStage
    if (stageCounts[s] !== undefined) stageCounts[s]++
    else stageCounts[fallbackStage]++
  })
  const stageData = stageOrder
    .map((s) => ({ k: s, v: stageCounts[s] }))
    .filter((d) => d.v > 0)
  // Use unique company count so donut center matches #k-total for the same set
  const totalStages = cos.length
  const stageEl = document.getElementById(stageId)
  if (stageEl && !totalStages) {
    stageEl.innerHTML =
      '<div class="chart-empty" style="color:var(--text-muted);font-size:.8rem;padding:24px;text-align:center">No companies in this date range</div>'
  } else if (stageEl && totalStages) {
    const r = 54,
      cx = 70,
      cy = 70
    let angle = -Math.PI / 2
    const arcs = stageData
      .map((d) => {
        const pct = d.v / totalStages
        const sweep = pct * 2 * Math.PI
        const a0 = angle,
          a1 = angle + sweep
        angle = a1
        const x0 = cx + r * Math.cos(a0),
          y0 = cy + r * Math.sin(a0)
        const x1 = cx + r * Math.cos(a1),
          y1 = cy + r * Math.sin(a1)
        const large = sweep > Math.PI ? 1 : 0
        const tip = tipAttr(
          chartTipHtml(
            esc(d.k),
            [
              ["Companies", String(d.v)],
              ["Share", Math.round(pct * 100) + "%"],
              ["Of pipeline", d.v + " / " + totalStages],
            ],
            stageCols[d.k],
          ),
        )
        const dPath = `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
        return `<path d="${dPath}" fill="none" stroke="${stageCols[d.k]}" stroke-width="20" stroke-linecap="butt" pointer-events="none"/>
        <path class="donut-hit tip-target" data-tip="${tip}" d="${dPath}" fill="none" stroke="transparent" stroke-width="22"/>`
      })
      .join("")
    stageEl.innerHTML = `<div class="donut-chart analytics-donut-chart"><svg viewBox="0 0 140 140">${arcs}</svg>
      <div class="donut-center"><div class="donut-total">${totalStages}</div><div class="donut-label">Companies</div></div></div>
      <div class="donut-legend analytics-donut-legend">${stageData
        .map((d) => {
          const pct = Math.round((d.v / totalStages) * 100)
          return `<div class="donut-legend-item"><span class="donut-legend-dot" style="background:${stageCols[d.k]}"></span><span class="donut-legend-name">${esc(d.k)}</span><span class="donut-legend-val">${d.v}<em>${pct}%</em></span></div>`
        })
        .join("")}</div>`
  }

  // 2. Top Countries
  const countryCounts = {}
  cos.forEach((r) => {
    const c = getField(r, "country")
    if (c) countryCounts[c] = (countryCounts[c] || 0) + 1
  })
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => ({ k, v }))
  const countryEl = document.getElementById(countryId)
  if (countryEl && !topCountries.length) {
    countryEl.innerHTML =
      '<div class="chart-empty" style="color:var(--text-muted);font-size:.8rem;padding:24px;text-align:center">No companies in this date range</div>'
  } else if (countryEl) {
    const max = Math.max(...topCountries.map((d) => d.v), 1)
    const countryTotal =
      Object.values(countryCounts).reduce((a, b) => a + b, 0) || 1
    countryEl.innerHTML = `<div class="hbar-chart analytics-hbar">${topCountries
      .map((d, i) => {
        const pct = Math.round((d.v / countryTotal) * 100)
        const tip = tipAttr(
          chartTipHtml(
            esc(d.k),
            [
              ["Rank", "#" + (i + 1)],
              ["Companies", String(d.v)],
              ["Of all countries", pct + "%"],
            ],
            "#008E9C",
          ),
        )
        return `<div class="bar-row">
        <div class="bar-rank">${i + 1}</div>
        <div class="bar-label" title="${esc(d.k)}">${esc(d.k)}</div>
        <div class="bar-track"><div class="bar-fill tip-target" data-tip="${tip}" style="width:${Math.round((d.v / max) * 100)}%"></div></div>
        <div class="bar-val">${d.v}</div>
      </div>`
      })
      .join("")}</div>`
  }

  // 3. Management Type
  const activeMgmtNames = new Set(
    getDashboardMgmtTypeOptions().map((n) => n.toLowerCase()),
  )
  const mgmtCols = {
    Inhouse: "#008E9C",
    Outsourced: "#d97706",
    Both: "#7c3aed",
    Unsure: "#64748b",
    "Rotation Structure (Principal)": "#0ea5e9",
    "Officer Sourcing (Qualified)": "#22c55e",
    "Fixed Budget (Zero Overhead)": "#f43f5e",
  }
  const mgmtShort = {
    Inhouse: "Inhouse",
    Outsourced: "Outsourced",
    Both: "Both",
    Unsure: "Unsure",
    "Rotation Structure (Principal)": "Rotation",
    "Officer Sourcing (Qualified)": "Officers",
    "Fixed Budget (Zero Overhead)": "Fixed",
  }
  const mgmtCounts = {}
  cos.forEach((r) => {
    const m = getField(r, "mgmt_type")
    if (!m) return
    // Charts follow the same active-only rule as filters/pickers
    if (activeMgmtNames.size && !activeMgmtNames.has(m.toLowerCase().trim()))
      return
    mgmtCounts[m] = (mgmtCounts[m] || 0) + 1
  })
  const mgmtData = Object.entries(mgmtCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ k, v }))
  const mgmtEl = document.getElementById(mgmtId)
  if (mgmtEl && mgmtData.length) {
    const maxM = Math.max(...mgmtData.map((d) => d.v), 1)
    const totalM = mgmtData.reduce((a, d) => a + d.v, 0)
    const palette = [
      "#008E9C",
      "#d97706",
      "#7c3aed",
      "#0ea5e9",
      "#22c55e",
      "#f43f5e",
      "#64748b",
      "#eab308",
    ]
    mgmtEl.innerHTML = `<div class="vbar-chart analytics-vbar">${mgmtData
      .map((d, i) => {
        const h = Math.max(8, Math.round((d.v / maxM) * 100))
        const col = mgmtCols[d.k] || palette[i % palette.length]
        const short =
          mgmtShort[d.k] || (d.k.length > 10 ? d.k.slice(0, 9) + "…" : d.k)
        const pct = Math.round((d.v / totalM) * 100)
        const tip = tipAttr(
          chartTipHtml(
            esc(d.k),
            [
              ["Companies", String(d.v)],
              ["Share", pct + "%"],
              ["Of typed companies", d.v + " / " + totalM],
            ],
            col,
          ),
        )
        return `<div class="vbar-col"><div class="vbar-val">${d.v}</div><div class="vbar-fill tip-target" data-tip="${tip}" style="height:${h}%;background:${col}"></div><div class="vbar-label">${esc(short)}</div></div>`
      })
      .join("")}</div>`
  }

  // 4. Activity by Month
  const monthCounts = {}
  all.forEach((r) => {
    if (r.month) monthCounts[r.month] = (monthCounts[r.month] || 0) + 1
  })
  const monthOrder = Object.keys(MONTH_ORDER).sort(
    (a, b) => (MONTH_ORDER[a] ?? 0) - (MONTH_ORDER[b] ?? 0),
  )
  const monthData = monthOrder
    .filter((m) => monthCounts[m])
    .map((m) => ({ k: m, v: monthCounts[m] }))
  const monthEl = document.getElementById(monthId)
  if (monthEl && monthData.length) {
    const W = 480,
      H = 236,
      padL = 36,
      padR = 20,
      padT = 32,
      padB = 44
    const maxV = Math.max(...monthData.map((d) => d.v), 1)
    const labelStep = monthData.length > 12 ? 2 : 1
    const pts = monthData.map((d, i) => {
      const x =
        padL + i * ((W - padL - padR) / Math.max(monthData.length - 1, 1))
      const y = padT + (1 - d.v / maxV) * (H - padT - padB)
      const parts = d.k.split(" ")
      const mon = parts[0] || d.k
      const year = parts[1] ? String(parts[1]).slice(-2) : ""
      const prevYear =
        i > 0 ? String(monthData[i - 1].k.split(" ")[1] || "").slice(-2) : ""
      const yearLabel = year && (i === 0 || year !== prevYear) ? "'" + year : ""
      const showMon =
        i % labelStep === 0 || yearLabel || i === monthData.length - 1
      const prev = i > 0 ? monthData[i - 1].v : null
      const delta = prev == null ? null : d.v - prev
      return { x, y, v: d.v, mon, showMon, yearLabel, full: d.k, delta }
    })
    const line = pts
      .map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1))
      .join(" ")
    const area =
      line +
      " L" +
      pts[pts.length - 1].x.toFixed(1) +
      "," +
      (H - padB) +
      " L" +
      pts[0].x.toFixed(1) +
      "," +
      (H - padB) +
      " Z"
    const gridYs = [0.25, 0.5, 0.75]
      .map((t) => {
        const y = padT + (1 - t) * (H - padT - padB)
        return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(100,116,139,.18)" stroke-dasharray="3 4"/>`
      })
      .join("")
    monthEl.innerHTML = `<div class="line-chart analytics-line"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,142,156,.35)"/><stop offset="100%" stop-color="rgba(0,142,156,0)"/></linearGradient></defs>
      ${gridYs}
      <path d="${area}" fill="url(#${gradientId})" pointer-events="none"/>
      <path d="${line}" fill="none" stroke="#008E9C" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>
      ${pts
        .map((p) => {
          const deltaTxt =
            p.delta == null
              ? "—"
              : p.delta > 0
                ? "+" + p.delta
                : String(p.delta)
          const tip = tipAttr(
            chartTipHtml(
              esc(p.full),
              [
                ["Outreach", String(p.v)],
                ["vs prior month", deltaTxt],
                ["Share of peak", Math.round((p.v / maxV) * 100) + "%"],
              ],
              "#008E9C",
            ),
          )
          const monTxt = p.showMon
            ? `<text x="${p.x}" y="${H - 22}" fill="#64748b" font-size="9" text-anchor="middle" pointer-events="none">${p.mon}</text>`
            : ""
          const yearTxt = p.yearLabel
            ? `<text x="${p.x}" y="${H - 8}" fill="#94a3b8" font-size="8" font-weight="600" text-anchor="middle" pointer-events="none">${p.yearLabel}</text>`
            : ""
          return `<g class="line-point tip-target" data-tip="${tip}">
          <circle class="line-hit" cx="${p.x}" cy="${p.y}" r="8" fill="transparent"/>
          <circle cx="${p.x}" cy="${p.y}" r="4" fill="#fff" stroke="#008E9C" stroke-width="2"/>
          <text x="${p.x}" y="${p.y - 12}" fill="#475569" font-size="10" font-weight="600" text-anchor="middle" pointer-events="none">${p.v}</text>
          ${monTxt}${yearTxt}
        </g>`
        })
        .join("")}
    </svg></div>`
  }

  hideAllChartTips()
  bindChartTips(stageEl)
  bindChartTips(countryEl)
  bindChartTips(mgmtEl)
  bindChartTips(monthEl)
}

function renderAnalytics() {
  renderMetricCharts(
    {
      stage: "chart-stage",
      country: "chart-country",
      mgmt: "chart-mgmt",
      month: "chart-month",
    },
    { gradientId: "analytics-lg" },
  )
}

// CSV Export
function exportCSV() {
  const headers = [
    "Company",
    "Country",
    "Type",
    "Month",
    "Stage",
    "Contact Name",
    "Contact Email",
    "Contact Phone",
    "Follow-up Date",
    "Last Contacted",
    "Notes",
  ]
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const rows = filtered.map((r) => {
    const nk = r.company.toLowerCase().trim()
    const fu = r._follow_up || followUps[nk] || ""
    return [
      r.company,
      r.country || "",
      r.mgmt_type || "",
      r.month || "",
      getStage(r),
      r._contact_name || "",
      r._contact_email || "",
      r._contact_phone || "",
      fu,
      lastContactedDate(nk) || "",
      Array.isArray(notes[nk])
        ? notes[nk].map((e) => e.text).join(" | ")
        : notes[nk] || "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  })
  const csv = [headers.join(","), ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download =
    "Nautilus_BD_Pipeline_" + new Date().toISOString().slice(0, 10) + ".csv"
  a.click()
}

function changePage(dir) {
  page += dir
  renderTable()
  const el = document.getElementById("pipeline-scroll")
  if (el) el.scrollTop = 0
}
function clearFilters() {
  ;["search", "fm", "fs", "fc", "fg"].forEach(
    (id) => (document.getElementById(id).value = ""),
  )
  syncPipelineStageLabel()
  syncPipelineMgmtLabel()
  syncPipelineCountryLabel()
  syncMonthFilterLabel()
  const pSearch = document.getElementById("pipeline-country-search")
  if (pSearch) pSearch.value = ""
  closePipelineStageDrop()
  closePipelineMgmtDrop()
  closePipelineCountryDrop()
  closeMonthFilterDrop()
  kpiActiveFilter = ""
  document
    .querySelectorAll(".kpi.clickable")
    .forEach((k) => k.classList.remove("kpi-active"))
  applyFilters()
}

let pipelineStageOptions = []
let pipelineMgmtOptions = []
let pipelineCountryOptions = []

function positionCountryDrop(btn, drop) {
  if (!btn || !drop) return
  const rect = btn.getBoundingClientRect()
  const width = Math.max(rect.width, 260)
  let left = rect.left
  let top = rect.bottom + 6
  const maxH = Math.min(320, window.innerHeight - 24)
  if (left + width > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - width - 12)
  }
  if (top + maxH > window.innerHeight - 12) {
    top = Math.max(12, rect.top - maxH - 6)
  }
  drop.style.position = "fixed"
  drop.style.top = top + "px"
  drop.style.left = left + "px"
  drop.style.width = width + "px"
  drop.style.zIndex = "10000"
}

function populatePipelineStageFilter(stages) {
  pipelineStageOptions = (stages || []).slice()
  renderPipelineStageOptions()
  syncPipelineStageLabel()
}

function renderPipelineStageOptions() {
  const list = document.getElementById("pipeline-stage-list")
  const hidden = document.getElementById("fs")
  if (!list || !hidden) return
  const current = hidden.value
  const items = [
    { value: "", label: "All Stages", selected: !current },
    ...pipelineStageOptions.map((s) => ({
      value: s,
      label: s,
      selected: current === s,
    })),
  ]
  list.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="ss-item${item.selected ? " selected" : ""}" role="option" aria-selected="${item.selected}" data-value="${esc(item.value)}" onclick="selectPipelineStage(this.getAttribute('data-value'))">${item.selected ? "✓ " : ""}${esc(item.label)}</button>`,
    )
    .join("")
}

function togglePipelineStageDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("pipeline-stage-drop")
  const btn = document.getElementById("pipeline-stage-btn")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeMonthFilterDrop()
    closeLeadMonthFilterDrop()
    closePipelineCountryDrop()
    closePipelineMgmtDrop()
    closeLeadStageDrop()
    closeLeadMgmtDrop()
    closeLeadCountryDrop()
    closeLeadFormCountryDrop()
    closeCoFormCountryDrop()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    positionCountryDrop(btn, drop)
    renderPipelineStageOptions()
  } else {
    closePipelineStageDrop()
  }
}

function closePipelineStageDrop() {
  const drop = document.getElementById("pipeline-stage-drop")
  const btn = document.getElementById("pipeline-stage-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}

function selectPipelineStage(value) {
  const hidden = document.getElementById("fs")
  const label = document.getElementById("pipeline-stage-label")
  if (!hidden || !label) return
  hidden.value = value || ""
  label.textContent = value || "All Stages"
  closePipelineStageDrop()
  applyFilters()
}

function syncPipelineStageLabel() {
  const hidden = document.getElementById("fs")
  const label = document.getElementById("pipeline-stage-label")
  if (!hidden || !label) return
  label.textContent = hidden.value || "All Stages"
}

function populatePipelineMgmtFilter(types) {
  pipelineMgmtOptions = (types || []).slice()
  renderPipelineMgmtOptions()
  syncPipelineMgmtLabel()
}

function renderPipelineMgmtOptions() {
  const list = document.getElementById("pipeline-mgmt-list")
  const hidden = document.getElementById("fg")
  if (!list || !hidden) return
  const current = hidden.value
  const items = [
    { value: "", label: "All Types", selected: !current },
    ...pipelineMgmtOptions.map((t) => ({
      value: t,
      label: t,
      selected: current === t,
    })),
  ]
  list.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="ss-item${item.selected ? " selected" : ""}" role="option" aria-selected="${item.selected}" data-value="${esc(item.value)}" onclick="selectPipelineMgmt(this.getAttribute('data-value'))">${item.selected ? "✓ " : ""}${esc(item.label)}</button>`,
    )
    .join("")
}

function togglePipelineMgmtDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("pipeline-mgmt-drop")
  const btn = document.getElementById("pipeline-mgmt-btn")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeMonthFilterDrop()
    closeLeadMonthFilterDrop()
    closePipelineStageDrop()
    closePipelineCountryDrop()
    closeLeadStageDrop()
    closeLeadMgmtDrop()
    closeLeadCountryDrop()
    closeLeadFormCountryDrop()
    closeLeadFormMgmtDrop()
    closeCoFormCountryDrop()
    closeCoFormMgmtDrop()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    positionCountryDrop(btn, drop)
    renderPipelineMgmtOptions()
  } else {
    closePipelineMgmtDrop()
  }
}

function closePipelineMgmtDrop() {
  const drop = document.getElementById("pipeline-mgmt-drop")
  const btn = document.getElementById("pipeline-mgmt-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}

function selectPipelineMgmt(value) {
  const hidden = document.getElementById("fg")
  const label = document.getElementById("pipeline-mgmt-label")
  if (!hidden || !label) return
  hidden.value = value || ""
  label.textContent = value || "All Types"
  closePipelineMgmtDrop()
  applyFilters()
}

function syncPipelineMgmtLabel() {
  const hidden = document.getElementById("fg")
  const label = document.getElementById("pipeline-mgmt-label")
  if (!hidden || !label) return
  label.textContent = hidden.value || "All Types"
}

function populatePipelineCountryFilter(countries) {
  pipelineCountryOptions = (countries || [])
    .slice()
    .sort((a, b) => a.localeCompare(b))
  renderPipelineCountryOptions()
  syncPipelineCountryLabel()
}

function renderPipelineCountryOptions(filterText) {
  const list = document.getElementById("pipeline-country-list")
  const hidden = document.getElementById("fc")
  if (!list || !hidden) return
  const q = (filterText || "").trim().toLowerCase()
  const current = hidden.value
  const matches = q
    ? pipelineCountryOptions.filter((c) => c.toLowerCase().includes(q))
    : pipelineCountryOptions.slice()

  const items = []
  if (!q || "all countries".includes(q)) {
    items.push({
      value: "",
      label: "All Countries",
      selected: !current,
    })
  }
  matches.forEach((c) => {
    items.push({ value: c, label: c, selected: current === c })
  })

  if (!items.length) {
    list.innerHTML = `<div class="ss-empty">No countries match “${esc((filterText || "").trim())}”</div>`
    return
  }

  list.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="ss-item${item.selected ? " selected" : ""}" role="option" aria-selected="${item.selected}" data-value="${esc(item.value)}" onclick="selectPipelineCountry(this.getAttribute('data-value'))">${item.selected ? "✓ " : ""}${esc(item.label)}</button>`,
    )
    .join("")
}

function filterPipelineCountryOptions() {
  const input = document.getElementById("pipeline-country-search")
  renderPipelineCountryOptions(input ? input.value : "")
}

function togglePipelineCountryDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("pipeline-country-drop")
  const btn = document.getElementById("pipeline-country-btn")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeMonthFilterDrop()
    closeLeadMonthFilterDrop()
    closePipelineStageDrop()
    closePipelineMgmtDrop()
    closeLeadStageDrop()
    closeLeadMgmtDrop()
    closeLeadCountryDrop()
    closeLeadFormCountryDrop()
    closeCoFormCountryDrop()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    positionCountryDrop(btn, drop)
    const search = document.getElementById("pipeline-country-search")
    if (search) {
      search.value = ""
      renderPipelineCountryOptions("")
      setTimeout(() => search.focus(), 0)
    }
  } else {
    closePipelineCountryDrop()
  }
}

function closePipelineCountryDrop() {
  const drop = document.getElementById("pipeline-country-drop")
  const btn = document.getElementById("pipeline-country-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}

function selectPipelineCountry(value) {
  const hidden = document.getElementById("fc")
  const label = document.getElementById("pipeline-country-label")
  if (!hidden || !label) return
  hidden.value = value || ""
  label.textContent = value || "All Countries"
  closePipelineCountryDrop()
  applyFilters()
}

function syncPipelineCountryLabel() {
  const hidden = document.getElementById("fc")
  const label = document.getElementById("pipeline-country-label")
  if (!hidden || !label) return
  label.textContent = hidden.value || "All Countries"
}

const MONTH_FILTER_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]
let monthFilterYear = new Date().getFullYear()

function monthFilterYearBounds() {
  const keys = Object.keys(MONTH_ORDER)
  let minY = new Date().getFullYear()
  let maxY = minY
  keys.forEach((k) => {
    const y = parseInt(k.slice(-4), 10)
    if (!Number.isFinite(y)) return
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  })
  return { minY, maxY }
}

function syncMonthFilterLabel() {
  const hidden = document.getElementById("fm")
  const label = document.getElementById("pipeline-month-label")
  if (!hidden || !label) return
  label.textContent = hidden.value || "All Months"
}

function renderMonthFilterGrid() {
  const grid = document.getElementById("pipeline-month-grid")
  const yearEl = document.getElementById("pipeline-month-year")
  const prev = document.getElementById("pipeline-month-prev")
  const next = document.getElementById("pipeline-month-next")
  const allBtn = document.getElementById("pipeline-month-all")
  const hidden = document.getElementById("fm")
  if (!grid || !yearEl || !hidden) return

  const { minY, maxY } = monthFilterYearBounds()
  if (monthFilterYear < minY) monthFilterYear = minY
  if (monthFilterYear > maxY) monthFilterYear = maxY

  yearEl.textContent = String(monthFilterYear)
  if (prev) prev.disabled = monthFilterYear <= minY
  if (next) next.disabled = monthFilterYear >= maxY

  const selected = hidden.value || ""
  const now = new Date()
  const curLabel = monthKeyFromDate(now)

  grid.innerHTML = MONTH_FILTER_SHORT.map((name) => {
    const value = name + " " + monthFilterYear
    const isSelected = selected === value
    const isCurrent = value === curLabel
    return `<button type="button" class="month-filter-cell${isSelected ? " selected" : ""}${isCurrent ? " is-current" : ""}" role="option" aria-selected="${isSelected}" data-value="${esc(value)}" onclick="selectMonthFilter(this.getAttribute('data-value'))">${name}</button>`
  }).join("")

  if (allBtn) {
    allBtn.classList.toggle("selected", !selected)
  }
}

function positionMonthFilterDrop(btn, drop) {
  if (!btn || !drop) return
  const rect = btn.getBoundingClientRect()
  const width = 248
  let left = rect.left
  let top = rect.bottom + 6
  const maxH = 280
  if (left + width > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - width - 12)
  }
  if (top + maxH > window.innerHeight - 12) {
    top = Math.max(12, rect.top - maxH - 6)
  }
  drop.style.position = "fixed"
  drop.style.top = top + "px"
  drop.style.left = left + "px"
  drop.style.width = width + "px"
  drop.style.zIndex = "10000"
}

function toggleMonthFilterDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("pipeline-month-drop")
  const btn = document.getElementById("pipeline-month-btn")
  const hidden = document.getElementById("fm")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closePipelineStageDrop()
    closePipelineMgmtDrop()
    closePipelineCountryDrop()
    closeLeadMonthFilterDrop()
    closeLeadStageDrop()
    closeLeadMgmtDrop()
    closeLeadCountryDrop()
    closeLeadFormCountryDrop()
    closeCoFormCountryDrop()
    const parsed = hidden && hidden.value ? parseMonthLabel(hidden.value) : null
    monthFilterYear = parsed ? parsed.getFullYear() : new Date().getFullYear()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    renderMonthFilterGrid()
    positionMonthFilterDrop(btn, drop)
  } else {
    closeMonthFilterDrop()
  }
}

function closeMonthFilterDrop() {
  const drop = document.getElementById("pipeline-month-drop")
  const btn = document.getElementById("pipeline-month-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}

function shiftMonthFilterYear(delta, event) {
  if (event) event.stopPropagation()
  monthFilterYear += delta
  renderMonthFilterGrid()
}

function selectMonthFilter(value) {
  const hidden = document.getElementById("fm")
  if (!hidden) return
  hidden.value = value || ""
  syncMonthFilterLabel()
  closeMonthFilterDrop()
  applyFilters()
}

/** Form month pickers (Add/Edit Company + Lead) — same year grid as pipeline filter. */
const FORM_MONTH_IDS = {
  co: {
    wrap: "co-month-ss",
    hidden: "co-month",
    btn: "co-month-btn",
    label: "co-month-label",
    drop: "co-month-drop",
    year: "co-month-year",
    prev: "co-month-prev",
    next: "co-month-next",
    grid: "co-month-grid",
  },
  lead: {
    wrap: "lead-form-month-ss",
    hidden: "lead-month",
    btn: "lead-form-month-btn",
    label: "lead-form-month-label",
    drop: "lead-form-month-drop",
    year: "lead-form-month-year",
    prev: "lead-form-month-prev",
    next: "lead-form-month-next",
    grid: "lead-form-month-grid",
  },
}
const formMonthYear = {
  co: new Date().getFullYear(),
  lead: new Date().getFullYear(),
}

function formMonthEls(which) {
  const ids = FORM_MONTH_IDS[which]
  if (!ids) return null
  return {
    wrap: document.getElementById(ids.wrap),
    hidden: document.getElementById(ids.hidden),
    btn: document.getElementById(ids.btn),
    label: document.getElementById(ids.label),
    drop: document.getElementById(ids.drop),
    year: document.getElementById(ids.year),
    prev: document.getElementById(ids.prev),
    next: document.getElementById(ids.next),
    grid: document.getElementById(ids.grid),
  }
}

function syncFormMonthLabel(which) {
  const els = formMonthEls(which)
  if (!els || !els.hidden || !els.label) return
  els.label.textContent = els.hidden.value || "—"
}

function setFormMonthValue(which, value) {
  const els = formMonthEls(which)
  if (!els || !els.hidden) return
  const v = isValidMonthLabel(value) ? value.trim() : monthLabelNow()
  els.hidden.value = v
  syncFormMonthLabel(which)
  const parsed = parseMonthLabel(v)
  if (parsed) formMonthYear[which] = parsed.getFullYear()
}

function renderFormMonthGrid(which) {
  const els = formMonthEls(which)
  if (!els || !els.grid || !els.year || !els.hidden) return

  const { minY, maxY } = monthFilterYearBounds()
  if (formMonthYear[which] < minY) formMonthYear[which] = minY
  if (formMonthYear[which] > maxY) formMonthYear[which] = maxY

  els.year.textContent = String(formMonthYear[which])
  if (els.prev) els.prev.disabled = formMonthYear[which] <= minY
  if (els.next) els.next.disabled = formMonthYear[which] >= maxY

  const selected = els.hidden.value || ""
  const curLabel = monthKeyFromDate(new Date())

  els.grid.innerHTML = MONTH_FILTER_SHORT.map((name) => {
    const value = name + " " + formMonthYear[which]
    const isSelected = selected === value
    const isCurrent = value === curLabel
    return `<button type="button" class="month-filter-cell${isSelected ? " selected" : ""}${isCurrent ? " is-current" : ""}" role="option" aria-selected="${isSelected}" data-value="${esc(value)}" onclick="selectFormMonth('${which}', this.getAttribute('data-value'))">${name}</button>`
  }).join("")
}

function closeFormMonthDrop(which) {
  const els = formMonthEls(which)
  if (!els) return
  if (els.drop) els.drop.setAttribute("hidden", "")
  if (els.btn) {
    els.btn.setAttribute("aria-expanded", "false")
    els.btn.classList.remove("open")
  }
}

function closeAllFormMonthDrops() {
  closeFormMonthDrop("co")
  closeFormMonthDrop("lead")
}

function toggleFormMonthDrop(which, event) {
  if (event) event.stopPropagation()
  const els = formMonthEls(which)
  if (!els || !els.drop || !els.btn || !els.hidden) return
  const open = els.drop.hasAttribute("hidden")
  closeAllFormMonthDrops()
  closeMonthFilterDrop()
  closeLeadMonthFilterDrop()
  closePipelineStageDrop()
  closePipelineMgmtDrop()
  closePipelineCountryDrop()
  closeLeadStageDrop()
  closeLeadMgmtDrop()
  closeLeadCountryDrop()
  closeLeadFormCountryDrop()
  closeLeadFormMgmtDrop()
  closeCoFormCountryDrop()
  closeCoFormMgmtDrop()
  if (which === "co") closeFormMonthDrop("lead")
  else closeFormMonthDrop("co")
  if (!open) return

  const parsed = els.hidden.value ? parseMonthLabel(els.hidden.value) : null
  formMonthYear[which] = parsed
    ? parsed.getFullYear()
    : new Date().getFullYear()
  els.drop.removeAttribute("hidden")
  els.btn.setAttribute("aria-expanded", "true")
  els.btn.classList.add("open")
  renderFormMonthGrid(which)
  positionMonthFilterDrop(els.btn, els.drop)
}

function shiftFormMonthYear(which, delta, event) {
  if (event) event.stopPropagation()
  formMonthYear[which] += delta
  renderFormMonthGrid(which)
}

function selectFormMonth(which, value) {
  setFormMonthValue(which, value)
  closeFormMonthDrop(which)
}

function isInsideFormMonth(which, target) {
  if (!(target instanceof Node)) return false
  const els = formMonthEls(which)
  if (!els) return false
  return (
    !!(els.wrap && els.wrap.contains(target)) ||
    !!(els.drop && els.drop.contains(target)) ||
    !!(els.btn && els.btn.contains(target))
  )
}

// INLINE FIELD EDIT POPOVER — country & management type, backed by the real DB
let fieldEditTarget = {}
let fieldEditOptions = []
let fieldEditCurrentLabel = ""
let fieldEditMode = "pipeline" // "pipeline" | "lead"

function closeFieldEditPop() {
  const pop = document.getElementById("field-edit-pop")
  if (pop) pop.style.display = "none"
}

function fillFieldEditPop(field, current, anchorEl) {
  fieldEditCurrentLabel = current || ""
  const pop = document.getElementById("field-edit-pop")
  document.getElementById("field-edit-label").textContent =
    { country: "Country", mgmt_type: "Management Type" }[field] || field
  const list =
    field === "mgmt_type"
      ? getActiveMgmtTypeLookups()
      : getActiveCountryLookups()
  const nameKey = field === "mgmt_type" ? "type_name" : "country_name"
  fieldEditOptions = (list || [])
    .map((o) => ({ id: o.id, label: o[nameKey] || "" }))
    .filter((o) => o.label)
    .sort((a, b) => a.label.localeCompare(b.label))

  const search = document.getElementById("field-edit-search")
  if (search) {
    search.value = ""
    search.placeholder =
      field === "mgmt_type" ? "Search types..." : "Search countries..."
  }
  renderFieldEditOptions("")
  const rect = anchorEl.getBoundingClientRect()
  positionPopover(pop, rect)
  pop.style.display = "block"
  if (search) setTimeout(() => search.focus(), 0)
}

function openFieldEdit(event, id, company, field, current) {
  event.stopPropagation()
  fieldEditMode = "pipeline"
  const companyName = company.replace(/&#39;/g, "'")
  // Recover a missing id from RAW_BASE (legacy local "Added" rows often lack one)
  let rowId = id
  if (!rowId) {
    rowId = resolveCompanyId(companyName)
  }
  fieldEditTarget = { id: rowId, company: companyName, field, leadId: null }
  fillFieldEditPop(field, current, event.currentTarget || event.target)
}

/** Same Country / Type picker as Pipeline, wired to a potential lead. */
function openLeadFieldEdit(event, leadId, field, current) {
  event.stopPropagation()
  fieldEditMode = "lead"
  fieldEditTarget = { id: null, company: "", field, leadId }
  fillFieldEditPop(field, current, event.currentTarget || event.target)
}
window.openLeadFieldEdit = openLeadFieldEdit

async function pickLeadFieldEditValue(value, btn) {
  const { field, leadId } = fieldEditTarget
  const lead = potentialLeads.find((l) => sameLeadId(l.id, leadId))
  if (!lead) {
    nsToast("Lead not found", "error")
    return
  }
  const apiField = field === "mgmt_type" ? "mgmt_type_id" : "country_id"
  let label = ""
  if (value) {
    const match = fieldEditOptions.find((o) => String(o.id) === String(value))
    label = match ? match.label : (btn && btn.textContent) || ""
  }
  try {
    await window.NsApi.updateLead(leadId, {
      [apiField]: value ? Number(value) : null,
    })
    if (field === "mgmt_type") {
      lead.mgmt = label
      lead.mgmt_type_id = value ? Number(value) : null
    } else {
      lead.country = label
      lead.country_id = value ? Number(value) : null
    }
    renderLeads()
    nsToast("Updated")
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Update failed", "error")
  }
}

async function pickFieldEditValue(value, btn) {
  closeFieldEditPop()
  if (fieldEditMode === "lead") {
    await pickLeadFieldEditValue(value, btn)
    fieldEditMode = "pipeline"
    return
  }
  let { id, field, company } = fieldEditTarget
  if (!id && company) id = resolveCompanyId(company)
  if (!id) {
    nsToast(
      "This company is a local “Added” row with no database id. Open ⋮ → Edit and save it once to enable inline editing.",
      "error",
    )
    return
  }
  const apiField = field === "mgmt_type" ? "mgmt_type_id" : "country_id"
  let label = ""
  if (value) {
    const match = fieldEditOptions.find((o) => String(o.id) === String(value))
    label = match ? match.label : (btn && btn.textContent) || ""
  }
  try {
    await window.NsApi.updateCompany(id, {
      [apiField]: value ? Number(value) : null,
    })
    const row = RAW_BASE.find((r) => r._id === id)
    if (row) row[field] = label
    // Clear stale local custom copy so it can't mask the API row again
    if (company) {
      const nk = company.toLowerCase().trim()
      const before = customCompanies.length
      customCompanies = customCompanies.filter(
        (c) => (c.company || "").toLowerCase().trim() !== nk,
      )
      if (customCompanies.length !== before) saveCustom()
    }
    applyFilters(true)
    if (typeof renderLeads === "function") renderLeads()
    nsToast("Updated")
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Update failed", "error")
  }
}

function renderFieldEditOptions(filterText) {
  const listEl = document.getElementById("field-edit-list")
  if (!listEl) return
  const q = (filterText || "").trim().toLowerCase()
  const matches = q
    ? fieldEditOptions.filter((o) => o.label.toLowerCase().includes(q))
    : fieldEditOptions

  const showClear = !q || "clear".includes(q) || "— clear —".includes(q)
  let html = ""
  if (showClear) {
    html += `<button type="button" class="field-edit-item${!fieldEditCurrentLabel ? " selected" : ""}" onclick="pickFieldEditValue('')">— Clear —</button>`
  }
  html += matches
    .map((o) => {
      const selected = String(o.label) === String(fieldEditCurrentLabel)
      return `<button type="button" class="field-edit-item${selected ? " selected" : ""}" data-id="${o.id}" onclick="pickFieldEditValue('${o.id}', this)">${esc(o.label)}</button>`
    })
    .join("")

  if (!html) {
    listEl.innerHTML = `<div class="field-edit-empty">No matches</div>`
    return
  }
  listEl.innerHTML = html
}

function filterFieldEditOptions() {
  const input = document.getElementById("field-edit-search")
  renderFieldEditOptions(input ? input.value : "")
}

document.addEventListener("click", (e) => {
  const pop = document.getElementById("field-edit-pop")
  if (pop && pop.style.display !== "none" && !pop.contains(e.target))
    closeFieldEditPop()
})
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeFieldEditPop()
})

// CONTACTS MODAL
let activeContactKey = ""
let editContactIdx = -1
let activeContactLeadId = null

function seedContactsFromLead(nk, lead) {
  const key = String(nk || "")
    .replace(/&#39;/g, "'")
    .toLowerCase()
    .trim()
  if (!key || !lead) return
  if (Array.isArray(contacts[key]) && contacts[key].length) return
  const extras = leadExtras[lead.id] || {}
  if (Array.isArray(extras.contactEntries) && extras.contactEntries.length) {
    contacts[key] = extras.contactEntries.map((c) => ({
      id: c.id != null ? c.id : null,
      name: c.name || "",
      title: c.title || "",
      email: c.email || "",
      phone: c.phone || "",
    }))
    return
  }
  const name = leadVal(lead.contact)
  const email = leadVal(lead.contact_email)
  const phone = leadVal(lead.contact_phone)
  if (name || email || phone) {
    contacts[key] = [
      {
        id: null,
        name: name || "Contact",
        title: "",
        email,
        phone,
      },
    ]
  }
}

function persistLeadContactEntries(lead, nk) {
  if (!lead || lead.id == null) return
  const list = Array.isArray(contacts[nk]) ? contacts[nk] : []
  const extras = { ...(leadExtras[lead.id] || {}) }
  extras.contactEntries = list.map((c) => ({
    id: c.id != null ? c.id : null,
    name: c.name || "",
    title: c.title || "",
    email: c.email || "",
    phone: c.phone || "",
  }))
  leadExtras[lead.id] = extras
  saveLeadExtras()
  const primary = list[0] || null
  lead.contact = primary ? primary.name || "" : ""
  lead.contact_email = primary ? primary.email || "" : ""
  lead.contact_phone = primary ? primary.phone || "" : ""
}

function refreshAfterContactChange() {
  if (typeof renderTable === "function") renderTable()
  if (typeof renderLeads === "function") renderLeads()
  if (
    document.getElementById("panel-contacts") &&
    document.getElementById("panel-contacts").classList.contains("active") &&
    typeof renderContactsTab === "function"
  ) {
    renderContactsTab()
  }
}

function openContacts(company, leadId) {
  activeContactKey = company.replace(/&#39;/g, "'").toLowerCase().trim()
  activeContactLeadId = leadId != null && leadId !== "" ? leadId : null
  const lead =
    (activeContactLeadId != null &&
      (potentialLeads || []).find((l) =>
        sameLeadId(l.id, activeContactLeadId),
      )) ||
    findLeadByName(company)
  if (lead) {
    if (activeContactLeadId == null) activeContactLeadId = lead.id
    seedContactsFromLead(activeContactKey, lead)
  }
  document.getElementById("contacts-co-name").textContent = company.replace(
    /&#39;/g,
    "'",
  )
  renderContactsList()
  clearContactForm()
  document.getElementById("contacts-modal").style.display = "flex"
}
function openLeadContacts(leadId) {
  const lead = (potentialLeads || []).find((l) => sameLeadId(l.id, leadId))
  if (!lead) {
    nsToast("Lead not found — refresh and try again.", "error")
    return
  }
  openContacts(lead.name || "", lead.id)
}
window.openLeadContacts = openLeadContacts
function closeContacts() {
  document.getElementById("contacts-modal").style.display = "none"
  editContactIdx = -1
  activeContactLeadId = null
  clearContactForm()
}
function clearContactForm() {
  ;["ct-name", "ct-title", "ct-email", "ct-phone"].forEach(
    (id) => (document.getElementById(id).value = ""),
  )
  document.getElementById("ct-save-btn").textContent = "＋ Add Contact"
  editContactIdx = -1
}
function renderContactsList() {
  const list = contacts[activeContactKey] || []
  const div = document.getElementById("contacts-list")
  if (!list.length) {
    div.innerHTML =
      '<div style="color:#64748b;font-size:.73rem;text-align:center;padding:14px">No contacts added yet</div>'
    return
  }
  div.innerHTML = list
    .map(
      (c, i) => `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:10px 12px;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-weight:600;color:#0f172a;font-size:.78rem">${esc(c.name)}</div>
        ${c.title ? `<div style="font-size:.65rem;color:#64748b">${esc(c.title)}</div>` : ""}
        ${c.email ? `<div style="font-size:.66rem;color:#2563eb;margin-top:3px"><a href="mailto:${esc(c.email)}" style="color:#2563eb">${esc(c.email)}</a></div>` : ""}
        ${c.phone ? `<div style="font-size:.66rem;color:#64748b">${esc(c.phone)}</div>` : ""}
      </div>
      <div style="display:flex;gap:5px;margin-left:10px">
        <button onclick="editContact(${i})" style="background:none;border:1px solid #cbd5e1;color:#64748b;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:.65rem">Edit</button>
        <button onclick="deleteContact(${i})" style="background:none;border:1px solid #f85149;color:#dc2626;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:.65rem">✕</button>
      </div>
    </div>`,
    )
    .join("")
}
function editContact(idx) {
  const c = (contacts[activeContactKey] || [])[idx]
  if (!c) return
  editContactIdx = idx
  document.getElementById("ct-name").value = c.name || ""
  document.getElementById("ct-title").value = c.title || ""
  document.getElementById("ct-email").value = c.email || ""
  document.getElementById("ct-phone").value = c.phone || ""
  document.getElementById("ct-save-btn").textContent = "Save Changes"
}
async function saveContact() {
  const name = document.getElementById("ct-name").value.trim()
  if (!name) {
    document.getElementById("ct-name").style.borderColor = "#dc2626"
    setTimeout(
      () => (document.getElementById("ct-name").style.borderColor = ""),
      1200,
    )
    return
  }
  const title = document.getElementById("ct-title").value.trim()
  const email = document.getElementById("ct-email").value.trim()
  const phone = document.getElementById("ct-phone").value.trim()
  const companyId = resolveCompanyId(activeContactKey)
  const lead =
    (activeContactLeadId != null &&
      (potentialLeads || []).find((l) =>
        sameLeadId(l.id, activeContactLeadId),
      )) ||
    findLeadByName(activeContactKey)

  if (!contacts[activeContactKey]) contacts[activeContactKey] = []
  const list = contacts[activeContactKey]
  const existing = editContactIdx >= 0 ? list[editContactIdx] : null

  try {
    if (companyId) {
      if (
        existing &&
        existing.id &&
        !String(existing.id).startsWith("local-")
      ) {
        await window.NsApi.updateContact(existing.id, {
          name,
          title,
          email,
          phone,
        })
        list[editContactIdx] = { id: existing.id, name, title, email, phone }
      } else {
        const created = await window.NsApi.createContact({
          company_id: companyId,
          name,
          title,
          email,
          phone,
        })
        const newId =
          created &&
          (created.id ??
            created.contact_id ??
            (created.contact && created.contact.id))
        if (editContactIdx >= 0)
          list[editContactIdx] = { id: newId, name, title, email, phone }
        else list.unshift({ id: newId, name, title, email, phone })
      }
    } else if (lead && lead.id != null) {
      const localId =
        existing && existing.id != null ? existing.id : "local-" + Date.now()
      const entry = { id: localId, name, title, email, phone }
      if (editContactIdx >= 0) list[editContactIdx] = entry
      else list.unshift(entry)
    } else {
      nsToast(
        "This row has no database id — refresh the page and try again.",
        "error",
      )
      return
    }

    if (lead) {
      persistLeadContactEntries(lead, activeContactKey)
      try {
        await window.NsApi.updateLead(lead.id, {
          contact_name: lead.contact || null,
          contact_email: lead.contact_email || null,
          contact_phone: lead.contact_phone || null,
        })
      } catch (err) {
        console.warn("[saveContact] lead contact sync failed:", err)
      }
    }

    saveContacts()
    contactsRecency[activeContactKey] = Date.now()
    ctPage = 1
    renderContactsList()
    clearContactForm()
    refreshAfterContactChange()
    nsToast("Contact saved")
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Save failed", "error")
  }
}
async function deleteContact(idx) {
  const list = contacts[activeContactKey] || []
  const c = list[idx]
  if (!c) return
  try {
    if (c.id && !String(c.id).startsWith("local-")) {
      await window.NsApi.deleteContact(c.id)
    }
    list.splice(idx, 1)
    const lead =
      (activeContactLeadId != null &&
        (potentialLeads || []).find((l) =>
          sameLeadId(l.id, activeContactLeadId),
        )) ||
      findLeadByName(activeContactKey)
    if (lead) {
      persistLeadContactEntries(lead, activeContactKey)
      try {
        await window.NsApi.updateLead(lead.id, {
          contact_name: lead.contact || null,
          contact_email: lead.contact_email || null,
          contact_phone: lead.contact_phone || null,
        })
      } catch (err) {
        console.warn("[deleteContact] lead contact sync failed:", err)
      }
    }
    saveContacts()
    renderContactsList()
    refreshAfterContactChange()
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Delete failed", "error")
  }
}

// CONTACTS TAB
let ctPage = 1
const CT_PER = 50
/** companyKey -> timestamp; bumps a row to the top right after add/edit */
let contactsRecency = {}
/** Lead-only contacts live in leadExtras; pull them in so the Contacts tab
 *  does not depend on the Leads tab having rendered first. */
function seedContactsFromAllLeads() {
  ;(potentialLeads || []).forEach((lead) => {
    const nk = (lead.name || "").toLowerCase().trim()
    if (nk) seedContactsFromLead(nk, lead)
  })
}

function renderContactsTab() {
  const searchEl = document.getElementById("ct-search")
  const filterEl = document.getElementById("ct-has-filter")
  const tbody = document.getElementById("ct-tbody")
  const nores = document.getElementById("ct-nores")
  if (!searchEl || !filterEl || !tbody || !nores) return
  seedContactsFromAllLeads()
  const q = (searchEl.value || "").toLowerCase()
  const hasF = filterEl.value
  // Get all unique companies
  const allCos = getAllCompanies()
  const seen = {}
  const SP = {
    "Meeting / Positive": 6,
    Call: 5,
    Retargeted: 4,
    "Not Interested": 3,
    "Email Outreach": 2,
    Prospected: 1,
  }
  allCos.forEach((r) => {
    const k = r.company.toLowerCase().trim()
    if (!seen[k]) {
      seen[k] = {
        ...r,
        _all_months: [r.month].filter(Boolean),
        is_retarget: !!r.is_retarget,
      }
    } else {
      seen[k]._all_months.push(r.month)
      if (r.is_retarget) seen[k].is_retarget = true
      // Prefer highest DB id so newest-first sort stays correct
      if (r._id && (!seen[k]._id || r._id > seen[k]._id)) {
        seen[k]._id = r._id
        if (r.code) seen[k].code = r.code
      }
      const cur = SP[getStage(seen[k])] || 0,
        nw = SP[getStage(r)] || 0
      if (nw > cur) {
        const m = seen[k]._all_months,
          wasR = seen[k].is_retarget
        const keptId =
          Math.max(Number(r._id) || 0, Number(seen[k]._id) || 0) ||
          r._id ||
          seen[k]._id
        seen[k] = {
          ...r,
          _id: keptId,
          _all_months: m,
          is_retarget: wasR || !!r.is_retarget,
        }
      }
    }
  })
  // Build rows: one per contact person (or one blank row per company if no contacts)
  let rows = []
  Object.values(seen).forEach((r) => {
    const nk = r.company.toLowerCase().trim()
    const cos = (contacts[nk] || [])
      .slice()
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
    const es = getStage(r)
    const country = getField(r, "country")
    if (hasF === "yes" && !cos.length) return
    if (hasF === "no" && cos.length) return
    if (cos.length) {
      cos.forEach((c, i) => {
        if (
          q &&
          !r.company.toLowerCase().includes(q) &&
          !(c.name || "").toLowerCase().includes(q) &&
          !(c.email || "").toLowerCase().includes(q)
        )
          return
        rows.push({ r, c, i, nk, es, country })
      })
    } else {
      if (q && !r.company.toLowerCase().includes(q)) return
      rows.push({ r, c: null, i: -1, nk, es, country })
    }
  })
  // Newest company first (same as Pipeline); last-saved contact bumps to top
  rows.sort((a, b) => {
    const aBump = contactsRecency[a.nk] || 0
    const bBump = contactsRecency[b.nk] || 0
    if (bBump !== aBump) return bBump - aBump
    const aCo = Number(a.r && a.r._id) || 0
    const bCo = Number(b.r && b.r._id) || 0
    if (bCo !== aCo) return bCo - aCo
    const aid = a.c && a.c.id != null ? Number(a.c.id) : 0
    const bid = b.c && b.c.id != null ? Number(b.c.id) : 0
    return bid - aid
  })
  ctPage = Math.min(ctPage, Math.max(1, Math.ceil(rows.length / CT_PER) || 1))
  if (!rows.length) {
    tbody.innerHTML = ""
    nores.style.display = "block"
    const pinfo = document.getElementById("ct-pinfo")
    const pprev = document.getElementById("ct-pprev")
    const ppnext = document.getElementById("ct-ppnext")
    if (pinfo) pinfo.textContent = "0 results"
    if (pprev) pprev.disabled = true
    if (ppnext) ppnext.disabled = true
    return
  }
  nores.style.display = "none"
  const total = rows.length,
    start = (ctPage - 1) * CT_PER,
    slice = rows.slice(start, start + CT_PER)
  tbody.innerHTML = slice
    .map(({ r, c, nk, es, country }) => {
      const eco = esc(r.company)
      const contactIdAttr =
        c && c.id != null
          ? String(c.id).replace(/\\/g, "\\\\").replace(/'/g, "\\'")
          : ""
      return `<tr>
      <td><span class="cn" style="font-size:13px">${esc(r.company)}</span></td>
      <td style="color:#64748b;font-size:.74rem">${esc(country || "—")}</td>
      <td><span class="badge ${bc(es)}" style="font-size:.6rem">${esc(es)}</span></td>
      <td style="font-weight:600;font-size:.76rem;color:#0f172a">${c ? esc(c.name) : '<span style="color:#94a3b8">—</span>'}</td>
      <td style="color:#64748b;font-size:.74rem">${c ? esc(c.title || "—") : '<span style="color:#94a3b8">—</span>'}</td>
      <td style="font-size:.73rem">${c && c.email ? `<a href="mailto:${esc(c.email)}" style="color:#2563eb;text-decoration:none">${esc(c.email)}</a>` : '<span style="color:#94a3b8">—</span>'}</td>
      <td style="color:#64748b;font-size:.74rem">${c ? esc(c.phone || "—") : '<span style="color:#94a3b8">—</span>'}</td>
      <td><div class="row-actions" data-co="${eco}" data-contact-id="${esc(contactIdAttr)}">${rowActionButton("edit", "contactRowActionEdit(event)", "Edit")}${rowActionButton("delete", "contactRowActionDelete(event)", "Delete", "is-danger")}</div></td>
    </tr>`
    })
    .join("")
  document.getElementById("ct-pinfo").textContent =
    `${start + 1}–${Math.min(start + CT_PER, total)} of ${total}`
  document.getElementById("ct-pprev").disabled = ctPage === 1
  document.getElementById("ct-ppnext").disabled = start + CT_PER >= total
}

let contactRowActionsTarget = null

function ensureContactRowActionsMenu() {
  if (document.getElementById("contact-row-actions-menu")) return
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="contact-row-actions-menu" style="display:none;position:fixed;z-index:9999;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.12);min-width:130px;overflow:hidden">
    <button type="button" onclick="handleContactRowActionEdit()" style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:.76rem;color:#0f172a">✏️ Edit</button>
    <button type="button" onclick="handleContactRowActionDelete()" style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:.76rem;color:#dc2626;border-top:1px solid #f1f5f9">🗑️ Delete</button>
  </div>`,
  )
}

function openContactRowActions(event, company, contactId) {
  event.stopPropagation()
  ensureContactRowActionsMenu()
  const btn = event.currentTarget || event.target
  const co =
    company != null
      ? String(company).replace(/&#39;/g, "'")
      : String((btn && btn.getAttribute("data-co")) || "").replace(
          /&#39;/g,
          "'",
        )
  const cidRaw =
    contactId != null && contactId !== ""
      ? String(contactId)
      : (btn && btn.getAttribute("data-contact-id")) || ""
  contactRowActionsTarget = {
    company: co,
    contactId: cidRaw ? cidRaw : null,
  }
  const menu = document.getElementById("contact-row-actions-menu")
  const rect = btn.getBoundingClientRect()
  if (typeof positionPopover === "function") {
    positionPopover(menu, rect)
  } else {
    menu.style.top = Math.min(window.innerHeight - 100, rect.bottom + 4) + "px"
    menu.style.left = Math.min(window.innerWidth - 140, rect.right - 130) + "px"
  }
  menu.style.display = "block"
}

function closeContactRowActionsMenu() {
  const menu = document.getElementById("contact-row-actions-menu")
  if (menu) menu.style.display = "none"
}

function setContactRowTargetFromEvent(event) {
  event.stopPropagation()
  const holder = event.currentTarget.closest("[data-co]")
  const co = String((holder && holder.getAttribute("data-co")) || "").replace(
    /&#39;/g,
    "'",
  )
  const cidRaw = (holder && holder.getAttribute("data-contact-id")) || ""
  contactRowActionsTarget = { company: co, contactId: cidRaw ? cidRaw : null }
}

function contactRowActionEdit(event) {
  setContactRowTargetFromEvent(event)
  handleContactRowActionEdit()
}

function contactRowActionDelete(event) {
  setContactRowTargetFromEvent(event)
  handleContactRowActionDelete()
}

function handleContactRowActionEdit() {
  closeContactRowActionsMenu()
  if (!contactRowActionsTarget) return
  const { company, contactId } = contactRowActionsTarget
  openContacts(company)
  if (contactId == null) return
  const nk = company.toLowerCase().trim()
  const list = contacts[nk] || []
  const idx = list.findIndex((c) => String(c.id) === String(contactId))
  if (idx >= 0) editContact(idx)
}

async function handleContactRowActionDelete() {
  closeContactRowActionsMenu()
  if (!contactRowActionsTarget) return
  const { company, contactId } = contactRowActionsTarget
  if (contactId == null) {
    nsToast("No contact to delete — add a contact first.")
    return
  }
  const nk = company.toLowerCase().trim()
  const list = contacts[nk] || []
  const idx = list.findIndex((c) => String(c.id) === String(contactId))
  if (idx < 0) {
    nsToast("Contact not found — refresh and try again.", "error")
    return
  }
  const c = list[idx]
  const label = (c && c.name) || "this contact"
  const confirmed = await nsConfirmDelete({
    title: "Delete this contact?",
    text: '"' + label + '" will be removed.',
    confirmButtonText: "Yes, delete",
  })
  if (!confirmed) return
  activeContactKey = nk
  activeContactLeadId = null
  const lead = findLeadByName(company)
  if (lead) activeContactLeadId = lead.id
  const before = (contacts[nk] || []).length
  await deleteContact(idx)
  if ((contacts[nk] || []).length < before) nsToast("Contact deleted")
}

window.openContactRowActions = openContactRowActions
window.handleContactRowActionEdit = handleContactRowActionEdit
window.handleContactRowActionDelete = handleContactRowActionDelete
window.contactRowActionEdit = contactRowActionEdit
window.contactRowActionDelete = contactRowActionDelete

if (!window.__nsContactRowActionsOutsideBound) {
  window.__nsContactRowActionsOutsideBound = true
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("contact-row-actions-menu")
    if (menu && menu.style.display !== "none" && !menu.contains(e.target))
      closeContactRowActionsMenu()
  })
}

function changeCtPage(dir) {
  ctPage += dir
  renderContactsTab()
}

// STAGE DROPDOWN
let activeStageRowId = null
let stageDropMode = "pipeline" // "pipeline" | "lead"
let leadStageTargetId = null

function positionStageDrop(drop, target) {
  const rect = target.getBoundingClientRect()
  let top = rect.bottom + 4,
    left = rect.left
  if (left + 185 > window.innerWidth) left = window.innerWidth - 190
  if (top + 200 > window.innerHeight) top = rect.top - 210
  drop.style.top = top + "px"
  drop.style.left = left + "px"
}

function markStageDropCurrent(drop, cur) {
  drop.querySelectorAll(".sd-item").forEach((item) => {
    item.classList.toggle("current", item.getAttribute("data-stage") === cur)
  })
}

function openStageDrop(event, company, month, id) {
  event.stopPropagation()
  stageDropMode = "pipeline"
  leadStageTargetId = null
  activeStageKey =
    company.replace(/&#39;/g, "'").toLowerCase().trim() + "__" + month
  activeStageRowId = id || null
  const drop = document.getElementById("stage-drop")
  renderStageDropOptions()
  positionStageDrop(drop, event.target)
  const row = RAW_BASE.find((r) => r._id === id)
  markStageDropCurrent(drop, row ? row.stage : "")
  drop.classList.add("open")
}

function openLeadStageDrop(event, leadId) {
  event.stopPropagation()
  stageDropMode = "lead"
  leadStageTargetId = leadId
  activeStageRowId = null
  const drop = document.getElementById("stage-drop")
  renderStageDropOptions()
  positionStageDrop(drop, event.currentTarget || event.target)
  const lead = potentialLeads.find((l) => sameLeadId(l.id, leadId))
  markStageDropCurrent(drop, lead ? getLeadStage(lead) : "")
  drop.classList.add("open")
}
window.openLeadStageDrop = openLeadStageDrop

function setLeadPipelineStage(stage) {
  const leadId = leadStageTargetId
  const lead = potentialLeads.find((l) => sameLeadId(l.id, leadId))
  document.getElementById("stage-drop").classList.remove("open")
  stageDropMode = "pipeline"
  leadStageTargetId = null
  if (!lead) return

  // Pipeline Retargeted workflow: need 2+ outreach months
  if (stage === "Retargeted" && leadMonthCount(lead) < 2) {
    nsToast("Select another month to mark as Retargeted (same as Pipeline)")
    let anchor = null
    document
      .querySelectorAll("#lead-tbody .badge.editable, #lead-grid .pg-stage")
      .forEach((el) => {
        if (String(el.getAttribute("onclick") || "").includes(String(leadId)))
          anchor = el
      })
    openLeadMonthPicker(
      {
        stopPropagation() {},
        currentTarget: anchor || document.body,
        target: anchor || document.body,
      },
      leadId,
    )
    return
  }

  const extras = { ...(leadExtras[leadId] || {}) }
  extras.stage = stage
  if (stage === "Retargeted") extras.is_retarget = true
  else if (stage === "Email Outreach") extras.is_retarget = false
  leadExtras[leadId] = extras
  saveLeadExtras()
  lead.stage = stage
  renderLeads()
  nsToast(stage === "Retargeted" ? "Stage set to Retargeted" : "Stage updated")
}

async function setStage(stage) {
  document.getElementById("stage-drop").classList.remove("open")
  if (stageDropMode === "lead") {
    setLeadPipelineStage(stage)
    return
  }
  if (!activeStageRowId) {
    nsToast(
      "This row has no database id — refresh the page and try again.",
      "error",
    )
    return
  }
  const stageMatch = NS_LOOKUPS.stages.find((s) => s.status_name === stage)
  try {
    await window.NsApi.updateCompany(activeStageRowId, {
      stage_id: stageMatch ? stageMatch.id : null,
    })
    const row = RAW_BASE.find((r) => r._id === activeStageRowId)
    if (row) {
      row.stage = stage
      await logStageAsActivity(row, stage)
    }
    applyFilters()
    if (document.getElementById("panel-weekly")) {
      comms = comms.filter(
        (c) => !(c.synthetic && c.company_id === activeStageRowId),
      )
      mergePipelineCommsIntoTracker()
      saveComms()
      renderWeekly()
    }
    nsToast("Stage updated")
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Update failed", "error")
  }
}

/** When pipeline stage becomes Email / Meeting, also log a real activity. */
async function logStageAsActivity(row, stage) {
  if (!window.NsApi || !row || !row._id) return
  let activityType = null
  let uiType = null
  let notes = ""
  if (stage === "Email Outreach") {
    activityType = "Email"
    uiType = "email"
    notes = (row.status || "").trim() || "Email outreach (stage update)"
  } else if (stage === "Meeting / Positive") {
    activityType = "Meeting"
    uiType = "meeting"
    notes =
      (row.status || "").trim() ||
      latestNoteText(row.company) ||
      "Meeting report (stage update)"
  } else if (stage === "Prospected" || stage === "Not Interested") {
    // No activities.php enum for these — timeline picks them up via mergePipelineCommsIntoTracker
    return
  } else {
    logToTracker(row.company, "note", "Stage → " + stage)
    return
  }
  try {
    const created = await window.NsApi.createActivity({
      company_id: row._id,
      activity_type: activityType,
      notes,
    })
    // Drop synthetic twin so we don't double-count
    comms = comms.filter(
      (c) => !(c.synthetic && c.company_id === row._id && c.type === uiType),
    )
    logToTracker(row.company, uiType, notes, {
      id: created.id,
      company_id: row._id,
    })
  } catch (err) {
    console.error("[dashboard] failed to log stage activity:", err)
    logToTracker(row.company, uiType, notes)
  }
}
document.addEventListener("click", (e) => {
  const drop = document.getElementById("stage-drop")
  if (drop && drop.classList.contains("open") && !drop.contains(e.target))
    drop.classList.remove("open")
})

// ADD/EDIT COMPANY
let editingCompanyId = null // real DB id when editing an existing row; null when creating new
function monthLabelNow() {
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  const d = new Date()
  return names[d.getMonth()] + " " + d.getFullYear()
}
function populateAddCompanyDropdowns(current) {
  current = current || {}
  const stageSel = document.getElementById("co-stage")
  const countryHidden = document.getElementById("co-form-country")
  if (countryHidden) {
    const match = (NS_LOOKUPS.countries || []).find(
      (c) => c.country_name === current.country,
    )
    countryHidden.value = match ? String(match.id) : ""
  }
  renderCoFormCountryOptions("")
  syncCoFormCountryLabel()
  const mgmtHidden = document.getElementById("co-form-mgmt")
  if (mgmtHidden) {
    const match = (NS_LOOKUPS.mgmt_types || []).find(
      (t) => t.type_name === current.mgmt_type,
    )
    mgmtHidden.value = match ? String(match.id) : ""
  }
  renderCoFormMgmtOptions("")
  syncCoFormMgmtLabel()
  stageSel.innerHTML = getDashboardStageRecords()
    .map(
      (s) =>
        `<option value="${s.id != null ? s.id : ""}"${s.status_name === current.stage ? " selected" : ""}>${esc(s.status_name)}</option>`,
    )
    .join("")
  if (!stageSel.value && stageSel.options.length) {
    const emailOpt = [...stageSel.options].find(
      (o) => o.textContent === "Email Outreach",
    )
    stageSel.value = emailOpt ? emailOpt.value : stageSel.options[0].value
  }
  const curMonth = current.month || monthLabelNow()
  setFormMonthValue("co", curMonth)
}
/** prefillOrRow: a plain string (legacy "prefill name only" call site) or a RAW_BASE row object to edit. */
function openAddCompany(prefillOrRow) {
  const isEditRow = prefillOrRow && typeof prefillOrRow === "object"
  editingCompanyId = isEditRow ? prefillOrRow._id || null : null
  document.getElementById("co-modal-title").textContent = editingCompanyId
    ? "Edit Company"
    : "Add Company to Pipeline"
  document.getElementById("co-name").value = isEditRow
    ? prefillOrRow.company || ""
    : prefillOrRow || ""
  const codeRow = document.getElementById("co-code-row")
  if (isEditRow && prefillOrRow.code) {
    codeRow.style.display = "block"
    codeRow.textContent = prefillOrRow.code
  } else {
    codeRow.style.display = "none"
    codeRow.textContent = ""
  }
  ;[
    "co-notes",
    "co-contact-name",
    "co-contact-email",
    "co-contact-phone",
    "co-followup",
  ].forEach((id) => (document.getElementById(id).value = ""))
  document.getElementById("co-status").value = isEditRow
    ? prefillOrRow.status || ""
    : ""

  const nk = isEditRow ? prefillOrRow.company.toLowerCase().trim() : ""
  document.getElementById("co-followup").value = isEditRow
    ? followUps[nk] || ""
    : ""

  const preview = document.getElementById("co-notes-preview")
  migrateNote(nk)
  const existingNotes = isEditRow ? notes[nk] || [] : []
  if (existingNotes.length) {
    preview.style.display = "block"
    preview.innerHTML = existingNotes
      .map(
        (e) =>
          `<div style="margin-bottom:6px">${e.ts ? `<span style="color:#64748b;font-size:.6rem">${e.ts}</span><br>` : ""}${esc(e.text)}</div>`,
      )
      .join("")
  } else {
    preview.style.display = "none"
    preview.innerHTML = ""
  }

  populateAddCompanyDropdowns(isEditRow ? prefillOrRow : {})
  closeCoFormCountryDrop()
  closeCoFormMgmtDrop()
  closeFormMonthDrop("co")
  document.getElementById("co-modal").classList.add("open")
  setTimeout(() => document.getElementById("co-name").focus(), 50)
}
function closeCoModal() {
  closeCoFormCountryDrop()
  closeCoFormMgmtDrop()
  closeFormMonthDrop("co")
  document.getElementById("co-modal").classList.remove("open")
  editingCompanyId = null
}
async function saveCompany() {
  const name = document.getElementById("co-name").value.trim()
  if (!name) {
    document.getElementById("co-name").style.borderColor = "#dc2626"
    setTimeout(
      () => (document.getElementById("co-name").style.borderColor = ""),
      1200,
    )
    return
  }

  const countryId = document.getElementById("co-form-country")?.value || ""
  const mgmtId = document.getElementById("co-form-mgmt")?.value || ""
  const stageSel = document.getElementById("co-stage")
  const monthVal = document.getElementById("co-month").value || monthLabelNow()
  const statusVal = document.getElementById("co-status").value.trim()
  const wasEdit = !!editingCompanyId
  const countryMatch = (NS_LOOKUPS.countries || []).find(
    (c) => String(c.id) === String(countryId),
  )
  const mgmtMatch = (NS_LOOKUPS.mgmt_types || []).find(
    (t) => String(t.id) === String(mgmtId),
  )
  let stageId = stageSel.value ? Number(stageSel.value) : null
  if (!stageId) {
    const fallback = (NS_LOOKUPS.stages || []).find(
      (s) => s.status_name === "Email Outreach",
    )
    stageId = fallback ? Number(fallback.id) : null
  }
  const stageName =
    stageSel.options[stageSel.selectedIndex]?.textContent.trim() ||
    "Email Outreach"

  const payload = {
    company_name: name,
    country_id: countryId ? Number(countryId) : null,
    mgmt_type_id: mgmtId ? Number(mgmtId) : null,
    stage_id: stageId,
    month: monthVal,
    status_detail: statusVal || null,
  }

  try {
    const savedRaw = wasEdit
      ? await window.NsApi.updateCompany(editingCompanyId, payload)
      : await window.NsApi.createCompany(payload)
    const savedRow =
      savedRaw &&
      (savedRaw.id != null ? savedRaw : savedRaw.company || savedRaw)
    const savedId =
      (savedRow && (savedRow.id ?? savedRow.company_id)) ||
      editingCompanyId ||
      null

    if (!savedId) {
      // Response shape unexpected — reload from API so the new row still appears
      RAW_BASE = await loadCompaniesFromApi()
      closeCoModal()
      sortCol = "_id"
      sortDir = -1
      page = 1
      populate()
      applyFilters()
      nsToast(wasEdit ? "Company updated" : "Company added")
      return
    }

    const mapped = {
      _id: Number(savedId) || savedId,
      code: (savedRow && savedRow.company_code) || "",
      company: (savedRow && savedRow.company_name) || name,
      country: countryMatch
        ? countryMatch.country_name
        : (savedRow && savedRow.country_name) || "",
      mgmt_type:
        (mgmtMatch && mgmtMatch.type_name) ||
        (savedRow && savedRow.mgmt_type_name) ||
        "",
      status: statusVal,
      stage: stageName || (savedRow && savedRow.stage_name) || "Email Outreach",
      month: monthVal,
      date: (savedRow && savedRow.week_label) || "",
      reply_status: (savedRow && savedRow.reply_status) || "",
      is_retarget: !!(savedRow && Number(savedRow.is_retarget)),
      _contact_name: document.getElementById("co-contact-name").value.trim(),
      _contact_email: document.getElementById("co-contact-email").value.trim(),
      _contact_phone: document.getElementById("co-contact-phone").value.trim(),
      _follow_up: document.getElementById("co-followup").value,
    }

    const noteVal = document.getElementById("co-notes").value.trim()
    if (noteVal) {
      try {
        const createdNote = await window.NsApi.createNote({
          company_id: savedId,
          note_text: noteVal,
        })
        const nk2 = name.toLowerCase().trim()
        migrateNote(nk2)
        if (!notes[nk2]) notes[nk2] = []
        const ts2 = new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        const noteId = createdNote && (createdNote.id ?? createdNote.note_id)
        notes[nk2].push({
          id: noteId != null && noteId !== "" ? Number(noteId) || noteId : null,
          text: noteVal,
          ts: ts2,
        })
        saveNotes()
      } catch (err) {
        nsToast(
          "Company saved, but the note failed to save: " +
            (err instanceof Error ? err.message : "unknown error"),
          "error",
        )
      }
    }

    const followUpVal = document.getElementById("co-followup").value
    if (followUpVal) {
      const nk2 = name.toLowerCase().trim()
      try {
        const existingId = followUpIdByCompany[nk2]
        if (existingId) {
          await window.NsApi.updateFollowUp(existingId, {
            due_date: followUpVal,
          })
        } else {
          const createdFu = await window.NsApi.upsertFollowUp({
            company_id: savedId,
            due_date: followUpVal,
          })
          followUpIdByCompany[nk2] = createdFu && createdFu.id
        }
        followUps[nk2] = followUpVal
        saveFollowUps()
      } catch (err) {
        nsToast(
          "Company saved, but the follow-up failed to save: " +
            (err instanceof Error ? err.message : "unknown error"),
          "error",
        )
      }
    }

    const contactName = document.getElementById("co-contact-name").value.trim()
    const contactEmail = document
      .getElementById("co-contact-email")
      .value.trim()
    const contactPhone = document
      .getElementById("co-contact-phone")
      .value.trim()
    if (contactName || contactEmail || contactPhone) {
      try {
        await window.NsApi.createContact({
          company_id: savedId,
          contact_name: contactName || name,
          email: contactEmail || null,
          phone: contactPhone || null,
        })
      } catch (err) {
        /* contact is best-effort */
      }
    }

    if (wasEdit) {
      const idx = RAW_BASE.findIndex((r) => r._id === editingCompanyId)
      if (idx >= 0) RAW_BASE[idx] = { ...RAW_BASE[idx], ...mapped }
      else RAW_BASE.push(mapped)
    } else {
      RAW_BASE = RAW_BASE.filter((r) => r._id !== mapped._id)
      RAW_BASE.push(mapped)
      sortCol = "_id"
      sortDir = -1
      page = 1
    }

    // Refresh from API so pipeline always matches the server
    try {
      RAW_BASE = await loadCompaniesFromApi()
    } catch (e) {
      /* keep local mapped row */
    }

    closeCoModal()
    populate()
    applyFilters()
    populateLeadFilters()
    if (typeof renderLeads === "function") renderLeads()
    nsToast(wasEdit ? "Company updated" : "Company added")
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Save failed", "error")
  }
}

// NOTES
function addNote(company) {
  openNote(company, "")
}
let activeNoteKey = ""
let activeNoteLeadId = null
// notes[key] = array of {id, text, ts} loaded from the API. Legacy plain-string
// entries (from before the DB migration) get migrated to a local-only entry
// with id:null — those can be viewed but not deleted via the API since they
// were never real rows.

function findLeadByName(company) {
  const nk = String(company || "")
    .replace(/&#39;/g, "'")
    .toLowerCase()
    .trim()
  if (!nk) return null
  return (
    (potentialLeads || []).find(
      (l) => (l.name || "").toLowerCase().trim() === nk,
    ) || null
  )
}

/** Seed notes[nk] from lead field / leadExtras when company notes aren't loaded yet. */
function seedNotesFromLead(companyOrKey, lead) {
  const nk = String(companyOrKey || "")
    .replace(/&#39;/g, "'")
    .toLowerCase()
    .trim()
  if (!nk || !lead) return
  migrateNote(nk)
  if (Array.isArray(notes[nk]) && notes[nk].length) return
  const extras = leadExtras[lead.id] || {}
  if (Array.isArray(extras.noteEntries) && extras.noteEntries.length) {
    notes[nk] = extras.noteEntries.map((e) => ({
      id: e.id != null ? e.id : null,
      text: e.text != null ? String(e.text) : String(e),
      ts: e.ts || null,
    }))
    return
  }
  const raw = lead.notes != null ? String(lead.notes).trim() : ""
  if (raw) {
    notes[nk] = [{ id: null, text: raw, ts: null }]
  }
}

function persistLeadNoteEntries(lead, nk) {
  if (!lead || lead.id == null) return
  const entries = Array.isArray(notes[nk]) ? notes[nk] : []
  const extras = { ...(leadExtras[lead.id] || {}) }
  extras.noteEntries = entries.map((e) => ({
    id: e.id != null ? e.id : null,
    text: e.text,
    ts: e.ts || null,
  }))
  leadExtras[lead.id] = extras
  saveLeadExtras()
  const joined = entries
    .map((e) => (e && e.text != null ? String(e.text) : ""))
    .filter(Boolean)
    .join("\n")
  lead.notes = joined
}

function refreshAfterNoteChange() {
  if (typeof renderTable === "function") renderTable()
  if (typeof renderLeads === "function") renderLeads()
}

function migrateNote(key) {
  const v = notes[key]
  if (!v) return
  if (typeof v === "string") {
    const lines = v
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
    notes[key] = lines.map((l) => ({ id: null, text: l, ts: null }))
  }
}
function renderNoteHistory(key) {
  migrateNote(key)
  const entries = notes[key] || []
  const hist = document.getElementById("note-history")
  if (!entries.length) {
    hist.innerHTML =
      '<div style="color:#64748b;font-size:.72rem;text-align:center;padding:10px">No notes yet</div>'
    return
  }
  hist.innerHTML = [...entries]
    .reverse()
    .map((e) => {
      const idAttr = e.id != null && e.id !== "" ? String(e.id) : ""
      return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:9px 11px;position:relative">
      ${e.ts ? `<div style="font-size:.6rem;color:#64748b;margin-bottom:4px">${esc(formatNoteTs(e.ts))}</div>` : ""}
      <div style="font-size:.73rem;color:#334155;white-space:pre-wrap;padding-right:16px">${esc(e.text)}</div>
      <button type="button" class="note-del-btn" data-note-id="${esc(idAttr)}" title="Delete note" style="position:absolute;top:6px;right:8px;background:none;border:none;color:#64748b;cursor:pointer;font-size:.7rem;padding:0;line-height:1">✕</button>
    </div>`
    })
    .join("")
}
function formatNoteTs(ts) {
  if (!ts) return ""
  const s = String(ts)
  if (/[a-z]/i.test(s) && !/^\d{4}-\d{2}-\d{2}/.test(s)) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
function noteIdsMatch(a, b) {
  if (a == null || a === "" || b == null || b === "") return false
  return String(a) === String(b)
}
async function deleteNote(id) {
  if (!notes[activeNoteKey]) return
  const list = notes[activeNoteKey]
  const hasId = id != null && id !== "" && id !== "null" && id !== "undefined"
  const isLocalId = hasId && String(id).startsWith("local-")
  if (hasId && !isLocalId) {
    try {
      await window.NsApi.deleteNote(id)
    } catch (err) {
      nsToast(err instanceof Error ? err.message : "Delete failed", "error")
      return
    }
    notes[activeNoteKey] = list.filter((e) => !noteIdsMatch(e.id, id))
  } else if (hasId && isLocalId) {
    notes[activeNoteKey] = list.filter((e) => !noteIdsMatch(e.id, id))
  } else {
    // Legacy local-only note (no DB id): drop the first id-less entry
    let removed = false
    notes[activeNoteKey] = list.filter((e) => {
      if (!removed && (e.id == null || e.id === "")) {
        removed = true
        return false
      }
      return true
    })
  }
  if (!notes[activeNoteKey].length) delete notes[activeNoteKey]
  const lead =
    (activeNoteLeadId != null &&
      (potentialLeads || []).find((l) => sameLeadId(l.id, activeNoteLeadId))) ||
    findLeadByName(activeNoteKey)
  if (lead) {
    persistLeadNoteEntries(lead, activeNoteKey)
    try {
      await window.NsApi.updateLead(lead.id, {
        notes: lead.notes || null,
      })
    } catch (err) {
      console.warn("[deleteNote] lead notes sync failed:", err)
    }
  }
  renderNoteHistory(activeNoteKey)
  refreshAfterNoteChange()
}
window.deleteNote = deleteNote
function syncNoteSaveBtn() {
  const ta = document.getElementById("note-text")
  const btn = document.getElementById("note-save-btn")
  if (!ta || !btn) return
  btn.style.display = ta.value.trim() ? "" : "none"
}
function openNote(company, country, leadId) {
  activeNoteKey = company.replace(/&#39;/g, "'").toLowerCase().trim()
  activeNoteLeadId = leadId != null && leadId !== "" ? leadId : null
  const lead =
    (activeNoteLeadId != null &&
      (potentialLeads || []).find((l) => sameLeadId(l.id, activeNoteLeadId))) ||
    findLeadByName(company)
  if (lead) {
    if (activeNoteLeadId == null) activeNoteLeadId = lead.id
    seedNotesFromLead(activeNoteKey, lead)
  }
  document.getElementById("modal-co").textContent = company.replace(
    /&#39;/g,
    "'",
  )
  document.getElementById("modal-sub").textContent = (country || "").replace(
    /&#39;/g,
    "'",
  )
  document.getElementById("note-text").value = ""
  syncNoteSaveBtn()
  renderNoteHistory(activeNoteKey)
  document.getElementById("note-modal").classList.add("open")
  setTimeout(() => document.getElementById("note-text").focus(), 50)
}
function openLeadNote(leadId) {
  const lead = (potentialLeads || []).find((l) => sameLeadId(l.id, leadId))
  if (!lead) {
    nsToast("Lead not found — refresh and try again.", "error")
    return
  }
  openNote(lead.name || "", lead.country || "", lead.id)
}
function closeNote() {
  document.getElementById("note-modal").classList.remove("open")
  activeNoteLeadId = null
}
async function saveNote() {
  const v = document.getElementById("note-text").value.trim()
  if (!v) return
  const company = document.getElementById("modal-co").textContent
  const companyId = resolveCompanyId(company)
  const lead =
    (activeNoteLeadId != null &&
      (potentialLeads || []).find((l) => sameLeadId(l.id, activeNoteLeadId))) ||
    findLeadByName(company)
  const ts = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  try {
    let noteId = null
    if (companyId) {
      const created = await window.NsApi.createNote({
        company_id: companyId,
        note_text: v,
      })
      const newId = created && (created.id ?? created.note_id ?? created)
      noteId = typeof newId === "object" && newId ? newId.id : newId
    } else if (lead && lead.id != null) {
      noteId = "local-" + Date.now()
    } else {
      nsToast(
        "This row has no database id — refresh the page and try again.",
        "error",
      )
      return
    }

    migrateNote(activeNoteKey)
    if (!notes[activeNoteKey]) notes[activeNoteKey] = []
    notes[activeNoteKey].push({
      id: noteId != null && noteId !== "" ? Number(noteId) || noteId : null,
      text: v,
      ts,
    })

    if (lead) {
      persistLeadNoteEntries(lead, activeNoteKey)
      try {
        await window.NsApi.updateLead(lead.id, {
          notes: lead.notes || null,
        })
      } catch (err) {
        console.warn("[saveNote] lead notes sync failed:", err)
      }
    }

    document.getElementById("note-text").value = ""
    syncNoteSaveBtn()
    renderNoteHistory(activeNoteKey)
    refreshAfterNoteChange()
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Save failed", "error")
  }
}
window.syncNoteSaveBtn = syncNoteSaveBtn
window.openNote = openNote
window.openLeadNote = openLeadNote
window.closeNote = closeNote
window.saveNote = saveNote
window.addNote = addNote
function bindOnce(id, event, handler) {
  const el = document.getElementById(id)
  if (!el || el.dataset.nsBound === "1") return
  el.dataset.nsBound = "1"
  el.addEventListener(event, handler)
}
bindOnce("note-modal", "click", function (e) {
  if (e.target === this) closeNote()
})
bindOnce("note-text", "input", syncNoteSaveBtn)
bindOnce("note-history", "click", function (e) {
  const btn = e.target && e.target.closest && e.target.closest(".note-del-btn")
  if (!btn) return
  e.preventDefault()
  e.stopPropagation()
  deleteNote(btn.getAttribute("data-note-id"))
})
bindOnce("co-modal", "click", function (e) {
  if (e.target === this) closeCoModal()
})
bindOnce("lead-modal", "click", function (e) {
  if (e.target === this) closeLeadModal()
})
if (!window.__nsKeydownBound) {
  window.__nsKeydownBound = true
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeNote()
      closeCoModal()
      closeLeadModal()
      const sd = document.getElementById("stage-drop")
      if (sd) sd.classList.remove("open")
    }
  })
}

// WEEKLY TRACKER
const TYPE_LABEL = {
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  meeting: "Meeting",
  task: "Task",
  demo: "Task",
  note: "Note",
  "follow-up": "Task",
  prospected: "Prospected",
  "not-interested": "Not Interested",
}
const TYPE_ICON_SVG = {
  call: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  email:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  meeting:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  task: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>',
  whatsapp:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  linkedin:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>',
  note: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  "follow-up":
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>',
  prospected:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>',
  "not-interested":
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/></svg>',
}
let editingCommId = null
let weeklyFilter = "all"
let weeklyFormOpen = false

function activityTitle(c) {
  const co = (c.company || "").trim()
  if (c.type === "call") return co ? `Called ${co}` : "Call logged"
  if (c.type === "email") return co ? `Email sent to ${co}` : "Email sent"
  if (c.type === "meeting") {
    return co ? `Meeting report — ${co}` : "Meeting report"
  }
  if (c.type === "prospected") {
    return co ? `Prospected — ${co}` : "Prospected"
  }
  if (c.type === "not-interested") {
    return co ? `Not interested — ${co}` : "Not Interested"
  }
  if (c.type === "task" || c.type === "demo" || c.type === "follow-up") {
    if (c.text && co) return `${c.text.split("\n")[0].slice(0, 60)} – ${co}`
    if (c.text) return c.text.split("\n")[0].slice(0, 80)
    return co ? `Task – ${co}` : "Task"
  }
  if (c.type === "whatsapp") return co ? `WhatsApp – ${co}` : "WhatsApp message"
  if (c.type === "linkedin")
    return co ? `LinkedIn – ${co}` : "LinkedIn activity"
  return co || TYPE_LABEL[c.type] || "Activity"
}

function activityDescription(c) {
  if (c.type === "task" || c.type === "demo" || c.type === "follow-up") {
    const title = activityTitle(c)
    if (c.text && title.startsWith(c.text.split("\n")[0].slice(0, 60))) {
      const rest = c.text.split("\n").slice(1).join("\n").trim()
      return rest || (c.company ? `Follow-up for ${c.company}` : "")
    }
  }
  return c.text || ""
}

function startOfWeekMonday(date) {
  const mon = new Date(date)
  mon.setHours(12, 0, 0, 0)
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
  return mon
}

function weekOffsetFromDate(date) {
  const targetMon = startOfWeekMonday(date)
  const todayMon = startOfWeekMonday(new Date())
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return Math.round((targetMon.getTime() - todayMon.getTime()) / msPerWeek)
}

function formatRangeLabel(fromStr, toStr) {
  const from = new Date(fromStr + "T12:00:00")
  const to = new Date(toStr + "T12:00:00")
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return ""
  const sameMonth =
    from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  if (sameMonth) {
    const monthYear = from.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    })
    return `${from.getDate()} – ${to.getDate()} ${monthYear}`
  }
  const fmt = (d) =>
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  return `${fmt(from)} – ${fmt(to)}`
}

function getWeekRange(offset) {
  const mon = startOfWeekMonday(new Date())
  mon.setDate(mon.getDate() + offset * 7)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const toYmd =
    typeof localDateInputValue === "function"
      ? localDateInputValue
      : (d) => {
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, "0")
          const day = String(d.getDate()).padStart(2, "0")
          return `${y}-${m}-${day}`
        }
  const monStr = toYmd(mon)
  const sunStr = toYmd(sun)
  return {
    monStr,
    sunStr,
    label: formatRangeLabel(monStr, sunStr),
  }
}

/** Active from/to range for Weekly Tracker (falls back to current weekOffset). */
function getActiveWeeklyRange() {
  const fromEl = document.getElementById("wk-date-from")
  const toEl = document.getElementById("wk-date-to")
  let fromStr = fromEl && fromEl.value
  let toStr = toEl && toEl.value
  if (!fromStr || !toStr) {
    const fallback = getWeekRange(weekOffset)
    fromStr = fromStr || fallback.monStr
    toStr = toStr || fallback.sunStr
  }
  if (fromStr > toStr) {
    const tmp = fromStr
    fromStr = toStr
    toStr = tmp
  }
  return {
    monStr: fromStr,
    sunStr: toStr,
    label: formatRangeLabel(fromStr, toStr),
  }
}

function syncWeekDatePickers(force) {
  const fromEl = document.getElementById("wk-date-from")
  const toEl = document.getElementById("wk-date-to")
  if (!fromEl || !toEl) return
  const { monStr, sunStr } = getWeekRange(weekOffset)
  if (force || !fromEl.value) fromEl.value = monStr
  if (force || !toEl.value) toEl.value = sunStr
}

function shiftDateStr(ymd, days) {
  const d = new Date(ymd + "T12:00:00")
  if (Number.isNaN(d.getTime())) return ymd
  d.setDate(d.getDate() + days)
  return typeof localDateInputValue === "function"
    ? localDateInputValue(d)
    : d.toISOString().slice(0, 10)
}

function changeWeek(dir) {
  const fromEl = document.getElementById("wk-date-from")
  const toEl = document.getElementById("wk-date-to")
  const delta = dir * 7
  if (fromEl && toEl && fromEl.value && toEl.value) {
    fromEl.value = shiftDateStr(fromEl.value, delta)
    toEl.value = shiftDateStr(toEl.value, delta)
    // Keep weekOffset roughly aligned with the from-date week
    const d = new Date(fromEl.value + "T12:00:00")
    if (!Number.isNaN(d.getTime())) weekOffset = weekOffsetFromDate(d)
  } else {
    weekOffset += dir
    syncWeekDatePickers(true)
  }
  renderWeekly()
}
function goToday() {
  weekOffset = 0
  syncWeekDatePickers(true)
  renderWeekly()
}
function onWeekRangeChanged() {
  const fromEl = document.getElementById("wk-date-from")
  const toEl = document.getElementById("wk-date-to")
  if (!fromEl || !toEl) return
  if (fromEl.value && toEl.value && fromEl.value > toEl.value) {
    // Keep range valid: if from moves past to, bump to; if to moves before from, bump from
    if (document.activeElement === fromEl) toEl.value = fromEl.value
    else fromEl.value = toEl.value
  }
  if (fromEl.value) {
    const d = new Date(fromEl.value + "T12:00:00")
    if (!Number.isNaN(d.getTime())) weekOffset = weekOffsetFromDate(d)
  }
  renderWeekly()
}
function setWeeklyFilter(filter) {
  weeklyFilter = filter || "all"
  document.querySelectorAll("#wk-tabs .wk-tab").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-filter") === weeklyFilter,
    )
  })
  renderWeekly()
}
function toggleCommForm(show) {
  weeklyFormOpen = show !== undefined ? !!show : !weeklyFormOpen
  const form = document.getElementById("comm-form")
  if (!form) return
  form.style.display = weeklyFormOpen ? "block" : "none"
  if (weeklyFormOpen) {
    const dateEl = document.getElementById("cf-date")
    if (dateEl && !dateEl.value) {
      dateEl.value =
        typeof localDateInputValue === "function"
          ? localDateInputValue(new Date())
          : new Date().toISOString().slice(0, 10)
    }
    const textEl = document.getElementById("cf-text")
    if (textEl) textEl.focus()
  } else {
    cancelCommEdit()
  }
}
function formatWeeklySideDate(c, rangeStartStr) {
  // Prefer real clock time from logged activities
  if (c.timeStr) return c.timeStr
  // Concrete activity / pipeline day — must match From–To filter date
  if (c.date && /^\d{4}-\d{2}-\d{2}$/.test(c.date)) {
    const d = new Date(c.date + "T12:00:00")
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    }
  }
  // Pipeline week label when it looks like a range ("21 – 24 Jul")
  if (
    c.weekLabel &&
    /\d/.test(c.weekLabel) &&
    !/^20\d{2}\s/i.test(c.weekLabel)
  ) {
    return c.weekLabel
  }
  if (c.synthetic) {
    const start =
      rangeStartStr ||
      getActiveWeeklyRange().monStr ||
      getWeekRange(weekOffset).monStr
    const d = new Date(start + "T12:00:00")
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
      })
    }
  }
  return "—"
}

function openWeeklyEntry(companyId, event) {
  if (event) {
    if (
      event.target.closest(".tl-actions") ||
      event.target.closest(".row-action-btn")
    ) {
      return
    }
  }
  const id = Number(companyId)
  const row = RAW_BASE.find((r) => r._id === id || r._id === companyId)
  if (!row) {
    nsToast("Company not found — refresh and try again.", "error")
    return
  }
  openAddCompany(row)
}

/**
 * Weekly Tracker only lists activities for companies still active in the
 * pipeline (same set as getAllCompanies: not deleted, country enabled).
 * Orphaned rows (deleted company / missing company_id) are hidden.
 */
function getActiveWeeklyCompanySets() {
  const ids = new Set()
  const names = new Set()
  getAllCompanies().forEach((r) => {
    if (r._id != null && r._id !== "") {
      const num = Number(r._id)
      if (!Number.isNaN(num)) ids.add(num)
    }
    const nk = String(r.company || "")
      .toLowerCase()
      .trim()
    if (nk) names.add(nk)
  })
  return { ids, names }
}

function isActiveCompanyActivity(c, sets) {
  if (!c) return false
  const active = sets || getActiveWeeklyCompanySets()
  if (c.company_id != null && c.company_id !== "") {
    const num = Number(c.company_id)
    if (!Number.isNaN(num) && active.ids.has(num)) return true
  }
  const name = String(c.company || "")
    .toLowerCase()
    .trim()
  return !!(name && active.names.has(name))
}

function renderWeekly() {
  const listEl = document.getElementById("comm-list")
  if (!listEl) return
  syncWeekDatePickers(false)
  const { monStr, sunStr } = getActiveWeeklyRange()
  const dateEl = document.getElementById("cf-date")
  if (dateEl && !dateEl.value) {
    dateEl.value =
      typeof localDateInputValue === "function"
        ? localDateInputValue(new Date())
        : new Date().toISOString().slice(0, 10)
  }
  const activeCos = getActiveWeeklyCompanySets()
  // Strict From–To match only (no whole-month pipeline bleed).
  // Active companies only — hide orphaned / deleted-company activities.
  let wc = comms
    .filter(
      (c) =>
        c.date &&
        c.date >= monStr &&
        c.date <= sunStr &&
        isActiveCompanyActivity(c, activeCos),
    )
    .sort((a, b) => b.ts - a.ts || (b.date || "").localeCompare(a.date || ""))
  if (weeklyFilter && weeklyFilter !== "all") {
    wc = wc.filter((c) => {
      if (weeklyFilter === "task") {
        return c.type === "task" || c.type === "demo" || c.type === "follow-up"
      }
      return c.type === weeklyFilter
    })
  }
  const real = wc.filter((c) => !c.synthetic)
  const synth = wc.filter((c) => c.synthetic)
  const SYNTH_CAP = 80
  const synthHidden = Math.max(0, synth.length - SYNTH_CAP)
  wc = real
    .concat(synth.slice(0, SYNTH_CAP))
    .sort((a, b) => b.ts - a.ts || (b.date || "").localeCompare(a.date || ""))
  if (!wc.length) {
    listEl.innerHTML =
      '<div class="comm-empty">No activities logged this week yet — click + Log Activity to add one</div>'
    return
  }
  listEl.innerHTML =
    wc
      .map((c) => {
        const iconType =
          c.type === "demo" || c.type === "follow-up"
            ? "task"
            : c.type || "note"
        const desc = activityDescription(c)
        const idLit = esc(JSON.stringify(c.id))
        const badge =
          c.type === "meeting" ? "Meeting" : TYPE_LABEL[c.type] || c.type
        const sideDate = formatWeeklySideDate(c, monStr)
        const coIdLit = JSON.stringify(c.company_id || "")
        const actionsHtml = c.synthetic
          ? `<div class="tl-actions"><span class="tl-pipe-tag" title="From pipeline stage">Pipeline</span></div>`
          : `<div class="tl-actions row-actions">${rowActionButton("edit", `commActionEdit(event,${idLit})`, "Edit")}${rowActionButton("delete", `commActionDelete(event,${idLit})`, "Delete", "is-danger")}</div>`
        return `
      <div class="tl-entry tl-entry-clickable" role="button" tabindex="0" onclick='openWeeklyEntry(${coIdLit}, event)' onkeydown='if(event.key==="Enter"||event.key===" "){event.preventDefault();openWeeklyEntry(${coIdLit}, event)}'>
        <div class="tl-time">${esc(sideDate)}</div>
        <div class="tl-rail">
          <div class="tl-icon ti-${iconType}">${TYPE_ICON_SVG[iconType] || TYPE_ICON_SVG.note}</div>
        </div>
        <div class="tl-body">
          <div class="tl-hdr">
            <span class="tl-title">${esc(activityTitle(c))}</span>
            <span class="ce-type ct-${iconType}">${esc(badge)}</span>
          </div>
          ${desc ? `<div class="tl-txt">${esc(desc).replace(/\n/g, "<br>")}</div>` : ""}
        </div>
        ${actionsHtml}
      </div>`
      })
      .join("") +
    (synthHidden
      ? `<div class="comm-empty" style="padding:16px">+ ${synthHidden} more from pipeline this month — filter by Emails or Meetings, or narrow the week</div>`
      : "")
}
function commActionEdit(event, id) {
  event.stopPropagation()
  openEditComm(id)
}

function commActionDelete(event, id) {
  event.stopPropagation()
  deleteComm(id)
}

window.commActionEdit = commActionEdit
window.commActionDelete = commActionDelete

async function addComm() {
  const company = document.getElementById("cf-company").value.trim()
  const type = document.getElementById("cf-type").value
  const text = document.getElementById("cf-text").value.trim()
  const date = document.getElementById("cf-date").value
  if (!text) {
    document.getElementById("cf-text").style.borderColor = "#dc2626"
    setTimeout(
      () => (document.getElementById("cf-text").style.borderColor = ""),
      1200,
    )
    return
  }
  const activityType = ACTIVITY_UI_TO_API[type] || "Call"
  const companyId = company ? resolveCompanyId(company) : null
  if (company && !companyId) {
    nsToast(
      "Company not found in pipeline — pick a company from the list.",
      "error",
    )
    return
  }
  if (!companyId) {
    nsToast("Select a company to log this activity.", "error")
    return
  }
  const payload = {
    company_id: companyId,
    activity_type: activityType,
    activity_date: date || new Date().toISOString().slice(0, 10),
    notes: text,
  }
  try {
    if (editingCommId !== null) {
      await window.NsApi.updateActivity(editingCommId, payload)
      const idx = comms.findIndex((c) => c.id === editingCommId)
      if (idx >= 0) {
        comms[idx] = {
          ...comms[idx],
          company,
          company_id: companyId,
          type,
          text,
          date: payload.activity_date,
        }
      }
      editingCommId = null
      document.getElementById("comm-edit-banner").style.display = "none"
      document.getElementById("comm-save-btn").textContent = "+ Log Activity"
      renderTable()
      updateKPIs()
      nsToast("Activity updated")
    } else {
      const created = await window.NsApi.createActivity(payload)
      const now = new Date()
      comms.unshift({
        id: created.id,
        company_id: companyId,
        company,
        type,
        text,
        date: payload.activity_date,
        ts: now.getTime(),
        timeStr: formatActivityTime(now.toISOString()),
      })
      if (type === "call") {
        const nk = company.toLowerCase().trim()
        callActivityIdByCompany[nk] = created.id
        renderTable()
        updateKPIs()
      }
      nsToast("Activity logged")
    }
    saveComms()
    document.getElementById("cf-company").value = ""
    document.getElementById("cf-text").value = ""
    toggleCommForm(false)
    renderWeekly()
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Save failed", "error")
  }
}
function openEditComm(id) {
  const c = comms.find((e) => e.id === id)
  if (!c) return
  if (c.synthetic) {
    nsToast(
      "This entry comes from the pipeline stage. Change the company stage or log a new activity.",
      "error",
    )
    return
  }
  editingCommId = id
  document.getElementById("cf-company").value = c.company || ""
  const typeEl = document.getElementById("cf-type")
  const allowed = ["call", "email", "meeting", "task", "whatsapp", "linkedin"]
  typeEl.value = allowed.includes(c.type) ? c.type : "task"
  document.getElementById("cf-text").value = c.text || ""
  document.getElementById("cf-date").value = c.date || ""
  document.getElementById("comm-edit-banner").style.display = "flex"
  document.getElementById("comm-save-btn").textContent = "✓ Save Changes"
  toggleCommForm(true)
  document.getElementById("cf-text").focus()
}
function cancelCommEdit() {
  editingCommId = null
  const companyEl = document.getElementById("cf-company")
  const textEl = document.getElementById("cf-text")
  const banner = document.getElementById("comm-edit-banner")
  const saveBtn = document.getElementById("comm-save-btn")
  if (companyEl) companyEl.value = ""
  if (textEl) textEl.value = ""
  if (banner) banner.style.display = "none"
  if (saveBtn) saveBtn.textContent = "+ Log Activity"
}
async function deleteComm(id) {
  const removed = comms.find((c) => c.id === id)
  if (!removed) return
  if (removed.synthetic) {
    nsToast(
      "Pipeline entries can’t be deleted here — change the company stage instead.",
      "error",
    )
    return
  }
  const confirmed = await nsConfirmDelete({
    title: "Delete this activity?",
    text: `"${activityTitle(removed)}" will be removed from your weekly tracker.`,
  })
  if (!confirmed) return
  try {
    if (window.NsApi) await window.NsApi.deleteActivity(id)
    comms = comms.filter((c) => c.id !== id)
    if (removed.type === "call") {
      const nk = (removed.company || "").toLowerCase().trim()
      if (nk && callActivityIdByCompany[nk] === id) {
        delete callActivityIdByCompany[nk]
      }
      renderTable()
      updateKPIs()
    }
    if (editingCommId === id) cancelCommEdit()
    saveComms()
    renderWeekly()
    nsToast("Activity deleted")
  } catch (err) {
    nsToast(err instanceof Error ? err.message : "Delete failed", "error")
  }
}

// POTENTIAL LEADS
let editingLeadIdx = -1
let leadSortCol = "status",
  leadSortDir = 1,
  leadPage = 1
const LEAD_STATUS_TONE = {
  New: "tone-muted",
  Contacted: "tone-blue",
  Qualified: "tone-green",
  Converted: "tone-amber",
  "Not Qualified": "tone-red",
}
const LEAD_CARD_PER_PAGE = 24
const LEAD_LIST_PER_PAGE = 50
let leadsViewMode =
  localStorage.getItem("ns_leads_view") === "grid" ? "grid" : "list"
let activeLead = null
let leadActionsTarget = null

function setLeadsView(mode) {
  leadsViewMode = mode === "grid" ? "grid" : "list"
  localStorage.setItem("ns_leads_view", leadsViewMode)
  const panel = document.getElementById("panel-leads")
  if (panel) panel.setAttribute("data-view", leadsViewMode)
  syncLeadsViewButtons()
  renderLeads()
}
window.setLeadsView = setLeadsView

function syncLeadsViewButtons() {
  const listBtn = document.getElementById("leads-view-list")
  const gridBtn = document.getElementById("leads-view-grid")
  if (listBtn) listBtn.classList.toggle("active", leadsViewMode === "list")
  if (gridBtn) gridBtn.classList.toggle("active", leadsViewMode === "grid")
  const panel = document.getElementById("panel-leads")
  if (panel) panel.setAttribute("data-view", leadsViewMode)
}

function leadPerPage() {
  return leadsViewMode === "list" ? LEAD_LIST_PER_PAGE : LEAD_CARD_PER_PAGE
}

function ensureLeadActionsMenu() {
  if (document.getElementById("lead-actions-menu")) return
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="lead-actions-menu" style="display:none;position:fixed;z-index:9999;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.12);min-width:150px;overflow:hidden">
    <button type="button" onclick="handleLeadActionPromote()" style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:.76rem;color:#0f172a">＋ Add to Pipeline</button>
    <button type="button" onclick="handleLeadActionEdit()" style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:.76rem;color:#0f172a;border-top:1px solid #f1f5f9">✏️ Edit</button>
    <button type="button" onclick="handleLeadActionDelete()" style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:.76rem;color:#dc2626;border-top:1px solid #f1f5f9">🗑️ Delete</button>
  </div>`,
  )
}

function openLeadActions(event, idx, id) {
  event.stopPropagation()
  ensureLeadActionsMenu()
  leadActionsTarget = { idx, id }
  const menu = document.getElementById("lead-actions-menu")
  menu.style.display = "block"
  const rect = event.currentTarget.getBoundingClientRect()
  menu.style.top = Math.min(window.innerHeight - 140, rect.bottom + 4) + "px"
  menu.style.left = Math.min(window.innerWidth - 160, rect.right - 150) + "px"
}

function closeLeadActionsMenu() {
  const menu = document.getElementById("lead-actions-menu")
  if (menu) menu.style.display = "none"
}

function leadActionPromote(event, idx, id) {
  event.stopPropagation()
  leadActionsTarget = { idx, id }
  handleLeadActionPromote()
}

function leadActionEdit(event, idx, id) {
  event.stopPropagation()
  leadActionsTarget = { idx, id }
  handleLeadActionEdit()
}

function leadActionDelete(event, idx, id) {
  event.stopPropagation()
  leadActionsTarget = { idx, id }
  handleLeadActionDelete()
}

function handleLeadActionPromote() {
  closeLeadActionsMenu()
  if (!leadActionsTarget) return
  promoteLeadToPipeline(leadActionsTarget.idx)
}

function handleLeadActionEdit() {
  closeLeadActionsMenu()
  if (!leadActionsTarget) return
  openAddLead(leadActionsTarget.idx)
}

function handleLeadActionDelete() {
  closeLeadActionsMenu()
  if (!leadActionsTarget) return
  deleteLeadById(Number(leadActionsTarget.id))
}

window.openLeadActions = openLeadActions
window.handleLeadActionPromote = handleLeadActionPromote
window.handleLeadActionEdit = handleLeadActionEdit
window.handleLeadActionDelete = handleLeadActionDelete
window.leadActionPromote = leadActionPromote
window.leadActionEdit = leadActionEdit
window.leadActionDelete = leadActionDelete

if (!window.__nsLeadActionsOutsideBound) {
  window.__nsLeadActionsOutsideBound = true
  document.addEventListener("click", () => closeLeadActionsMenu())
}

/** Potential leads added via + Add Company (excludes converted / soft-deleted / disabled countries). */
function getPotentialLeadRows() {
  return potentialLeads.filter((r) => {
    const leadStatus = String(r.status || "")
    // Soft-delete uses the `status` column (active / inactive)
    if (leadStatus === "Converted") return false
    if (!isActiveLeadRecord(r)) return false
    // Settings: hide leads whose country was disabled
    if (!isActiveCountryName(r.country)) return false
    return true
  })
}

function populateLeadFormLookups() {
  const stageSel = document.getElementById("lead-stage")
  if (stageSel) {
    const curStage = stageSel.value
    stageSel.innerHTML = getDashboardStageOptions()
      .map(
        (name) =>
          `<option value="${esc(name)}"${name === curStage ? " selected" : ""}>${esc(name)}</option>`,
      )
      .join("")
    if (curStage && getDashboardStageOptions().includes(curStage))
      stageSel.value = curStage
    else if (!stageSel.value && stageSel.options.length) {
      const emailOpt = [...stageSel.options].find(
        (o) => o.value === "Email Outreach",
      )
      stageSel.value = emailOpt ? "Email Outreach" : stageSel.options[0].value
    }
  }
  const monthHidden = document.getElementById("lead-month")
  const curMonth = (monthHidden && monthHidden.value) || monthLabelNow()
  setFormMonthValue("lead", curMonth)
  renderLeadFormCountryOptions("")
  syncLeadFormCountryLabel()
  renderLeadFormMgmtOptions("")
  syncLeadFormMgmtLabel()
}

function renderLeadFormCountryOptions(filterText) {
  const list = document.getElementById("lead-form-country-list")
  const hidden = document.getElementById("lead-form-country")
  if (!list || !hidden) return
  const q = (filterText || "").trim().toLowerCase()
  const current = hidden.value
  const countries = getActiveCountryLookups()
    .map((c) => ({ id: String(c.id), label: c.country_name || "" }))
    .filter((c) => c.label)
    .sort((a, b) => a.label.localeCompare(b.label))
  const matches = q
    ? countries.filter((c) => c.label.toLowerCase().includes(q))
    : countries

  const items = []
  if (!q || "clear".startsWith(q) || q === "—" || q === "-") {
    items.push({ value: "", label: "—", selected: !current })
  }
  matches.forEach((c) => {
    items.push({
      value: c.id,
      label: c.label,
      selected: current === c.id,
    })
  })

  if (!items.length) {
    list.innerHTML = `<div class="ss-empty">No countries match “${esc((filterText || "").trim())}”</div>`
    return
  }

  list.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="ss-item${item.selected ? " selected" : ""}" role="option" aria-selected="${item.selected}" data-value="${esc(item.value)}" onclick="selectLeadFormCountry(this.getAttribute('data-value'))">${item.selected ? "✓ " : ""}${esc(item.label)}</button>`,
    )
    .join("")
}

function filterLeadFormCountryOptions() {
  const input = document.getElementById("lead-form-country-search")
  renderLeadFormCountryOptions(input ? input.value : "")
}

function toggleLeadFormCountryDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("lead-form-country-drop")
  const btn = document.getElementById("lead-form-country-btn")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeLeadCountryDrop()
    closePipelineCountryDrop()
    closeCoFormCountryDrop()
    closeLeadFormMgmtDrop()
    closeCoFormMgmtDrop()
    closeAllFormMonthDrops()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    positionCountryDrop(btn, drop)
    const search = document.getElementById("lead-form-country-search")
    if (search) {
      search.value = ""
      renderLeadFormCountryOptions("")
      setTimeout(() => search.focus(), 0)
    }
  } else {
    closeLeadFormCountryDrop()
  }
}

function closeLeadFormCountryDrop() {
  const drop = document.getElementById("lead-form-country-drop")
  const btn = document.getElementById("lead-form-country-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}

function selectLeadFormCountry(value) {
  const hidden = document.getElementById("lead-form-country")
  const label = document.getElementById("lead-form-country-label")
  if (!hidden || !label) return
  hidden.value = value || ""
  if (!value) {
    label.textContent = "—"
  } else {
    const match = getActiveCountryLookups().find(
      (c) => String(c.id) === String(value),
    )
    label.textContent = match ? match.country_name : "—"
  }
  closeLeadFormCountryDrop()
}

function syncLeadFormCountryLabel() {
  const hidden = document.getElementById("lead-form-country")
  const label = document.getElementById("lead-form-country-label")
  if (!hidden || !label) return
  if (!hidden.value) {
    label.textContent = "—"
    return
  }
  const match = getActiveCountryLookups().find(
    (c) => String(c.id) === String(hidden.value),
  )
  label.textContent = match ? match.country_name : "—"
}

function renderCoFormCountryOptions(filterText) {
  const list = document.getElementById("co-form-country-list")
  const hidden = document.getElementById("co-form-country")
  if (!list || !hidden) return
  const q = (filterText || "").trim().toLowerCase()
  const current = hidden.value
  const countries = getActiveCountryLookups()
    .map((c) => ({ id: String(c.id), label: c.country_name || "" }))
    .filter((c) => c.label)
    .sort((a, b) => a.label.localeCompare(b.label))
  const matches = q
    ? countries.filter((c) => c.label.toLowerCase().includes(q))
    : countries

  const items = []
  if (!q || "clear".startsWith(q) || q === "—" || q === "-") {
    items.push({ value: "", label: "—", selected: !current })
  }
  matches.forEach((c) => {
    items.push({
      value: c.id,
      label: c.label,
      selected: current === c.id,
    })
  })

  if (!items.length) {
    list.innerHTML = `<div class="ss-empty">No countries match “${esc((filterText || "").trim())}”</div>`
    return
  }

  list.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="ss-item${item.selected ? " selected" : ""}" role="option" aria-selected="${item.selected}" data-value="${esc(item.value)}" onclick="selectCoFormCountry(this.getAttribute('data-value'))">${item.selected ? "✓ " : ""}${esc(item.label)}</button>`,
    )
    .join("")
}

function filterCoFormCountryOptions() {
  const input = document.getElementById("co-form-country-search")
  renderCoFormCountryOptions(input ? input.value : "")
}

function toggleCoFormCountryDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("co-form-country-drop")
  const btn = document.getElementById("co-form-country-btn")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeLeadCountryDrop()
    closeLeadFormCountryDrop()
    closePipelineCountryDrop()
    closeLeadFormMgmtDrop()
    closeCoFormMgmtDrop()
    closeAllFormMonthDrops()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    positionCountryDrop(btn, drop)
    const search = document.getElementById("co-form-country-search")
    if (search) {
      search.value = ""
      renderCoFormCountryOptions("")
      setTimeout(() => search.focus(), 0)
    }
  } else {
    closeCoFormCountryDrop()
  }
}

function closeCoFormCountryDrop() {
  const drop = document.getElementById("co-form-country-drop")
  const btn = document.getElementById("co-form-country-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}

function selectCoFormCountry(value) {
  const hidden = document.getElementById("co-form-country")
  const label = document.getElementById("co-form-country-label")
  if (!hidden || !label) return
  hidden.value = value || ""
  if (!value) {
    label.textContent = "—"
  } else {
    const match = getActiveCountryLookups().find(
      (c) => String(c.id) === String(value),
    )
    label.textContent = match ? match.country_name : "—"
  }
  closeCoFormCountryDrop()
}

function syncCoFormCountryLabel() {
  const hidden = document.getElementById("co-form-country")
  const label = document.getElementById("co-form-country-label")
  if (!hidden || !label) return
  if (!hidden.value) {
    label.textContent = "—"
    return
  }
  const match = getActiveCountryLookups().find(
    (c) => String(c.id) === String(hidden.value),
  )
  label.textContent = match ? match.country_name : "—"
}

/** Searchable Management Type picker (same UX as Country / field-edit pop). */
function renderMgmtFormOptions(listId, hiddenId, selectFnName, filterText) {
  const list = document.getElementById(listId)
  const hidden = document.getElementById(hiddenId)
  if (!list || !hidden) return
  const q = (filterText || "").trim().toLowerCase()
  const current = hidden.value
  const types = getActiveMgmtTypeLookups()
    .map((t) => ({ id: String(t.id), label: t.type_name || "" }))
    .filter((t) => t.label)
    .sort((a, b) => a.label.localeCompare(b.label))
  const matches = q
    ? types.filter((t) => t.label.toLowerCase().includes(q))
    : types

  const items = []
  if (!q || "clear".includes(q) || q === "—" || q === "-") {
    items.push({ value: "", label: "— Clear —", selected: !current })
  }
  matches.forEach((t) => {
    items.push({
      value: t.id,
      label: t.label,
      selected: current === t.id,
    })
  })

  if (!items.length) {
    list.innerHTML = `<div class="ss-empty">No types match “${esc((filterText || "").trim())}”</div>`
    return
  }

  list.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="ss-item${item.selected ? " selected" : ""}" role="option" aria-selected="${item.selected}" data-value="${esc(item.value)}" onclick="${selectFnName}(this.getAttribute('data-value'))">${item.selected ? "✓ " : ""}${esc(item.label)}</button>`,
    )
    .join("")
}

function renderLeadFormMgmtOptions(filterText) {
  renderMgmtFormOptions(
    "lead-form-mgmt-list",
    "lead-form-mgmt",
    "selectLeadFormMgmt",
    filterText,
  )
}
function filterLeadFormMgmtOptions() {
  const input = document.getElementById("lead-form-mgmt-search")
  renderLeadFormMgmtOptions(input ? input.value : "")
}
function toggleLeadFormMgmtDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("lead-form-mgmt-drop")
  const btn = document.getElementById("lead-form-mgmt-btn")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeLeadFormCountryDrop()
    closeLeadCountryDrop()
    closePipelineCountryDrop()
    closePipelineMgmtDrop()
    closePipelineStageDrop()
    closeCoFormCountryDrop()
    closeCoFormMgmtDrop()
    closeAllFormMonthDrops()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    if (typeof positionCountryDrop === "function")
      positionCountryDrop(btn, drop)
    const search = document.getElementById("lead-form-mgmt-search")
    if (search) {
      search.value = ""
      renderLeadFormMgmtOptions("")
      setTimeout(() => search.focus(), 0)
    }
  } else {
    closeLeadFormMgmtDrop()
  }
}
function closeLeadFormMgmtDrop() {
  const drop = document.getElementById("lead-form-mgmt-drop")
  const btn = document.getElementById("lead-form-mgmt-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}
function selectLeadFormMgmt(value) {
  const hidden = document.getElementById("lead-form-mgmt")
  if (hidden) hidden.value = value || ""
  syncLeadFormMgmtLabel()
  closeLeadFormMgmtDrop()
}
function syncLeadFormMgmtLabel() {
  const hidden = document.getElementById("lead-form-mgmt")
  const label = document.getElementById("lead-form-mgmt-label")
  if (!hidden || !label) return
  if (!hidden.value) {
    label.textContent = "—"
    return
  }
  const match = (NS_LOOKUPS.mgmt_types || []).find(
    (t) => String(t.id) === String(hidden.value),
  )
  label.textContent = match ? match.type_name : "—"
}

function renderCoFormMgmtOptions(filterText) {
  renderMgmtFormOptions(
    "co-form-mgmt-list",
    "co-form-mgmt",
    "selectCoFormMgmt",
    filterText,
  )
}
function filterCoFormMgmtOptions() {
  const input = document.getElementById("co-form-mgmt-search")
  renderCoFormMgmtOptions(input ? input.value : "")
}
function toggleCoFormMgmtDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("co-form-mgmt-drop")
  const btn = document.getElementById("co-form-mgmt-btn")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeLeadFormCountryDrop()
    closeLeadFormMgmtDrop()
    closeLeadCountryDrop()
    closePipelineCountryDrop()
    closePipelineMgmtDrop()
    closePipelineStageDrop()
    closeCoFormCountryDrop()
    closeAllFormMonthDrops()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    if (typeof positionCountryDrop === "function")
      positionCountryDrop(btn, drop)
    const search = document.getElementById("co-form-mgmt-search")
    if (search) {
      search.value = ""
      renderCoFormMgmtOptions("")
      setTimeout(() => search.focus(), 0)
    }
  } else {
    closeCoFormMgmtDrop()
  }
}
function closeCoFormMgmtDrop() {
  const drop = document.getElementById("co-form-mgmt-drop")
  const btn = document.getElementById("co-form-mgmt-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}
function selectCoFormMgmt(value) {
  const hidden = document.getElementById("co-form-mgmt")
  if (hidden) hidden.value = value || ""
  syncCoFormMgmtLabel()
  closeCoFormMgmtDrop()
}
function syncCoFormMgmtLabel() {
  const hidden = document.getElementById("co-form-mgmt")
  const label = document.getElementById("co-form-mgmt-label")
  if (!hidden || !label) return
  if (!hidden.value) {
    label.textContent = "—"
    return
  }
  const match = (NS_LOOKUPS.mgmt_types || []).find(
    (t) => String(t.id) === String(hidden.value),
  )
  label.textContent = match ? match.type_name : "—"
}

function openAddLead(idx) {
  editingLeadIdx = idx !== undefined ? idx : -1
  const lead = idx !== undefined ? potentialLeads[idx] : null
  const countryHidden = document.getElementById("lead-form-country")
  if (countryHidden) {
    countryHidden.value = lead?.country_id ? String(lead.country_id) : ""
  }
  const stageSel = document.getElementById("lead-stage")
  if (stageSel) stageSel.value = lead?.stage || "Email Outreach"
  setFormMonthValue("lead", lead?.month || monthLabelNow())
  populateLeadFormLookups()
  if (stageSel) stageSel.value = lead?.stage || "Email Outreach"
  setFormMonthValue("lead", lead?.month || monthLabelNow())
  document.getElementById("lead-modal-title").textContent = lead
    ? "Edit Lead"
    : "Add Potential Lead"
  document.getElementById("lead-name").value = lead ? lead.name : ""
  document.getElementById("lead-contact").value = lead ? lead.contact : ""
  document.getElementById("lead-contact-email").value = lead
    ? lead.contact_email || ""
    : ""
  document.getElementById("lead-contact-phone").value = lead
    ? lead.contact_phone || ""
    : ""
  document.getElementById("lead-followup").value = lead
    ? lead.followup || ""
    : ""
  document.getElementById("lead-status-detail").value = lead
    ? lead.status_detail || ""
    : ""
  document.getElementById("lead-source").value = lead ? lead.source || "" : ""
  document.getElementById("lead-status").value = lead ? lead.status : "New"
  const mgmtHidden = document.getElementById("lead-form-mgmt")
  if (mgmtHidden) {
    mgmtHidden.value = lead?.mgmt_type_id ? String(lead.mgmt_type_id) : ""
  }
  renderLeadFormMgmtOptions("")
  syncLeadFormMgmtLabel()
  document.getElementById("lead-notes").value = ""
  document.getElementById("lead-notes").placeholder = lead
    ? "Add a new note..."
    : "Add a new note..."
  document.getElementById("lead-delete-btn").style.display = lead
    ? "block"
    : "none"
  closeLeadFormCountryDrop()
  closeLeadFormMgmtDrop()
  closeFormMonthDrop("lead")
  document.getElementById("lead-modal").classList.add("open")
  setTimeout(() => document.getElementById("lead-name").focus(), 50)
}
function closeLeadModal() {
  closeLeadFormCountryDrop()
  closeLeadFormMgmtDrop()
  closeFormMonthDrop("lead")
  document.getElementById("lead-modal").classList.remove("open")
}
async function saveLead() {
  const name = document.getElementById("lead-name").value.trim()
  if (!name) {
    document.getElementById("lead-name").style.borderColor = "#dc2626"
    setTimeout(
      () => (document.getElementById("lead-name").style.borderColor = ""),
      1200,
    )
    return
  }
  const countryId = document.getElementById("lead-form-country").value
  const mgmtId = document.getElementById("lead-form-mgmt").value
  const formMonth =
    document.getElementById("lead-month").value || monthLabelNow()
  const prevExtras =
    editingLeadIdx >= 0 && potentialLeads[editingLeadIdx]?.id
      ? leadExtras[potentialLeads[editingLeadIdx].id] || {}
      : {}
  const prevMonths = Array.isArray(prevExtras.months)
    ? prevExtras.months.filter(isValidMonthLabel)
    : []
  const months = [
    ...new Set(
      [...prevMonths, formMonth].filter((m) => m && isValidMonthLabel(m)),
    ),
  ]
  const extras = {
    contact: document.getElementById("lead-contact").value.trim(),
    contact_email: document.getElementById("lead-contact-email").value.trim(),
    contact_phone: document.getElementById("lead-contact-phone").value.trim(),
    status_detail: document.getElementById("lead-status-detail").value.trim(),
    month: formMonth,
    months,
    followup: document.getElementById("lead-followup").value || "",
    stage: document.getElementById("lead-stage").value || "Email Outreach",
    source: document.getElementById("lead-source").value.trim(),
    called: !!(prevExtras && prevExtras.called),
  }
  const payload = {
    company_name: name,
    country_id: countryId ? Number(countryId) : null,
    contact_name: extras.contact || null,
    source: extras.source || null,
    lead_status: document.getElementById("lead-status").value || "New",
    mgmt_type_id: mgmtId ? Number(mgmtId) : null,
    notes: document.getElementById("lead-notes").value.trim() || null,
  }
  const newNoteText = document.getElementById("lead-notes").value.trim()
  try {
    const wasEdit = editingLeadIdx >= 0 && !!potentialLeads[editingLeadIdx]?.id
    let savedId = wasEdit ? potentialLeads[editingLeadIdx].id : null
    if (wasEdit) {
      // Keep existing notes text on the lead row unless a new note was typed
      if (!newNoteText && potentialLeads[editingLeadIdx].notes) {
        payload.notes = potentialLeads[editingLeadIdx].notes
      } else if (newNoteText) {
        const nk = name.toLowerCase().trim()
        seedNotesFromLead(nk, potentialLeads[editingLeadIdx])
        const existing = Array.isArray(notes[nk]) ? notes[nk] : []
        const joined = existing
          .map((e) => (e && e.text != null ? String(e.text) : ""))
          .filter(Boolean)
          .join("\n")
        payload.notes = joined
          ? joined + (joined.endsWith(newNoteText) ? "" : "\n" + newNoteText)
          : newNoteText
      }
      await window.NsApi.updateLead(savedId, payload)
    } else {
      const created = await window.NsApi.createLead(payload)
      savedId =
        created &&
        (created.id ?? created.lead_id ?? (created.lead && created.lead.id))
    }
    if (savedId) {
      leadExtras[savedId] = { ...(leadExtras[savedId] || {}), ...extras }
      saveLeadExtras()
    }
    potentialLeads = await loadLeadsFromApi()
    if (savedId && newNoteText) {
      const saved = potentialLeads.find((l) => sameLeadId(l.id, savedId))
      const nk = name.toLowerCase().trim()
      if (saved) {
        seedNotesFromLead(nk, saved)
        migrateNote(nk)
        if (!notes[nk]) notes[nk] = []
        const last = notes[nk].length
          ? notes[nk][notes[nk].length - 1].text
          : ""
        if (newNoteText !== last) {
          notes[nk].push({
            id: "local-" + Date.now(),
            text: newNoteText,
            ts: new Date().toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })
          persistLeadNoteEntries(saved, nk)
        }
      }
    }
    closeLeadModal()
    populateLeadFilters()
    renderLeads()
    nsToast(wasEdit ? "Lead updated" : "Lead added")
  } catch (err) {
    alert(err.message || "Failed to save lead")
  }
}
function sameLeadId(a, b) {
  return a != null && b != null && String(a) === String(b)
}

function toggleLeadCall(leadId) {
  const lead = potentialLeads.find((l) => sameLeadId(l.id, leadId))
  if (!lead) return
  const extras = { ...(leadExtras[leadId] || {}) }
  extras.called = !extras.called
  leadExtras[leadId] = extras
  saveLeadExtras()
  lead.called = !!extras.called
  renderLeads()
}
window.toggleLeadCall = toggleLeadCall

/**
 * Soft-delete: set potential_leads.status from active → inactive (row stays in DB).
 * Prefer lead_deactivate.php (new Merlin file). Fallback: PUT status on leads.php.
 * Does NOT call DELETE (unpatched Merlin may hard-delete). Does NOT change lead_status.
 */
async function deactivateLead(id) {
  const isInactive = (row) =>
    String((row && row.status) || "").toLowerCase() === "inactive"

  let apiMsg = ""

  // 1) Dedicated soft-delete endpoint (upload api-patches/lead_deactivate.php)
  if (window.NsApi && typeof window.NsApi.deactivateLead === "function") {
    try {
      const deactivated = await window.NsApi.deactivateLead(id)
      if (isInactive(deactivated)) return deactivated
      apiMsg =
        "lead_deactivate.php responded but status is still '" +
        (deactivated && deactivated.status) +
        "'"
    } catch (err) {
      apiMsg =
        err && err.message ? String(err.message) : "lead_deactivate failed"
    }
  }

  // 2) Fallback: PUT status on leads.php (works after patched leads.php is live)
  try {
    const updated = await window.NsApi.updateLead(id, { status: "inactive" })
    if (isInactive(updated)) return updated
    if (!apiMsg) {
      apiMsg =
        "API accepted the update but status is still '" +
        (updated && updated.status) +
        "'"
    }
  } catch (err) {
    if (!apiMsg) {
      apiMsg = err && err.message ? String(err.message) : "Update failed"
    }
  }

  try {
    const row = await window.NsApi.getLead(id)
    if (isInactive(row)) return row
  } catch (_) {
    /* still active or blocked */
  }

  throw new Error(
    (apiMsg ? apiMsg + ". " : "") +
      "Upload api-patches/lead_deactivate.php to merlin.crafttechhub.com (same folder as auth.php), then try again.",
  )
}

function removeLeadFromLocalState(id) {
  potentialLeads = potentialLeads.filter((l) => !sameLeadId(l.id, id))
  populateLeadFilters()
  renderLeads()
}

async function refreshLeadsAfterDelete(id) {
  try {
    const fresh = await loadLeadsFromApi()
    potentialLeads = fresh.filter((l) => {
      if (sameLeadId(l.id, id)) return false
      const recordStatus = String(l.record_status || "active").toLowerCase()
      return recordStatus !== "inactive"
    })
    populateLeadFilters()
    renderLeads()
  } catch (_) {
    /* keep local removal */
  }
}

async function deleteLead() {
  if (editingLeadIdx < 0 || !potentialLeads[editingLeadIdx]?.id) return
  const lead = potentialLeads[editingLeadIdx]
  const id = lead.id
  await deleteLeadById(id)
  // If it was removed, close the edit modal
  if (!potentialLeads.some((l) => sameLeadId(l.id, id))) {
    closeLeadModal()
  }
}

async function deleteLeadById(id) {
  const lead = potentialLeads.find((l) => sameLeadId(l.id, id))
  if (!lead?.id) return

  const confirmed = await nsConfirmDelete({
    title: "Delete this lead?",
    text: '"' + lead.name + '" will be removed from Potential Leads.',
  })
  if (!confirmed) return

  const snapshot = potentialLeads.slice()
  // Hide immediately so the UI always responds to confirm
  removeLeadFromLocalState(id)

  try {
    await deactivateLead(lead.id)
    await refreshLeadsAfterDelete(lead.id)
    nsToast("Lead deleted")
  } catch (err) {
    potentialLeads = snapshot
    populateLeadFilters()
    renderLeads()
    const msg = err && err.message ? err.message : "Failed to delete lead"
    if (typeof Swal !== "undefined") {
      Swal.fire({ icon: "error", title: "Delete failed", text: msg })
    } else {
      alert(msg)
    }
  }
}

async function deleteLeadByIdx(idx) {
  const lead = potentialLeads[idx]
  if (!lead?.id) return
  return deleteLeadById(lead.id)
}
let confirmLeadIdx = null
function openConfirmContact(leadIdx) {
  confirmLeadIdx = leadIdx
  const lead = potentialLeads[leadIdx]
  document.getElementById("confirm-modal-title").textContent =
    "Confirm Contact — " + lead.name
  document.getElementById("confirm-notes").value = ""
  document.getElementById("confirm-method").value = "Email"
  populateConfirmStageOptions("Email Outreach")
  document.getElementById("confirm-modal").style.display = "flex"
  setTimeout(() => document.getElementById("confirm-notes").focus(), 50)
}
function closeConfirmModal() {
  document.getElementById("confirm-modal").style.display = "none"
}
async function saveConfirmContact() {
  const lead = potentialLeads[confirmLeadIdx]
  if (!lead?.id) {
    alert("This lead is missing an API id — reload and try again.")
    return
  }
  const method = document.getElementById("confirm-method").value
  const stage = document.getElementById("confirm-stage").value
  const noteText = document.getElementById("confirm-notes").value.trim()
  try {
    const stageMatch = (NS_LOOKUPS.stages || []).find(
      (s) => s.status_name === stage,
    )
    const company = await window.NsApi.convertLead(lead.id, {
      stage_id: stageMatch ? stageMatch.id : null,
      month: monthLabelNow(),
    })
    const nk = lead.name.toLowerCase().trim()
    const companyId = company && company.id
    if ((noteText || method) && companyId) {
      const text =
        method +
        " — " +
        new Date().toLocaleDateString("en-GB") +
        ": " +
        (noteText || "Contacted")
      try {
        await window.NsApi.createNote({
          company_id: companyId,
          note_text: text,
        })
      } catch (e) {
        /* note is best-effort */
      }
      if (!notes[nk]) notes[nk] = []
      if (typeof notes[nk] === "string")
        notes[nk] = [{ text: notes[nk], ts: null }]
      notes[nk].push({ text, ts: Date.now() })
      saveNotes()
    }
    const [companies, leads] = await Promise.all([
      loadCompaniesFromApi(),
      loadLeadsFromApi(),
    ])
    RAW_BASE = companies
    potentialLeads = leads
    closeConfirmModal()
    populateLeadFilters()
    renderLeads()
    applyFilters()
  } catch (err) {
    alert(err.message || "Failed to confirm contact")
  }
}
async function promoteLeadToPipeline(idx) {
  const lead = potentialLeads[idx]
  if (!lead?.id) {
    alert("This lead is missing an API id — reload and try again.")
    return
  }
  if (lead.status === "Converted") {
    alert("This lead is already in the pipeline.")
    return
  }

  const name = (lead.name || "").trim()
  if (!name) {
    alert("This lead has no company name.")
    return
  }
  const nk = name.toLowerCase()

  // If this name was soft-deleted locally, un-hide it so it can appear again
  if (deletedCos[nk]) {
    delete deletedCos[nk]
    saveDeleted()
  }

  const stageName = lead.stage || "Email Outreach"
  const stageMatch =
    (NS_LOOKUPS.stages || []).find((s) => s.status_name === stageName) ||
    (NS_LOOKUPS.stages || []).find((s) => s.status_name === "Email Outreach")
  const monthVal =
    lead.month && isValidMonthLabel(lead.month) ? lead.month : monthLabelNow()

  try {
    let companyId = null

    // Prefer API convert (creates company + marks lead Converted)
    try {
      const converted = await window.NsApi.convertLead(lead.id, {
        stage_id: stageMatch ? stageMatch.id : null,
        month: monthVal,
        country_id: lead.country_id || null,
        mgmt_type_id: lead.mgmt_type_id || null,
        status_detail: lead.status_detail || null,
      })
      companyId =
        converted &&
        (converted.id ??
          converted.company_id ??
          (converted.company && converted.company.id))
    } catch (convertErr) {
      console.warn("[promoteLeadToPipeline] convertLead failed:", convertErr)
    }

    // Reload and check whether the company is present
    RAW_BASE = await loadCompaniesFromApi()
    let existing = RAW_BASE.find(
      (r) => (r.company || "").toLowerCase().trim() === nk,
    )

    // Fallback: create the pipeline company directly if convert didn't create one
    if (!existing) {
      const createdCo = await window.NsApi.createCompany({
        company_name: name,
        country_id: lead.country_id || null,
        mgmt_type_id: lead.mgmt_type_id || null,
        stage_id: stageMatch ? Number(stageMatch.id) : null,
        month: monthVal,
        status_detail: lead.status_detail || null,
      })
      companyId =
        (createdCo &&
          (createdCo.id ??
            createdCo.company_id ??
            (createdCo.company && createdCo.company.id))) ||
        companyId
      try {
        await window.NsApi.updateLead(lead.id, { lead_status: "Converted" })
      } catch (e) {
        console.warn("[promoteLeadToPipeline] mark Converted failed:", e)
      }
      RAW_BASE = await loadCompaniesFromApi()
      existing = RAW_BASE.find(
        (r) => (r.company || "").toLowerCase().trim() === nk,
      )
    } else {
      companyId = existing._id || companyId
      // Ensure lead is marked converted even if convert API was skipped
      try {
        await window.NsApi.updateLead(lead.id, { lead_status: "Converted" })
      } catch (e) {
        /* ignore */
      }
    }

    if (!existing && !companyId) {
      throw new Error("Company was not created in Pipeline. Please try again.")
    }

    // Attach optional contact / follow-up / notes from lead extras
    const coId = companyId || (existing && existing._id)
    if (coId) {
      if (lead.followup) {
        try {
          await window.NsApi.upsertFollowUp({
            company_id: coId,
            due_date: lead.followup,
          })
          followUps[nk] = lead.followup
          saveFollowUps()
        } catch (e) {
          /* best-effort */
        }
      }
      if (lead.notes) {
        try {
          await window.NsApi.createNote({
            company_id: coId,
            note_text: lead.notes,
          })
        } catch (e) {
          /* best-effort */
        }
      }
      if (lead.contact || lead.contact_email || lead.contact_phone) {
        try {
          await window.NsApi.createContact({
            company_id: coId,
            contact_name: lead.contact || name,
            email: lead.contact_email || null,
            phone: lead.contact_phone || null,
          })
        } catch (e) {
          /* best-effort */
        }
      }
    }

    potentialLeads = await loadLeadsFromApi()
    populateLeadFilters()
    renderLeads()

    // Clear pipeline filters so the new company is visible
    ;["search", "fm", "fs", "fc", "fg"].forEach((id) => {
      const el = document.getElementById(id)
      if (el) el.value = ""
    })
    syncPipelineStageLabel()
    syncPipelineMgmtLabel()
    syncPipelineCountryLabel()
    syncMonthFilterLabel()
    closePipelineStageDrop()
    closePipelineMgmtDrop()
    closeMonthFilterDrop()
    kpiActiveFilter = ""
    document
      .querySelectorAll(".kpi.clickable")
      .forEach((k) => k.classList.remove("kpi-active"))

    sortCol = "_id"
    sortDir = -1
    page = 1
    populate()
    applyFilters()
    nsToast("Moved to Pipeline")

    // Open Pipeline so the user can see the new company
    if (typeof switchTab === "function") switchTab("pipeline")
  } catch (err) {
    alert(err.message || "Failed to add lead to pipeline")
  }
}

let leadCountryOptions = []

function populateLeadFilters() {
  // Country filter = same active countries as Pipeline / Settings
  leadCountryOptions = getDashboardCountryOptions()
  const leadFc = document.getElementById("lead-country-filter")
  if (leadFc && leadFc.value && !leadCountryOptions.includes(leadFc.value)) {
    leadFc.value = ""
  }
  renderLeadCountryOptions()
  syncLeadCountryLabel()
  populateLeadStageFilter()
  populateLeadMgmtFilter()
  syncLeadMonthFilterLabel()
}

let leadMonthFilterYear = new Date().getFullYear()
let leadStageOptions = []
let leadMgmtFilterOptions = []

function closeAllLeadFilterDrops() {
  closeLeadMonthFilterDrop()
  closeLeadStageDrop()
  closeLeadMgmtDrop()
  closeLeadCountryDrop()
}

function syncLeadMonthFilterLabel() {
  const hidden = document.getElementById("lead-month-filter")
  const label = document.getElementById("lead-month-label")
  if (!hidden || !label) return
  label.textContent = hidden.value || "All Months"
}

function renderLeadMonthFilterGrid() {
  const grid = document.getElementById("lead-month-grid")
  const yearEl = document.getElementById("lead-month-year")
  const prev = document.getElementById("lead-month-prev")
  const next = document.getElementById("lead-month-next")
  const allBtn = document.getElementById("lead-month-all")
  const hidden = document.getElementById("lead-month-filter")
  if (!grid || !yearEl || !hidden) return

  const { minY, maxY } = monthFilterYearBounds()
  if (leadMonthFilterYear < minY) leadMonthFilterYear = minY
  if (leadMonthFilterYear > maxY) leadMonthFilterYear = maxY

  yearEl.textContent = String(leadMonthFilterYear)
  if (prev) prev.disabled = leadMonthFilterYear <= minY
  if (next) next.disabled = leadMonthFilterYear >= maxY

  const selected = hidden.value || ""
  const now = new Date()
  const curLabel = monthKeyFromDate(now)

  grid.innerHTML = MONTH_FILTER_SHORT.map((name) => {
    const value = name + " " + leadMonthFilterYear
    const isSelected = selected === value
    const isCurrent = value === curLabel
    return `<button type="button" class="month-filter-cell${isSelected ? " selected" : ""}${isCurrent ? " is-current" : ""}" role="option" aria-selected="${isSelected}" data-value="${esc(value)}" onclick="selectLeadMonthFilter(this.getAttribute('data-value'))">${name}</button>`
  }).join("")

  if (allBtn) allBtn.classList.toggle("selected", !selected)
}

function toggleLeadMonthFilterDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("lead-month-drop")
  const btn = document.getElementById("lead-month-btn")
  const hidden = document.getElementById("lead-month-filter")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeMonthFilterDrop()
    closePipelineStageDrop()
    closePipelineMgmtDrop()
    closePipelineCountryDrop()
    closeLeadStageDrop()
    closeLeadMgmtDrop()
    closeLeadCountryDrop()
    closeLeadFormCountryDrop()
    closeLeadFormMgmtDrop()
    closeCoFormCountryDrop()
    closeCoFormMgmtDrop()
    const parsed = hidden && hidden.value ? parseMonthLabel(hidden.value) : null
    leadMonthFilterYear = parsed
      ? parsed.getFullYear()
      : new Date().getFullYear()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    renderLeadMonthFilterGrid()
    positionMonthFilterDrop(btn, drop)
  } else {
    closeLeadMonthFilterDrop()
  }
}

function closeLeadMonthFilterDrop() {
  const drop = document.getElementById("lead-month-drop")
  const btn = document.getElementById("lead-month-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}

function shiftLeadMonthFilterYear(delta, event) {
  if (event) event.stopPropagation()
  leadMonthFilterYear += delta
  renderLeadMonthFilterGrid()
}

function selectLeadMonthFilter(value) {
  const hidden = document.getElementById("lead-month-filter")
  if (!hidden) return
  hidden.value = value || ""
  syncLeadMonthFilterLabel()
  closeLeadMonthFilterDrop()
  leadPage = 1
  renderLeads()
}

function populateLeadStageFilter() {
  leadStageOptions = getDashboardStageOptions()
  renderLeadStageOptions()
  syncLeadStageLabel()
}

function renderLeadStageOptions() {
  const list = document.getElementById("lead-stage-list")
  const hidden = document.getElementById("lead-stage-filter")
  if (!list || !hidden) return
  const current = hidden.value
  const items = [
    { value: "", label: "All Stages", selected: !current },
    ...leadStageOptions.map((s) => ({
      value: s,
      label: s,
      selected: current === s,
    })),
  ]
  list.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="ss-item${item.selected ? " selected" : ""}" role="option" aria-selected="${item.selected}" data-value="${esc(item.value)}" onclick="selectLeadStageFilter(this.getAttribute('data-value'))">${item.selected ? "✓ " : ""}${esc(item.label)}</button>`,
    )
    .join("")
}

function toggleLeadStageDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("lead-stage-drop")
  const btn = document.getElementById("lead-stage-btn")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeMonthFilterDrop()
    closeLeadMonthFilterDrop()
    closePipelineStageDrop()
    closePipelineMgmtDrop()
    closePipelineCountryDrop()
    closeLeadMgmtDrop()
    closeLeadCountryDrop()
    closeLeadFormCountryDrop()
    closeLeadFormMgmtDrop()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    positionCountryDrop(btn, drop)
    renderLeadStageOptions()
  } else {
    closeLeadStageDrop()
  }
}

function closeLeadStageDrop() {
  const drop = document.getElementById("lead-stage-drop")
  const btn = document.getElementById("lead-stage-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}

function selectLeadStageFilter(value) {
  const hidden = document.getElementById("lead-stage-filter")
  const label = document.getElementById("lead-stage-label")
  if (!hidden || !label) return
  hidden.value = value || ""
  label.textContent = value || "All Stages"
  closeLeadStageDrop()
  leadPage = 1
  renderLeads()
}

function syncLeadStageLabel() {
  const hidden = document.getElementById("lead-stage-filter")
  const label = document.getElementById("lead-stage-label")
  if (!hidden || !label) return
  label.textContent = hidden.value || "All Stages"
}

function populateLeadMgmtFilter() {
  leadMgmtFilterOptions = getDashboardMgmtTypeOptions()
  renderLeadMgmtFilterOptions()
  syncLeadMgmtFilterLabel()
}

function renderLeadMgmtFilterOptions() {
  const list = document.getElementById("lead-mgmt-list")
  const hidden = document.getElementById("lead-mgmt-filter")
  if (!list || !hidden) return
  const current = hidden.value
  const items = [
    { value: "", label: "All Types", selected: !current },
    ...leadMgmtFilterOptions.map((t) => ({
      value: t,
      label: t,
      selected: current === t,
    })),
  ]
  list.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="ss-item${item.selected ? " selected" : ""}" role="option" aria-selected="${item.selected}" data-value="${esc(item.value)}" onclick="selectLeadMgmtFilter(this.getAttribute('data-value'))">${item.selected ? "✓ " : ""}${esc(item.label)}</button>`,
    )
    .join("")
}

function toggleLeadMgmtDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("lead-mgmt-drop")
  const btn = document.getElementById("lead-mgmt-btn")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeMonthFilterDrop()
    closeLeadMonthFilterDrop()
    closePipelineStageDrop()
    closePipelineMgmtDrop()
    closePipelineCountryDrop()
    closeLeadStageDrop()
    closeLeadCountryDrop()
    closeLeadFormCountryDrop()
    closeLeadFormMgmtDrop()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    positionCountryDrop(btn, drop)
    renderLeadMgmtFilterOptions()
  } else {
    closeLeadMgmtDrop()
  }
}

function closeLeadMgmtDrop() {
  const drop = document.getElementById("lead-mgmt-drop")
  const btn = document.getElementById("lead-mgmt-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}

function selectLeadMgmtFilter(value) {
  const hidden = document.getElementById("lead-mgmt-filter")
  const label = document.getElementById("lead-mgmt-label")
  if (!hidden || !label) return
  hidden.value = value || ""
  label.textContent = value || "All Types"
  closeLeadMgmtDrop()
  leadPage = 1
  renderLeads()
}

function syncLeadMgmtFilterLabel() {
  const hidden = document.getElementById("lead-mgmt-filter")
  const label = document.getElementById("lead-mgmt-label")
  if (!hidden || !label) return
  label.textContent = hidden.value || "All Types"
}

function renderLeadCountryOptions(filterText) {
  const list = document.getElementById("lead-country-list")
  const hidden = document.getElementById("lead-country-filter")
  if (!list || !hidden) return
  const q = (filterText || "").trim().toLowerCase()
  const current = hidden.value
  const matches = q
    ? leadCountryOptions.filter((c) => c.toLowerCase().includes(q))
    : leadCountryOptions.slice()

  const items = []
  if (!q || "all countries".includes(q)) {
    items.push({
      value: "",
      label: "All Countries",
      selected: !current,
    })
  }
  matches.forEach((c) => {
    items.push({ value: c, label: c, selected: current === c })
  })

  if (!items.length) {
    list.innerHTML = `<div class="ss-empty">No countries match “${esc(filterText.trim())}”</div>`
    return
  }

  list.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="ss-item${item.selected ? " selected" : ""}" role="option" aria-selected="${item.selected}" data-value="${esc(item.value)}" onclick="selectLeadCountry(this.getAttribute('data-value'))">${item.selected ? "✓ " : ""}${esc(item.label)}</button>`,
    )
    .join("")
}

function filterLeadCountryOptions() {
  const input = document.getElementById("lead-country-search")
  renderLeadCountryOptions(input ? input.value : "")
}

function toggleLeadCountryDrop(event) {
  if (event) event.stopPropagation()
  const drop = document.getElementById("lead-country-drop")
  const btn = document.getElementById("lead-country-btn")
  if (!drop || !btn) return
  const open = drop.hasAttribute("hidden")
  if (open) {
    closeMonthFilterDrop()
    closeLeadMonthFilterDrop()
    closePipelineCountryDrop()
    closePipelineStageDrop()
    closePipelineMgmtDrop()
    closeLeadStageDrop()
    closeLeadMgmtDrop()
    closeLeadFormCountryDrop()
    closeCoFormCountryDrop()
    drop.removeAttribute("hidden")
    btn.setAttribute("aria-expanded", "true")
    btn.classList.add("open")
    positionCountryDrop(btn, drop)
    const search = document.getElementById("lead-country-search")
    if (search) {
      search.value = ""
      renderLeadCountryOptions("")
      setTimeout(() => search.focus(), 0)
    }
  } else {
    closeLeadCountryDrop()
  }
}

function closeLeadCountryDrop() {
  const drop = document.getElementById("lead-country-drop")
  const btn = document.getElementById("lead-country-btn")
  if (drop) drop.setAttribute("hidden", "")
  if (btn) {
    btn.setAttribute("aria-expanded", "false")
    btn.classList.remove("open")
  }
}

function selectLeadCountry(value) {
  const hidden = document.getElementById("lead-country-filter")
  const label = document.getElementById("lead-country-label")
  if (!hidden || !label) return
  hidden.value = value || ""
  label.textContent = value || "All Countries"
  closeLeadCountryDrop()
  leadPage = 1
  renderLeads()
}

function syncLeadCountryLabel() {
  const hidden = document.getElementById("lead-country-filter")
  const label = document.getElementById("lead-country-label")
  if (!hidden || !label) return
  label.textContent = hidden.value || "All Countries"
}

function sortLeads(col) {
  if (leadSortCol === col) leadSortDir *= -1
  else {
    leadSortCol = col
    leadSortDir = 1
  }
  renderLeads()
}

function changeLeadPage(dir) {
  leadPage += dir
  renderLeads()
  const sc = document.querySelector("#panel-leads .scroll")
  if (sc) sc.scrollTop = 0
}
function clearLeadFilters() {
  document.getElementById("lead-search").value = ""
  ;[
    "lead-month-filter",
    "lead-stage-filter",
    "lead-country-filter",
    "lead-mgmt-filter",
  ].forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.value = ""
  })
  syncLeadMonthFilterLabel()
  syncLeadStageLabel()
  syncLeadCountryLabel()
  syncLeadMgmtFilterLabel()
  const search = document.getElementById("lead-country-search")
  if (search) search.value = ""
  closeAllLeadFilterDrops()
  leadPage = 1
  renderLeads()
}

function leadVal(v) {
  const s = (v == null ? "" : String(v)).trim()
  return s || ""
}

/** All valid outreach months for a potential lead (extras + row). */
function leadMonthList(lead) {
  if (!lead) return []
  const extras = leadExtras[lead.id] || {}
  return [
    ...new Set(
      [
        ...(Array.isArray(extras.months) ? extras.months : []),
        ...(Array.isArray(lead._all_months) ? lead._all_months : []),
        lead.month,
        extras.month,
      ].filter(isValidMonthLabel),
    ),
  ]
}

function leadMonthCount(lead) {
  return leadMonthList(lead).length
}

/**
 * Same Retargeted rules as Pipeline getStage():
 * 2+ months (or is_retarget) ⇒ Retargeted; Meeting / Not Interested kept as-is.
 */
function getLeadStage(lead) {
  if (!lead) return "Email Outreach"
  const extras = leadExtras[lead.id] || {}
  let s =
    lead.stage === "Prospected"
      ? "Email Outreach"
      : lead.stage || extras.stage || ""
  const keepAsIs =
    s === "Meeting / Positive" || s === "Call" || s === "Not Interested"
  if (keepAsIs) return s
  if (extras.is_retarget || leadMonthCount(lead) >= 2) return "Retargeted"
  if (s === "Retargeted") return "Email Outreach"
  return s || "Email Outreach"
}

function leadFollowUpTone(raw) {
  const s = leadVal(raw)
  if (!s) return { label: "Set date", tone: "neutral" }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return { label: s, tone: "neutral" }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d - today) / (1000 * 60 * 60 * 24))
  const label = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const tone = diff < 0 ? "overdue" : diff === 0 ? "today" : "ok"
  return { label, tone }
}

function leadStatusBadgeClass(status) {
  return (
    {
      New: "b-1",
      Contacted: "b-c",
      Qualified: "b-m",
      Converted: "b-r",
      "Not Qualified": "b-n",
    }[status] || "b-1"
  )
}

/** Pipeline-matching grid card for potential leads (reuses pg-* classes). */
function renderLeadGridCard(r) {
  const name = r.name || "—"
  const stage = getLeadStage(r)
  const status = r.status || "New"
  const country = leadVal(r.country) || "—"
  const type = leadVal(r.mgmt) || "—"
  const contact = leadVal(r.contact) || "—"
  const nk = (r.name || "").toLowerCase().trim()
  seedNotesFromLead(nk, r)
  seedContactsFromLead(nk, r)
  const noteArr = Array.isArray(notes[nk])
    ? notes[nk]
    : notes[nk]
      ? [{ text: notes[nk], ts: null }]
      : []
  const note = noteArr.length ? noteArr[noteArr.length - 1].text : ""
  const noteCount = noteArr.length
  const contactCount =
    contacts[nk] && contacts[nk].length ? contacts[nk].length : 0
  const leadId = Number(r.id)
  const fu = leadFollowUpTone(r.followup)
  const stageClass = bc(stage) || "b-1"
  const statusClass = leadStatusBadgeClass(status)
  const called = !!r.called
  const allMonths = leadMonthList(r)
  const curMonth = isValidMonthLabel(r.month)
    ? r.month
    : allMonths[0] || monthLabelNow()
  const otherMonths = allMonths.filter((m) => m && m !== curMonth)
  const monthLine = esc(curMonth || "—")
  const monthExtra = otherMonths.length
    ? ` <span class="pg-extra">+${otherMonths.length}</span>`
    : ""
  const countryCur = country === "—" ? "" : country
  const typeCur = type === "—" ? "" : type
  const primaryContact =
    contactCount && contacts[nk][0]
      ? contacts[nk][0].name || contacts[nk][0].email || "Contact"
      : contact

  return `<article class="pg-card stage-${stageClass}">
    <div class="pg-card-top">
      <button type="button" class="pg-stage badge ${stageClass} editable" onclick="openLeadStageDrop(event,${leadId})" title="Click to edit stage">${esc(stage)}</button>
      <div class="row-actions">${rowActionButton("promote", `leadActionPromote(event,${r._idx},${leadId})`, "Add to Pipeline")}${rowActionButton("edit", `leadActionEdit(event,${r._idx},${leadId})`, "Edit")}${rowActionButton("delete", `leadActionDelete(event,${r._idx},${leadId})`, "Delete", "is-danger")}</div>
    </div>
    <h3 class="pg-name" title="${esc(name)}">${esc(name)}</h3>
    <div class="pg-meta">
      ${
        status === "Qualified" || status === "Not Qualified"
          ? `<span class="badge ${statusClass}">${esc(status)}</span>`
          : ""
      }
      ${leadVal(r.added) ? `<span class="pg-code">${esc(r.added)}</span>` : ""}
      <button type="button" class="pg-chip" onclick="openLeadContacts(${leadId})">${CELL_ICONS.contacts}${contactCount ? contactCount + " contacts" : "Contacts"}</button>
    </div>

    <div class="pg-tiles">
      <div class="pg-tile" role="button" tabindex="0" onclick="openLeadFieldEdit(event,${leadId},'country','${esc(countryCur)}')" title="Click to edit country">
        <span class="pg-tile-lbl">Country</span>
        <span class="pg-tile-val">${esc(country)}</span>
      </div>
      <div class="pg-tile" role="button" tabindex="0" onclick="openLeadFieldEdit(event,${leadId},'mgmt_type','${esc(typeCur)}')" title="Click to edit type">
        <span class="pg-tile-lbl">Type</span>
        <span class="pg-tile-val" title="${esc(type)}">${esc(type)}</span>
      </div>
      <div class="pg-tile" role="button" tabindex="0" onclick="openLeadMonthPicker(event,${leadId})" title="Click to edit months — 2+ months = Retargeted">
        <span class="pg-tile-lbl">Month</span>
        <span class="pg-tile-val">${monthLine}${monthExtra}</span>
      </div>
      <div class="pg-tile" role="button" tabindex="0" onclick="toggleLeadCall(${leadId})" title="Toggle call">
        <span class="pg-tile-lbl">Call</span>
        <span class="pg-tile-val ${called ? "yes" : "muted"}">${called ? "Yes" : "—"}</span>
      </div>
    </div>

    <div class="pg-rows">
      <div class="pg-row" role="button" tabindex="0" onclick="setLeadFollowUp(${leadId},event)" title="Click to set follow-up">
        <span class="pg-row-lbl">Follow-up</span>
        <span class="pg-row-val fu-${fu.tone}">${esc(fu.label)}</span>
      </div>
      <div class="pg-row" role="button" tabindex="0" onclick="openLeadContacts(${leadId})">
        <span class="pg-row-lbl">Contact</span>
        <span class="pg-row-val ${primaryContact === "—" || !primaryContact ? "muted" : ""}">${esc(primaryContact || "Add contact")}</span>
      </div>
      <div class="pg-row" role="button" tabindex="0" onclick="openLeadNote(${leadId})">
        <span class="pg-row-lbl">Notes</span>
        <span class="pg-row-val ${note ? "" : "muted"}" title="${note ? esc(note) : ""}">${note ? esc(note) : "Add note"}</span>
      </div>
    </div>

    <div class="pg-actions">
      <button type="button" class="pg-btn pg-btn-primary" onclick="promoteLeadToPipeline(${r._idx})">Pipeline</button>
      <button type="button" class="pg-btn" onclick="openAddLead(${r._idx})">Edit</button>
      <button type="button" class="pg-btn" onclick="openLeadContacts(${leadId})">Contacts${contactCount ? ` (${contactCount})` : ""}</button>
      <button type="button" class="pg-btn" onclick="openLeadNote(${leadId})">Notes${noteCount ? ` (${noteCount})` : ""}</button>
      <button type="button" class="pg-btn" onclick="deleteLeadById(${leadId})">Delete</button>
    </div>
  </article>`
}

/** Pipeline-matching list row for potential leads. */
function renderLeadTableRow(r) {
  const name = r.name || "—"
  const stage = getLeadStage(r)
  const status = r.status || "New"
  const stageClass = bc(stage) || "b-1"
  const statusClass = leadStatusBadgeClass(status)
  const fu = leadFollowUpTone(r.followup)
  const nk = (r.name || "").toLowerCase().trim()
  seedNotesFromLead(nk, r)
  seedContactsFromLead(nk, r)
  const noteArr = Array.isArray(notes[nk])
    ? notes[nk]
    : notes[nk]
      ? [{ text: notes[nk], ts: null }]
      : []
  const note = noteArr.length ? noteArr[noteArr.length - 1].text : ""
  const noteCount = noteArr.length
  const contactCount =
    contacts[nk] && contacts[nk].length ? contacts[nk].length : 0
  const moreTag =
    noteCount > 1
      ? '<span style="color:#64748b;font-size:.58rem;margin-left:4px">(+' +
        (noteCount - 1) +
        " more)</span>"
      : ""
  const leadId = Number(r.id)
  const noteCell = note
    ? `<div class="nprev clickable-note" data-id="${leadId}" onclick="openLeadNote(${leadId})" title="Click to see all notes">${esc(note)}${moreTag}</div>`
    : `<button class="add-note-btn" onclick="openLeadNote(${leadId})">＋ Note</button>`
  const called = !!r.called
  const country = leadVal(r.country)
  const type = leadVal(r.mgmt)
  const eco = esc(r.name || "")
  const fuCell =
    fu.label === "Set date"
      ? `<button type="button" onclick="setLeadFollowUp(${leadId},event)" style="background:none;border:1px dashed #cbd5e1;color:#64748b;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:.6rem">＋ Set</button>`
      : `<span style="font-size:.66rem;font-weight:600" class="pg-row-val fu-${fu.tone}">${esc(fu.label)}</span>` +
        `<button type="button" onclick="setLeadFollowUp(${leadId},event)" style="display:block;margin-top:2px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.6rem;padding:0" title="Edit follow-up">Edit</button>`
  const allMonths = leadMonthList(r)
  const curMonth = isValidMonthLabel(r.month)
    ? r.month
    : allMonths[0] || monthLabelNow()
  const otherMonths = allMonths.filter((m) => m && m !== curMonth)
  const monthDisplay =
    `<span class="mtag editable" onclick="openLeadMonthPicker(event,${leadId})" title="Click to edit months — 2+ months = Retargeted">${esc(curMonth || "—")}</span>` +
    (otherMonths.length
      ? `<span style="font-size:.55rem;color:#64748b;display:block;margin-top:2px">${otherMonths.map((m) => `+${esc(m)}`).join(", ")}</span>`
      : "")

  return `<tr>
      <td>
        <span class="cn">${esc(name)}</span>
        <span class="cell-chips">${noteChip(`openLeadNote(${leadId})`, !!note)}${contactsChip(`openLeadContacts(${leadId})`, contactCount)}</span>
        ${
          status === "Qualified" || status === "Not Qualified"
            ? `<span class="badge ${statusClass}" style="margin-top:4px;display:inline-block">${esc(status)}</span>`
            : ""
        }
      </td>
      <td><span class="editable-cell" onclick="openLeadFieldEdit(event,${leadId},'country','${esc(country)}')" title="Click to edit country">${esc(country || "—")}</span></td>
      <td><span class="editable-cell" onclick="openLeadFieldEdit(event,${leadId},'mgmt_type','${esc(type)}')" title="Click to edit type">${esc(type || "—")}</span></td>
      <td>${monthDisplay}</td>
      <td><span class="badge ${stageClass} editable" onclick="openLeadStageDrop(event,${leadId})" title="Click to edit stage">${esc(stage)}</span></td>
      <td><span onclick="toggleLeadCall(${leadId})" class="${called ? "call-yes" : "call-no"}" style="cursor:pointer">${called ? "📞 Yes" : "—"}</span></td>
      <td>${fuCell}</td>
      <td>${noteCell}</td>
      <td><div class="row-actions">${rowActionButton("promote", `leadActionPromote(event,${r._idx},${leadId})`, "Add to Pipeline")}${rowActionButton("edit", `leadActionEdit(event,${r._idx},${leadId})`, "Edit")}${rowActionButton("delete", `leadActionDelete(event,${r._idx},${leadId})`, "Delete", "is-danger")}</div></td>
    </tr>`
}

function renderLeads() {
  ensurePipelineGridStyles()
  const searchEl = document.getElementById("lead-search")
  const monthEl = document.getElementById("lead-month-filter")
  const stageEl = document.getElementById("lead-stage-filter")
  const countryEl = document.getElementById("lead-country-filter")
  const mgmtEl = document.getElementById("lead-mgmt-filter")
  const grid = document.getElementById("lead-grid")
  const table = document.getElementById("lead-table")
  const tbody = document.getElementById("lead-tbody")
  const nores = document.getElementById("lead-nores")
  if ((!grid && !tbody) || !searchEl) return

  syncLeadsViewButtons()
  const isGrid = leadsViewMode === "grid"
  // Drive visibility via panel data-view + hidden for reliability
  if (table) {
    table.hidden = isGrid
    table.style.display = isGrid ? "none" : ""
  }
  if (grid) {
    grid.hidden = !isGrid
    grid.style.display = isGrid ? "" : "none"
  }

  const q = (searchEl.value || "").toLowerCase().trim()
  const mf = monthEl ? monthEl.value : ""
  const sf = stageEl ? stageEl.value : ""
  const cf = countryEl ? countryEl.value : ""
  const tf = mgmtEl ? mgmtEl.value : ""

  const allRows = getPotentialLeadRows()
  let leads = allRows
    .map((r) => ({
      ...r,
      _idx: potentialLeads.findIndex((l) => sameLeadId(l.id, r.id)),
    }))
    .filter((r) => {
      if (r._idx < 0) return false
      if (cf && (r.country || "") !== cf) return false
      if (tf && (r.mgmt || "") !== tf) return false
      if (sf && getLeadStage(r) !== sf) return false
      if (mf) {
        const months = leadMonthList(r)
        if (!months.includes(mf) && (r.month || "") !== mf) return false
      }
      if (q) {
        const nk = (r.name || "").toLowerCase().trim()
        seedNotesFromLead(nk, r)
        const noteTexts = Array.isArray(notes[nk])
          ? notes[nk].map((e) => (e && e.text != null ? e.text : e)).join(" ")
          : notes[nk] || ""
        const hay = [
          r.name,
          r.country,
          r.contact,
          r.contact_email,
          r.contact_phone,
          r.source,
          r.status,
          r.status_detail,
          r.month,
          r.mgmt,
          r.notes,
          getLeadStage(r),
          noteTexts,
        ]
          .join(" ")
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

  leads.sort((a, b) => {
    const col = leadSortCol === "company" ? "name" : leadSortCol
    const av = (a[col] || a.name || "").toString()
    const bv = (b[col] || b.name || "").toString()
    return av.localeCompare(bv) * leadSortDir
  })

  const countEl = document.getElementById("lead-count")
  if (countEl) countEl.textContent = String(leads.length)

  if (!leads.length) {
    if (grid) {
      grid.innerHTML = ""
      grid.hidden = true
      grid.style.display = "none"
    }
    if (tbody) tbody.innerHTML = ""
    if (table) {
      table.hidden = true
      table.style.display = "none"
    }
    if (nores) {
      nores.style.display = "block"
      nores.textContent = allRows.length
        ? "No leads match your filters"
        : "No potential leads yet — click + Add Company to add one"
    }
    const pinfo = document.getElementById("lead-pinfo")
    if (pinfo) pinfo.textContent = "0 leads"
    const pprev = document.getElementById("lead-pprev")
    const pnext = document.getElementById("lead-pnext")
    if (pprev) pprev.disabled = true
    if (pnext) pnext.disabled = true
    return
  }
  if (nores) nores.style.display = "none"

  const perPage = leadPerPage()
  const maxPage = Math.max(1, Math.ceil(leads.length / perPage))
  if (leadPage > maxPage) leadPage = maxPage
  if (leadPage < 1) leadPage = 1

  const start = (leadPage - 1) * perPage
  const slice = leads.slice(start, start + perPage)

  if (isGrid) {
    if (grid) {
      grid.style.display = "grid"
      grid.hidden = false
      grid.innerHTML = slice.map(renderLeadGridCard).join("")
    }
    if (tbody) tbody.innerHTML = ""
    if (table) {
      table.hidden = true
      table.style.display = "none"
    }
  } else {
    if (tbody) tbody.innerHTML = slice.map(renderLeadTableRow).join("")
    if (table) {
      table.hidden = false
      table.style.display = ""
    }
    if (grid) {
      grid.innerHTML = ""
      grid.hidden = true
      grid.style.display = "none"
    }
  }

  const total = leads.length
  const end = Math.min(start + perPage, total)
  const pinfo = document.getElementById("lead-pinfo")
  if (pinfo) pinfo.textContent = `Showing ${start + 1}–${end} of ${total} leads`
  const pprev = document.getElementById("lead-pprev")
  const pnext = document.getElementById("lead-pnext")
  if (pprev) pprev.disabled = leadPage === 1
  if (pnext) pnext.disabled = leadPage >= maxPage
}

;["search", "fm", "fs", "fg"].forEach((id) => {
  const el = document.getElementById(id)
  if (!el) return
  el.addEventListener("input", applyFilters)
  el.addEventListener("change", applyFilters)
})

function exportData() {
  const xe = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  const cell = (v) =>
    '<Cell><Data ss:Type="' +
    (typeof v === "number" ? "Number" : "String") +
    '">' +
    xe(v) +
    "</Data></Cell>"
  const sheet = (name, headers, rows) =>
    '<Worksheet ss:Name="' +
    xe(name) +
    '"><Table>' +
    "<Row>" +
    headers
      .map(
        (h) =>
          '<Cell ss:StyleID="hdr"><Data ss:Type="String">' +
          xe(h) +
          "</Data></Cell>",
      )
      .join("") +
    "</Row>" +
    rows.map((r) => "<Row>" + r.map(cell).join("") + "</Row>").join("") +
    "</Table></Worksheet>"

  // Build the same company list the Pipeline page shows (unique mode),
  // without dashboard date filtering so every pipeline company is included.
  const allRows = getAllCompanies()
  const monthsByNk = {}
  allRows.forEach((r) => {
    const nk = (r.company || "").toLowerCase().trim()
    if (!nk) return
    if (!monthsByNk[nk]) monthsByNk[nk] = { months: new Set(), ret: false }
    if (isValidMonthLabel(r.month)) monthsByNk[nk].months.add(r.month)
    if (r.is_retarget || r.stage === "Retargeted") monthsByNk[nk].ret = true
  })
  Object.keys(extraMonths || {}).forEach((nk) => {
    if (!monthsByNk[nk]) monthsByNk[nk] = { months: new Set(), ret: false }
    ;(extraMonths[nk] || []).forEach((m) => {
      if (isValidMonthLabel(m)) monthsByNk[nk].months.add(m)
    })
  })
  const retargetedSet = new Set()
  Object.keys(monthsByNk).forEach((nk) => {
    if (
      (monthsByNk[nk].months && monthsByNk[nk].months.size >= 2) ||
      monthsByNk[nk].ret
    ) {
      retargetedSet.add(nk)
    }
  })

  const companies = dedupeCompaniesHighestStage(allRows).slice()
  companies.sort((a, b) => {
    const idDiff = (b._id || 0) - (a._id || 0)
    if (idDiff) return idDiff
    return (a.company || "").localeCompare(b.company || "")
  })

  // Columns match Pipeline list: Company, Country, Type, Month, Stage, Call, Follow-up, Notes
  const pipelineHeaders = [
    "Company",
    "Code",
    "Country",
    "Type",
    "Month",
    "All Months",
    "Stage",
    "Call",
    "Follow-up",
    "Notes",
    "Status Detail",
    "Retargeted",
    "Contact Name",
    "Contact Email",
    "Contact Phone",
  ]

  const pipelineRows = companies.map((r) => {
    const nk = (r.company || "").toLowerCase().trim()
    const allMonths = [
      ...new Set([
        ...(r._all_months || []),
        ...(monthsByNk[nk] ? [...monthsByNk[nk].months] : []),
        ...(extraMonths[nk] || []),
      ]),
    ]
      .filter(isValidMonthLabel)
      .sort((a, b) => (MONTH_ORDER[a] ?? 99) - (MONTH_ORDER[b] ?? 99))
    const curMonth = isValidMonthLabel(getField(r, "month") || r.month)
      ? getField(r, "month") || r.month
      : allMonths[0] || ""
    const noteArr = Array.isArray(notes[nk])
      ? notes[nk].map((e) => (e && e.text != null ? e.text : e)).filter(Boolean)
      : notes[nk]
        ? [String(notes[nk])]
        : []
    const stage = getStage(r) || ""
    const called = isCall(nk) ? "Yes" : "No"
    const fu = r._follow_up || followUps[nk] || ""
    return [
      r.company || "",
      r.code || "",
      getField(r, "country") || "",
      getField(r, "mgmt_type") || "",
      curMonth,
      allMonths.join(", "),
      stage,
      called,
      fu,
      noteArr.join(" | "),
      r.status || "",
      retargetedSet.has(nk) ? "Yes" : "No",
      r._contact_name || "",
      r._contact_email || "",
      r._contact_phone || "",
    ]
  })

  const summaryRows = [
    ["Total Companies", companies.length],
    [
      "Retargeted",
      companies.filter((r) =>
        retargetedSet.has((r.company || "").toLowerCase().trim()),
      ).length,
    ],
    // Total call volume (repeat calls included), unlike the companies-called KPI
    ["Calls", countCallActivities(null)],
    [
      "Companies Called",
      companies.filter((r) => isCall((r.company || "").toLowerCase().trim()))
        .length,
    ],
    [
      "Meetings / Positive",
      companies.filter((r) => getStage(r) === "Meeting / Positive").length,
    ],
    [
      "Not Interested",
      companies.filter((r) => getStage(r) === "Not Interested").length,
    ],
  ]

  const byCategory = (predicate) =>
    pipelineRows.filter((_, i) => predicate(companies[i]))

  const leadRows = (
    typeof getPotentialLeadRows === "function"
      ? getPotentialLeadRows()
      : potentialLeads || []
  ).map((l) => [
    l.name || "",
    l.country || "",
    l.mgmt || "",
    l.month || "",
    l.stage || "",
    l.status_detail || "",
    l.contact || "",
    l.contact_email || "",
    l.contact_phone || "",
    l.followup || "",
    l.source || "",
    l.status || "",
    l.notes || "",
    l.added || "",
  ])

  const contactRows = []
  Object.keys(contacts || {})
    .sort()
    .forEach((nk) => {
      ;(contacts[nk] || []).forEach((c) => {
        contactRows.push([
          nk,
          c.name || "",
          c.title || "",
          c.email || "",
          c.phone || "",
        ])
      })
    })

  const activityRows = (comms || [])
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((c) => [
      c.date || "",
      c.timeStr || "",
      c.company || "",
      c.type || "",
      c.text || "",
    ])

  const xml =
    '<?xml version="1.0"?>' +
    '<?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/></Style></Styles>' +
    sheet("Pipeline", pipelineHeaders, pipelineRows) +
    sheet("Summary", ["Metric", "Count"], summaryRows) +
    sheet(
      "Retargeted",
      pipelineHeaders,
      byCategory((r) =>
        retargetedSet.has((r.company || "").toLowerCase().trim()),
      ),
    ) +
    sheet(
      "Calls",
      pipelineHeaders,
      byCategory((r) => isCall((r.company || "").toLowerCase().trim())),
    ) +
    sheet(
      "Meetings Positive",
      pipelineHeaders,
      byCategory((r) => getStage(r) === "Meeting / Positive"),
    ) +
    sheet(
      "Not Interested",
      pipelineHeaders,
      byCategory((r) => getStage(r) === "Not Interested"),
    ) +
    sheet(
      "Potential Leads",
      [
        "Company",
        "Country",
        "Type",
        "Month",
        "Stage",
        "Status Detail",
        "Contact",
        "Email",
        "Phone",
        "Follow-up",
        "Source",
        "Status",
        "Notes",
        "Added",
      ],
      leadRows,
    ) +
    sheet(
      "Contacts",
      ["Company", "Name", "Title", "Email", "Phone"],
      contactRows,
    ) +
    sheet(
      "Activities",
      ["Date", "Time", "Company", "Type", "Details"],
      activityRows,
    ) +
    "</Workbook>"

  const blob = new Blob([xml], { type: "application/vnd.ms-excel" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download =
    "Nautilus_Pipeline_Export_" + new Date().toISOString().slice(0, 10) + ".xls"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  if (typeof nsToast === "function") {
    nsToast("Exported " + pipelineRows.length + " pipeline companies")
  }
}

function importData(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const backup = JSON.parse(ev.target.result)
      Object.keys(backup).forEach((k) => localStorage.setItem(k, backup[k]))
      // Reload all state from localStorage
      stageOverrides = JSON.parse(localStorage.getItem("ns_stages") || "{}")
      Object.keys(stageOverrides).forEach((k) => {
        if (stageOverrides[k] === "2nd Round") stageOverrides[k] = "Retargeted"
      })
      notes = JSON.parse(localStorage.getItem("ns_notes") || "{}")
      communications = JSON.parse(localStorage.getItem("ns_comms") || "[]")
      customCompanies = JSON.parse(
        localStorage.getItem("ns_custom_cos") || "[]",
      )
      potentialLeads = JSON.parse(localStorage.getItem("ns_leads") || "[]")
      followUps = JSON.parse(localStorage.getItem("ns_followups") || "{}")
      contacts = JSON.parse(localStorage.getItem("ns_contacts") || "{}")
      fieldEdits = JSON.parse(localStorage.getItem("ns_field_edits") || "{}")
      calls = JSON.parse(localStorage.getItem("ns_calls") || "{}")
      deletedCos = JSON.parse(localStorage.getItem("ns_deleted") || "{}")
      extraMonths = JSON.parse(localStorage.getItem("ns_extra_months") || "{}")
      populate()
      applyFilters()
      alert("✅ Data restored successfully! Your pipeline edits are back.")
    } catch (err) {
      alert(
        "❌ Import failed — make sure you selected the correct backup .json file.",
      )
    }
  }
  reader.readAsText(file)
  e.target.value = ""
}

;(async function initFromApi() {
  purgeLegacyLocalPipeline()
  const [companies, leads] = await Promise.all([
    loadCompaniesFromApi(),
    loadLookups().then(() => loadLeadsFromApi()),
  ])
  RAW_BASE = companies
  potentialLeads = leads
  await Promise.all([
    loadFollowUpsFromApi(),
    loadNotesFromApi(),
    loadActivitiesFromApi(),
    loadContactsFromApi(),
  ])
  mergePipelineCommsIntoTracker()
  saveComms()
  renderStageDropOptions()
  populateConfirmStageOptions()
  populate()
  applyFilters()
  populateLeadFilters()
  populateLeadFormLookups()
  renderLeads()
  renderDashboardCharts()
  renderWeekly()
  updatePipelineTrashCount()
  // Refresh may activate Contacts before API data is ready — paint again now
  if (typeof renderContactsTab === "function") renderContactsTab()
  try {
    const path = String(window.location.pathname || "")
    if (path.indexOf("/contacts") !== -1) activateTab("contacts")
    else if (path.indexOf("/leads") !== -1) activateTab("leads")
    else if (path.indexOf("/weekly") !== -1) activateTab("weekly")
    else if (path.indexOf("/analytics") !== -1) activateTab("analytics")
    else if (path.indexOf("/settings") !== -1) activateTab("settings")
    else if (path.indexOf("/pipeline") !== -1) activateTab("pipeline")
  } catch (err) {
    console.warn("[dashboard] post-init tab activate failed:", err)
  }
})()
const cfDate = document.getElementById("cf-date")
if (cfDate) cfDate.value = new Date().toISOString().slice(0, 10)

window.filterFieldEditOptions = filterFieldEditOptions
window.pickFieldEditValue = pickFieldEditValue
window.closeFieldEditPop = closeFieldEditPop
window.openFieldEdit = openFieldEdit
window.renderLeads = renderLeads
window.setLeadsView = setLeadsView
window.sortLeads = sortLeads
window.clearLeadFilters = clearLeadFilters
window.changeLeadPage = changeLeadPage
window.openAddLead = openAddLead
window.saveLead = saveLead
window.deleteLead = deleteLead
window.deleteLeadByIdx = deleteLeadByIdx
window.deleteLeadById = deleteLeadById
window.closeLeadModal = closeLeadModal
window.promoteLeadToPipeline = promoteLeadToPipeline
window.toggleLeadMonthFilterDrop = toggleLeadMonthFilterDrop
window.shiftLeadMonthFilterYear = shiftLeadMonthFilterYear
window.selectLeadMonthFilter = selectLeadMonthFilter
window.closeLeadMonthFilterDrop = closeLeadMonthFilterDrop
window.toggleLeadStageDrop = toggleLeadStageDrop
window.selectLeadStageFilter = selectLeadStageFilter
window.closeLeadStageDrop = closeLeadStageDrop
window.toggleLeadMgmtDrop = toggleLeadMgmtDrop
window.selectLeadMgmtFilter = selectLeadMgmtFilter
window.closeLeadMgmtDrop = closeLeadMgmtDrop
window.toggleLeadCountryDrop = toggleLeadCountryDrop
window.filterLeadCountryOptions = filterLeadCountryOptions
window.selectLeadCountry = selectLeadCountry
window.closeLeadCountryDrop = closeLeadCountryDrop
window.toggleLeadFormCountryDrop = toggleLeadFormCountryDrop
window.filterLeadFormCountryOptions = filterLeadFormCountryOptions
window.selectLeadFormCountry = selectLeadFormCountry
window.closeLeadFormCountryDrop = closeLeadFormCountryDrop
window.toggleCoFormCountryDrop = toggleCoFormCountryDrop
window.filterCoFormCountryOptions = filterCoFormCountryOptions
window.selectCoFormCountry = selectCoFormCountry
window.closeCoFormCountryDrop = closeCoFormCountryDrop

window.toggleLeadFormMgmtDrop = toggleLeadFormMgmtDrop
window.filterLeadFormMgmtOptions = filterLeadFormMgmtOptions
window.selectLeadFormMgmt = selectLeadFormMgmt
window.closeLeadFormMgmtDrop = closeLeadFormMgmtDrop
window.toggleCoFormMgmtDrop = toggleCoFormMgmtDrop
window.filterCoFormMgmtOptions = filterCoFormMgmtOptions
window.selectCoFormMgmt = selectCoFormMgmt
window.closeCoFormMgmtDrop = closeCoFormMgmtDrop

window.togglePipelineStageDrop = togglePipelineStageDrop
window.selectPipelineStage = selectPipelineStage
window.closePipelineStageDrop = closePipelineStageDrop
window.togglePipelineMgmtDrop = togglePipelineMgmtDrop
window.selectPipelineMgmt = selectPipelineMgmt
window.closePipelineMgmtDrop = closePipelineMgmtDrop
window.togglePipelineCountryDrop = togglePipelineCountryDrop
window.filterPipelineCountryOptions = filterPipelineCountryOptions
window.selectPipelineCountry = selectPipelineCountry
window.closePipelineCountryDrop = closePipelineCountryDrop
window.toggleMonthFilterDrop = toggleMonthFilterDrop
window.shiftMonthFilterYear = shiftMonthFilterYear
window.selectMonthFilter = selectMonthFilter
window.closeMonthFilterDrop = closeMonthFilterDrop
window.toggleFormMonthDrop = toggleFormMonthDrop
window.shiftFormMonthYear = shiftFormMonthYear
window.selectFormMonth = selectFormMonth
window.closeFormMonthDrop = closeFormMonthDrop
window.setPipelineView = setPipelineView
window.editPipelineCompany = editPipelineCompany
window.openPipelineTrash = openPipelineTrash
window.closePipelineTrash = closePipelineTrash
window.restoreTrashedCompany = restoreTrashedCompany
window.togglePipelineTrashSelectAll = togglePipelineTrashSelectAll
window.togglePipelineTrashItem = togglePipelineTrashItem
window.deleteSelectedTrashedCompanies = deleteSelectedTrashedCompanies

function isInsideMonthFilter(target) {
  if (!(target instanceof Node)) return false
  const wrap = document.getElementById("pipeline-month-ss")
  const drop = document.getElementById("pipeline-month-drop")
  const btn = document.getElementById("pipeline-month-btn")
  return (
    !!(wrap && wrap.contains(target)) ||
    !!(drop && drop.contains(target)) ||
    !!(btn && btn.contains(target))
  )
}

function isInsideLeadMonthFilter(target) {
  if (!(target instanceof Node)) return false
  const wrap = document.getElementById("lead-month-ss")
  const drop = document.getElementById("lead-month-drop")
  const btn = document.getElementById("lead-month-btn")
  return (
    !!(wrap && wrap.contains(target)) ||
    !!(drop && drop.contains(target)) ||
    !!(btn && btn.contains(target))
  )
}

function onMonthFilterOutsidePointer(e) {
  const drop = document.getElementById("pipeline-month-drop")
  if (drop && !drop.hasAttribute("hidden") && !isInsideMonthFilter(e.target)) {
    closeMonthFilterDrop()
  }
  const leadDrop = document.getElementById("lead-month-drop")
  if (
    leadDrop &&
    !leadDrop.hasAttribute("hidden") &&
    !isInsideLeadMonthFilter(e.target)
  ) {
    closeLeadMonthFilterDrop()
  }
  ;["co", "lead"].forEach((which) => {
    const els = formMonthEls(which)
    if (
      els &&
      els.drop &&
      !els.drop.hasAttribute("hidden") &&
      !isInsideFormMonth(which, e.target)
    ) {
      closeFormMonthDrop(which)
    }
  })
}

if (!window.__nsMonthFilterOutsideBound) {
  window.__nsMonthFilterOutsideBound = true
  // Capture phase so row/button stopPropagation cannot block dismiss
  document.addEventListener("pointerdown", onMonthFilterOutsidePointer, true)
  document.addEventListener("click", onMonthFilterOutsidePointer, true)
}

document.addEventListener("click", (e) => {
  const leadWrap = document.getElementById("lead-country-ss")
  if (leadWrap && !leadWrap.contains(e.target)) closeLeadCountryDrop()
  const leadStageWrap = document.getElementById("lead-stage-ss")
  if (leadStageWrap && !leadStageWrap.contains(e.target)) closeLeadStageDrop()
  const leadMgmtFilterWrap = document.getElementById("lead-mgmt-ss")
  if (leadMgmtFilterWrap && !leadMgmtFilterWrap.contains(e.target))
    closeLeadMgmtDrop()
  const leadFormWrap = document.getElementById("lead-form-country-ss")
  if (leadFormWrap && !leadFormWrap.contains(e.target))
    closeLeadFormCountryDrop()
  const leadMgmtWrap = document.getElementById("lead-form-mgmt-ss")
  if (leadMgmtWrap && !leadMgmtWrap.contains(e.target)) closeLeadFormMgmtDrop()
  const coFormWrap = document.getElementById("co-form-country-ss")
  if (coFormWrap && !coFormWrap.contains(e.target)) closeCoFormCountryDrop()
  const coMgmtWrap = document.getElementById("co-form-mgmt-ss")
  if (coMgmtWrap && !coMgmtWrap.contains(e.target)) closeCoFormMgmtDrop()
  const stageWrap = document.getElementById("pipeline-stage-ss")
  if (stageWrap && !stageWrap.contains(e.target)) closePipelineStageDrop()
  const mgmtWrap = document.getElementById("pipeline-mgmt-ss")
  if (mgmtWrap && !mgmtWrap.contains(e.target)) closePipelineMgmtDrop()
  const pipeWrap = document.getElementById("pipeline-country-ss")
  if (pipeWrap && !pipeWrap.contains(e.target)) closePipelineCountryDrop()
})
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeLeadCountryDrop()
    closeLeadMonthFilterDrop()
    closeLeadStageDrop()
    closeLeadMgmtDrop()
    closeLeadFormCountryDrop()
    closeLeadFormMgmtDrop()
    closeCoFormCountryDrop()
    closeCoFormMgmtDrop()
    closePipelineStageDrop()
    closePipelineMgmtDrop()
    closePipelineCountryDrop()
    closeMonthFilterDrop()
  }
})
