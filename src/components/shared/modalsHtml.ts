export const modalsHtml = `
<!-- STAGE DROPDOWN (options filled from active Dashboard stages) -->
<div id="stage-drop" class="stage-drop">
  <div class="sd-hint">Change Stage</div>
</div>

<!-- ADD/EDIT COMPANY MODAL -->
<div class="overlay" id="co-modal">
  <div class="modal">
    <h3 id="co-modal-title">Add Company to Pipeline</h3>
    <div id="co-code-row" style="display:none;margin:-6px 0 12px;font-size:.68rem;color:#94a3b8;font-family:monospace"></div>
    <div class="mrow">
      <div class="half">
        <div class="mlbl">Company Name *</div>
        <input type="text" id="co-name" placeholder="e.g. Maersk Line">
      </div>
      <div class="half">
        <div class="mlbl">Country</div>
        <div class="ss-wrap" id="co-form-country-ss">
          <input type="hidden" id="co-form-country" value="">
          <button type="button" class="ss-btn" id="co-form-country-btn" onclick="toggleCoFormCountryDrop(event)" aria-haspopup="listbox" aria-expanded="false">
            <span id="co-form-country-label">—</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="ss-drop" id="co-form-country-drop" hidden>
            <div class="ss-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="co-form-country-search" placeholder="Search countries..." autocomplete="off" oninput="filterCoFormCountryOptions()">
            </div>
            <div class="ss-list" id="co-form-country-list" role="listbox"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="mrow"><div class="half"><div class="mlbl">Management Type</div>
        <div class="ss-wrap" id="co-form-mgmt-ss">
          <input type="hidden" id="co-form-mgmt" value="">
          <button type="button" class="ss-btn" id="co-form-mgmt-btn" onclick="toggleCoFormMgmtDrop(event)" aria-haspopup="listbox" aria-expanded="false">
            <span id="co-form-mgmt-label">—</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="ss-drop" id="co-form-mgmt-drop" hidden>
            <div class="ss-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="co-form-mgmt-search" placeholder="Search types..." autocomplete="off" oninput="filterCoFormMgmtOptions()">
            </div>
            <div class="ss-list" id="co-form-mgmt-list" role="listbox"></div>
          </div>
        </div>
      </div><div class="half"><div class="mlbl">Stage</div><select id="co-stage"></select></div></div>
    <div class="mrow"><div class="half"><div class="mlbl">Month</div>
      <div class="ss-wrap month-filter-wrap" id="co-month-ss">
        <input type="hidden" id="co-month" value="">
        <button type="button" class="ss-btn" id="co-month-btn" onclick="toggleFormMonthDrop('co', event)" aria-haspopup="dialog" aria-expanded="false">
          <span id="co-month-label">—</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="ss-drop month-filter-drop" id="co-month-drop" hidden>
          <div class="month-filter-head">
            <button type="button" class="month-filter-nav" id="co-month-prev" onclick="shiftFormMonthYear('co', -1, event)" aria-label="Previous year">‹</button>
            <div class="month-filter-year" id="co-month-year"></div>
            <button type="button" class="month-filter-nav" id="co-month-next" onclick="shiftFormMonthYear('co', 1, event)" aria-label="Next year">›</button>
          </div>
          <div class="month-filter-grid" id="co-month-grid" role="listbox" aria-label="Select month"></div>
        </div>
      </div>
    </div><div class="half"><div class="mlbl">Status Detail</div><input type="text" id="co-status" placeholder="e.g. Email Outreach sent"></div></div>
    <div class="mrow"><div style="width:100%;font-size:.68rem;color:#94a3b8">To tag additional outreach months for this company, use the month tag in the Pipeline table (click it directly) rather than here.</div></div>
    <div class="mrow"><div class="half"><div class="mlbl">Contact Person Name</div><input type="text" id="co-contact-name" placeholder="e.g. John Smith"></div><div class="half"><div class="mlbl">Contact Email</div><input type="email" id="co-contact-email" placeholder="e.g. john@company.com"></div></div>
    <div class="mrow"><div class="half"><div class="mlbl">Contact Phone</div><input type="text" id="co-contact-phone" placeholder="e.g. +1 555 000 0000"></div><div class="half"><div class="mlbl">Follow-up Date</div><input type="date" id="co-followup"></div></div>
    <div class="mrow"><div style="width:100%">
      <div class="mlbl">Notes</div>
      <div id="co-notes-preview" style="display:none;max-height:110px;overflow-y:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:8px 10px;margin-bottom:6px;font-size:.72rem;color:#334155;white-space:pre-wrap"></div>
      <textarea id="co-notes" placeholder="Add a new note..."></textarea>
    </div></div>
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
    <div class="mrow">
      <div class="half">
        <div class="mlbl">Company Name *</div>
        <input type="text" id="lead-name" placeholder="e.g. Maersk Line">
      </div>
      <div class="half">
        <div class="mlbl">Country</div>
        <div class="ss-wrap" id="lead-form-country-ss">
          <input type="hidden" id="lead-form-country" value="">
          <button type="button" class="ss-btn" id="lead-form-country-btn" onclick="toggleLeadFormCountryDrop(event)" aria-haspopup="listbox" aria-expanded="false">
            <span id="lead-form-country-label">—</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="ss-drop" id="lead-form-country-drop" hidden>
            <div class="ss-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="lead-form-country-search" placeholder="Search countries..." autocomplete="off" oninput="filterLeadFormCountryOptions()">
            </div>
            <div class="ss-list" id="lead-form-country-list" role="listbox"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="mrow">
      <div class="half"><div class="mlbl">Management Type</div>
        <div class="ss-wrap" id="lead-form-mgmt-ss">
          <input type="hidden" id="lead-form-mgmt" value="">
          <button type="button" class="ss-btn" id="lead-form-mgmt-btn" onclick="toggleLeadFormMgmtDrop(event)" aria-haspopup="listbox" aria-expanded="false">
            <span id="lead-form-mgmt-label">—</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="ss-drop" id="lead-form-mgmt-drop" hidden>
            <div class="ss-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="lead-form-mgmt-search" placeholder="Search types..." autocomplete="off" oninput="filterLeadFormMgmtOptions()">
            </div>
            <div class="ss-list" id="lead-form-mgmt-list" role="listbox"></div>
          </div>
        </div>
      </div>
      <div class="half"><div class="mlbl">Stage</div><select id="lead-stage"></select></div>
    </div>
    <div class="mrow">
      <div class="half"><div class="mlbl">Month</div>
        <div class="ss-wrap month-filter-wrap" id="lead-form-month-ss">
          <input type="hidden" id="lead-month" value="">
          <button type="button" class="ss-btn" id="lead-form-month-btn" onclick="toggleFormMonthDrop('lead', event)" aria-haspopup="dialog" aria-expanded="false">
            <span id="lead-form-month-label">—</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="ss-drop month-filter-drop" id="lead-form-month-drop" hidden>
            <div class="month-filter-head">
              <button type="button" class="month-filter-nav" id="lead-form-month-prev" onclick="shiftFormMonthYear('lead', -1, event)" aria-label="Previous year">‹</button>
              <div class="month-filter-year" id="lead-form-month-year"></div>
              <button type="button" class="month-filter-nav" id="lead-form-month-next" onclick="shiftFormMonthYear('lead', 1, event)" aria-label="Next year">›</button>
            </div>
            <div class="month-filter-grid" id="lead-form-month-grid" role="listbox" aria-label="Select month"></div>
          </div>
        </div>
      </div>
      <div class="half"><div class="mlbl">Status Detail</div><input type="text" id="lead-status-detail" placeholder="e.g. Email Outreach sent"></div>
    </div>
    <div class="mrow"><div style="width:100%;font-size:.68rem;color:#94a3b8">To tag additional outreach months for this company, use the month tag in the Pipeline table (click it directly) rather than here.</div></div>
    <div class="mrow">
      <div class="half"><div class="mlbl">Contact Person Name</div><input type="text" id="lead-contact" placeholder="e.g. John Smith"></div>
      <div class="half"><div class="mlbl">Contact Email</div><input type="email" id="lead-contact-email" placeholder="e.g. john@company.com"></div>
    </div>
    <div class="mrow">
      <div class="half"><div class="mlbl">Contact Phone</div><input type="text" id="lead-contact-phone" placeholder="e.g. +1 555 000 0000"></div>
      <div class="half"><div class="mlbl">Follow-up Date</div><input type="date" id="lead-followup"></div>
    </div>
    <input type="hidden" id="lead-status" value="New">
    <input type="hidden" id="lead-source" value="">
    <div class="mrow"><div style="width:100%"><div class="mlbl">Notes</div><textarea id="lead-notes" placeholder="Add a new note..."></textarea></div></div>
    <div class="mbtns">
      <button class="bdanger" id="lead-delete-btn" style="display:none" onclick="deleteLead()">Delete</button>
      <button class="bcancel" onclick="closeLeadModal()">Cancel</button>
      <button class="bsave" onclick="saveLead()">Save</button>
    </div>
  </div>
</div>

<!-- NOTE MODAL -->
<div class="overlay" id="note-modal">
  <div class="modal" style="width:500px">
    <div class="modal-header">
      <div><div id="modal-co" class="modal-title"></div><div id="modal-sub" style="font-size:.72rem;color:#64748b"></div></div>
      <button class="modal-close" onclick="closeNote()">✕</button>
    </div>
    <div id="note-history" style="max-height:260px;overflow-y:auto;margin-bottom:12px;display:flex;flex-direction:column;gap:8px"></div>
    <div style="border-top:1px solid #e2e8f0;padding-top:12px">
      <div style="font-size:.7rem;color:#64748b;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Add New Note</div>
      <textarea id="note-text" placeholder="Type your note..." style="min-height:70px"></textarea>
      <div class="mbtns">
        <button class="bcancel" onclick="closeNote()">Close</button>
        <button class="bsave" id="note-save-btn" onclick="saveNote()" style="display:none">Save Notes</button>
      </div>
    </div>
  </div>
</div>

<!-- FIELD EDIT POPOVER -->
<div id="field-edit-pop" style="display:none;position:fixed;z-index:9999;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;box-shadow:0 8px 24px rgba(15,23,42,.12);min-width:240px;width:260px">
  <div id="field-edit-label" style="font-size:.68rem;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em"></div>
  <div class="field-edit-search">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="text" id="field-edit-search" placeholder="Search..." autocomplete="off" oninput="filterFieldEditOptions()">
  </div>
  <div id="field-edit-list" class="field-edit-list" role="listbox"></div>
  <div style="display:flex;gap:6px;margin-top:8px">
    <button type="button" onclick="closeFieldEditPop()" style="flex:1;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;border-radius:5px;padding:5px;cursor:pointer;font-size:.72rem">Cancel</button>
  </div>
</div>

<!-- MONTH PICKER POPOVER -->
<div id="month-picker-pop" style="display:none;position:fixed;z-index:9999;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;box-shadow:0 8px 24px rgba(15,23,42,.12);min-width:220px">
  <div style="font-size:.68rem;color:#64748b;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Select Months — All Years</div>
  <div id="month-picker-list" style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:1px"></div>
  <div id="month-picker-selected-hint" class="month-picker-hint"></div>
  <div style="display:flex;gap:6px;margin-top:10px">
    <button onclick="saveMonthPicker()" style="flex:1;background:var(--accent);color:#fff;border:none;border-radius:5px;padding:5px;cursor:pointer;font-size:.72rem;font-weight:600">Save</button>
    <button onclick="document.getElementById('month-picker-pop').style.display='none'" style="flex:1;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;border-radius:5px;padding:5px;cursor:pointer;font-size:.72rem">Cancel</button>
  </div>
</div>

<!-- CONTACTS MODAL -->
<div class="overlay" id="contacts-modal" style="display:none" onclick="if(event.target===this)closeContacts()">
  <div class="modal" style="width:520px">
    <div class="modal-header">
      <div><div class="modal-title">Contacts</div><div id="contacts-co-name" style="font-size:.72rem;color:#64748b"></div></div>
      <button class="modal-close" onclick="closeContacts()">✕</button>
    </div>
    <div id="contacts-list" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;margin-bottom:14px"></div>
    <div style="border-top:1px solid #e2e8f0;padding-top:12px">
      <div style="font-size:.7rem;color:#64748b;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Add / Edit Contact</div>
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
  <div style="font-size:.72rem;color:#64748b;margin-bottom:6px">Set Follow-up Date</div>
  <input type="date" id="fu-picker">
  <div class="fu-btns">
    <button onclick="saveFU()" style="background:var(--accent);color:#fff">Save</button>
    <button onclick="clearFU()" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5">Clear</button>
    <button onclick="document.getElementById('fu-pop').style.display='none'" style="background:#f1f5f9;color:#64748b">Cancel</button>
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
      <select id="confirm-stage"></select>
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

<!-- PIPELINE TRASH / DELETED COMPANIES -->
<div class="overlay" id="pipeline-trash-modal">
  <div class="modal" style="width:min(520px,92vw)">
    <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">
      <div>
        <div class="modal-title" style="font-size:1.05rem;font-weight:700">Deleted companies</div>
        <div style="font-size:.75rem;color:#64748b;margin-top:2px">Restore items back to the pipeline</div>
      </div>
      <button type="button" class="modal-close" onclick="closePipelineTrash()" aria-label="Close">✕</button>
    </div>
    <div class="pipeline-trash-toolbar" id="pipeline-trash-toolbar" hidden>
      <label class="pipeline-trash-select-all">
        <input type="checkbox" id="pipeline-trash-select-all" onchange="togglePipelineTrashSelectAll(this.checked)" />
        <span>Select all</span>
      </label>
      <span class="pipeline-trash-selected-count" id="pipeline-trash-selected-count"></span>
    </div>
    <div id="pipeline-trash-list" style="max-height:360px;overflow:auto;display:flex;flex-direction:column;gap:8px"></div>
    <div class="mbtns" style="margin-top:14px">
      <button type="button" class="bcancel" onclick="closePipelineTrash()">Close</button>
      <button type="button" class="bdanger" id="pipeline-trash-delete-selected-btn" onclick="deleteSelectedTrashedCompanies()" disabled>Delete selected</button>
    </div>
  </div>
</div>
`
