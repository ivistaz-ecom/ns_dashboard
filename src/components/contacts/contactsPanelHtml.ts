export const contactsPanelHtml = `
<!-- ===== CONTACTS ===== -->
<div class="panel" id="panel-contacts">
  <div class="page-hero">
    <div><h2 class="greeting">Contacts</h2><p class="greeting-sub">Manage company contact information</p></div>
  </div>
  <div class="ctrl">
    <div class="search-field">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="ct-search" placeholder="Search companies, notes..." oninput="renderContactsTab()">
    </div>
    <select id="ct-has-filter" onchange="renderContactsTab()">
      <option value="">All Companies</option>
      <option value="yes">Has Contacts</option>
      <option value="no">No Contacts Yet</option>
    </select>
    <button class="cbtn" onclick="document.getElementById('ct-search').value='';document.getElementById('ct-has-filter').value='';renderContactsTab()">✕ Clear</button>
  </div>
  <div class="scroll">
    <table>
      <thead><tr>
        <th>Company</th><th>Country</th><th>Stage</th><th>Contact Name</th><th>Title</th><th>Email</th><th>Phone</th><th>Action</th>
      </tr></thead>
      <tbody id="ct-tbody"></tbody>
    </table>
    <div class="nores" id="ct-nores" style="display:none">No results</div>
  </div>
  <div class="pgn">
    <span id="ct-pinfo">—</span>
    <div class="pbtns">
      <button class="pb" id="ct-pprev" onclick="changeCtPage(-1)">← Prev</button>
      <button class="pb" id="ct-ppnext" onclick="changeCtPage(1)">Next →</button>
    </div>
  </div>
</div>
`
