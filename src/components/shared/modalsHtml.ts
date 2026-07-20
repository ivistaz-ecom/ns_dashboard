export const modalsHtml = `
<!-- LEAD STAGE DROPDOWN -->
<div id="lead-stage-drop" class="stage-drop">
  <div class="sd-hint">Change Stage</div>
  <div class="sd-item" onclick="setLeadStage('New')"><div class="sd-dot" style="background:#64748b"></div>New</div>
  <div class="sd-item" onclick="setLeadStage('Researching')"><div class="sd-dot" style="background:#7c3aed"></div>Researching</div>
  <div class="sd-item" onclick="setLeadStage('Ready to Contact')"><div class="sd-dot" style="background:#16a34a"></div>Ready to Contact</div>
  <div class="sd-item" onclick="setLeadStage('Passed')"><div class="sd-dot" style="background:#d97706"></div>Added to Pipeline</div>
</div>

<!-- STAGE DROPDOWN -->
<div id="stage-drop" class="stage-drop">
  <div class="sd-hint">Change Stage</div>
  <div class="sd-item" onclick="setStage('Email Outreach')"><div class="sd-dot" style="background:#2563eb"></div>Email Outreach</div>
  <div class="sd-item" onclick="setStage('Retargeted')"><div class="sd-dot" style="background:#d97706"></div>Retargeted</div>
  <div class="sd-item" onclick="setStage('Meeting / Positive')"><div class="sd-dot" style="background:#16a34a"></div>Meeting / Positive</div>
  <div class="sd-item" onclick="setStage('Not Interested')"><div class="sd-dot" style="background:#dc2626"></div>Not Interested</div>
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
      <div><div id="modal-co" class="modal-title"></div><div id="modal-sub" style="font-size:.72rem;color:#64748b"></div></div>
      <button class="modal-close" onclick="closeNote()">✕</button>
    </div>
    <div id="note-history" style="max-height:260px;overflow-y:auto;margin-bottom:12px;display:flex;flex-direction:column;gap:8px"></div>
    <div style="border-top:1px solid #e2e8f0;padding-top:12px">
      <div style="font-size:.7rem;color:#64748b;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Add New Note</div>
      <textarea id="note-text" placeholder="Type your note..." style="min-height:70px"></textarea>
      <div class="mbtns">
        <button class="bcancel" onclick="closeNote()">Close</button>
        <button class="bsave" onclick="saveNote()">+ Add Note</button>
      </div>
    </div>
  </div>
</div>

<!-- FIELD EDIT POPOVER -->
<div id="field-edit-pop" style="display:none;position:fixed;z-index:9999;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;box-shadow:0 8px 24px rgba(15,23,42,.12);min-width:200px">
  <div id="field-edit-label" style="font-size:.68rem;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em"></div>
  <input id="field-edit-inp" type="text" style="background:#f8fafc;border:1px solid #e2e8f0;color:#0f172a;border-radius:6px;padding:5px 8px;font-size:.76rem;width:100%;box-sizing:border-box;outline:none" onkeydown="if(event.key==='Enter')saveFieldEdit()">
  <div id="field-edit-mgmt-btns" style="display:none;flex-direction:column;gap:5px">
    <button onclick="pickMgmt('')" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#64748b;border-radius:6px;padding:6px 10px;font-size:.76rem;cursor:pointer;text-align:left">— Clear</button>
    <button onclick="pickMgmt('Inhouse')" style="background:#eff6ff;border:1px solid #93c5fd;color:#1d4ed8;border-radius:6px;padding:6px 10px;font-size:.76rem;cursor:pointer;text-align:left">Inhouse</button>
    <button onclick="pickMgmt('Outsourced')" style="background:#fffbeb;border:1px solid #fcd34d;color:#b45309;border-radius:6px;padding:6px 10px;font-size:.76rem;cursor:pointer;text-align:left">Outsourced</button>
    <button onclick="pickMgmt('Both')" style="background:#f5f3ff;border:1px solid #c4b5fd;color:#6d28d9;border-radius:6px;padding:6px 10px;font-size:.76rem;cursor:pointer;text-align:left">Both</button>
    <button onclick="pickMgmt('Unsure')" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#64748b;border-radius:6px;padding:6px 10px;font-size:.76rem;cursor:pointer;text-align:left">Unsure</button>
  </div>
  <div id="field-edit-inp-row" style="display:flex;gap:6px;margin-top:8px">
    <button onclick="saveFieldEdit()" style="flex:1;background:var(--accent);color:#fff;border:none;border-radius:5px;padding:5px;cursor:pointer;font-size:.72rem;font-weight:600">Save</button>
    <button onclick="document.getElementById('field-edit-pop').style.display='none'" style="flex:1;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;border-radius:5px;padding:5px;cursor:pointer;font-size:.72rem">Cancel</button>
  </div>
</div>

<!-- MONTH PICKER POPOVER -->
<div id="month-picker-pop" style="display:none;position:fixed;z-index:9999;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;box-shadow:0 8px 24px rgba(15,23,42,.12);min-width:190px">
  <div style="font-size:.68rem;color:#64748b;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Select Months</div>
  <div id="month-picker-list" style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:1px"></div>
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
    <button onclick="followUps[fuTarget]&&(delete followUps[fuTarget],saveFollowUps(),document.getElementById('fu-pop').style.display='none',renderTable(),updateKPIs())" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5">Clear</button>
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
