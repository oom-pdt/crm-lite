// Deals list, and the deal editor shared with the lead page.

function oppsPage() {
  const opps = visibleOpps();
  const total = s => opps.filter(o => o.status === s);
  const sum = list => list.reduce((n, o) => n + o.value, 0);
  const tile = s => `<div class="card tile"><div class="tile-label">${s}</div><div class="tile-value">${fmtMoney(sum(total(s)))}</div><div class="tile-note">${total(s).length} ${total(s).length === 1 ? 'deal' : 'deals'}</div></div>`;
  return `
    <header class="page-head">
      <div><h1>Deals</h1><p class="sub">${isAdmin() ? 'Revenue logged against every lead' : 'Revenue logged against your leads'}</p></div>
      <button class="btn btn-primary" onclick="oppOpen()">${icon('add')}Add deal</button>
    </header>
    <div class="tiles">${OPP_STATUSES.map(tile).join('')}</div>
    <section class="card">
      <div class="toolbar">
        <div class="seg" role="group" aria-label="Filter by status">
          ${['', ...OPP_STATUSES].map(s => `<button class="${state.ui.oppStatus === s ? 'is-active' : ''}" onclick="oppSetFilter('${s}')">${s || 'All'}</button>`).join('')}
        </div>
        <div class="drp" id="drp-deals">${drpHTML('deals')}</div>
      </div>
      ${oppsTableHTML(opps)}
    </section>`;
}

function oppsTableHTML(opps) {
  const rows = opps.filter(o => (!state.ui.oppStatus || o.status === state.ui.oppStatus) && dateMatch(state.ui.dates.deals, o.closeDate || o.createdAt)).sort((a, b) => b.createdAt - a.createdAt);
  if (!rows.length) return `<div class="empty">${opps.length ? 'No deals match these filters.' : 'No deals yet. Add one to log revenue against a lead.'}</div>`;
  const admin = isAdmin();
  return `<div class="table-wrap"><table>
    <thead><tr><th>Deal</th><th class="hide-sm">Lead</th><th class="hide-sm">Source</th>${admin ? '<th class="hide-sm">Assignee</th>' : ''}<th>Status</th><th class="hide-sm">Closed</th><th class="num">Value</th><th aria-label="Actions"></th></tr></thead>
    <tbody>${rows.map(o => {
      const l = DB.leads.find(x => x.id === o.leadId);
      return `<tr>
        <td><div class="cell-main">${esc(o.name)}</div>${o.status === 'Lost' && o.lostReason ? `<div class="cell-sub">Lost: ${esc(o.lostReason)}</div>` : ''}<a class="cell-sub show-sm" href="#/leads/${l.id}">${esc(l.name)}</a></td>
        <td class="hide-sm"><a href="#/leads/${l.id}">${esc(l.name)}</a></td>
        <td class="hide-sm">${pill(l.source)}</td>
        ${admin ? `<td class="hide-sm">${esc(userName(l.assigneeId))}</td>` : ''}
        <td>${pill(o.status)}</td>
        <td class="hide-sm">${fmtDate(o.closeDate)}</td>
        <td class="num">${fmtMoney(o.value)}</td>
        <td class="num"><button class="btn btn-icon" onclick="oppOpen('${o.id}')" aria-label="Edit ${esc(o.name)}">${icon('edit')}</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

function oppSetFilter(s) { state.ui.oppStatus = s; render(); }

// Opens the editor for an existing deal, or a new one. When leadId is given
// (opened from a lead page) the lead is already known, so the Lead field is left out; otherwise the user picks one
// (a new deal) or sees which lead it belongs to (an existing deal).
// A draft puts back what was typed when the lost dialog is cancelled.
function oppOpen(oppId, leadId, draft) {
  const o = { ...(oppId ? DB.opps.find(x => x.id === oppId) : { leadId: leadId || '', name: '', value: '', status: 'Open', closeDate: '', note: '' }), ...draft };
  const leads = visibleLeads().slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!leads.length) { toast('Add a lead first.'); return; }
  const fixedLead = oppId || leadId, fromLead = !!leadId;
  openModal(oppId ? 'Edit deal' : 'Add deal', `
    <div class="form-grid">
      ${fromLead ? `<input type="hidden" id="opp-lead" value="${esc(o.leadId)}">` : fieldHTML('Lead', 'opp-lead', selectHTML('opp-lead', leads.map(l => [l.id, l.name]), o.leadId, fixedLead ? 'disabled' : ''), 'span-2')}
      ${fieldHTML('Deal name', 'opp-name', inputHTML('opp-name', o.name, 'placeholder="Annual plan" required aria-required="true"'), 'span-2', '', true)}
      ${fieldHTML('Value (S$)', 'opp-value', inputHTML('opp-value', o.value, 'type="number" min="0" step="1" inputmode="decimal" required aria-required="true"'), 'span-2', '', true)}
      <div class="span-2 opp-status-row">
      ${fieldHTML('Status', 'opp-status', selectHTML('opp-status', OPP_STATUSES, o.status, `onchange="oppStatusChanged()"`), '', 'Only Won counts towards lifetime value.')}
      ${fieldHTML('Close date', 'opp-close', inputHTML('opp-close', o.status === 'Open' ? '' : o.closeDate, 'type="date"'), o.status === 'Open' ? 'is-hidden' : '')}
      </div>
      ${fieldHTML('Note', 'opp-note', `<textarea class="textarea" id="opp-note">${esc(o.note)}</textarea>`, 'span-2')}
    </div>
    <p class="form-error" id="opp-error" role="alert"></p>`,
    `${oppId ? `<button class="btn btn-danger" onclick="oppDelete('${oppId}')">Delete</button>` : ''}
     <button class="btn" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="oppSave('${oppId || ''}')">${oppId ? 'Save' : 'Add deal'}</button>`);
}

// An open deal has no close date. The field appears once the deal is Won or Lost, starting at today, and goes when it is reopened.
function oppStatusChanged() {
  const closed = val('opp-status') !== 'Open', box = document.querySelector('[data-field="opp-close"]');
  box.classList.toggle('is-hidden', !closed);
  if (closed && !val('opp-close')) document.getElementById('opp-close').value = dateKey(new Date());
}

function oppSave(oppId) {
  const status = val('opp-status');
  const d = { leadId: val('opp-lead'), name: val('opp-name'), value: Number(val('opp-value')), status, closeDate: status === 'Open' ? '' : val('opp-close'), note: val('opp-note') };
  const lead = visibleLeads().find(l => l.id === d.leadId);
  const err = !lead ? 'Choose a lead.' : !d.name ? 'Give the deal a name.' : val('opp-value') === '' || !(d.value >= 0) ? 'Enter a value of 0 or more.' : '';
  // A deal that is Won or Lost always has a close date; if it was cleared, it is the day it was marked.
  if (!err && status !== 'Open' && !d.closeDate) d.closeDate = dateKey(new Date());
  if (err) { document.getElementById('opp-error').textContent = err; return; }
  const was = oppId ? DB.opps.find(x => x.id === oppId).status : null;
  if (d.status === 'Lost' && was !== 'Lost') {
    const fromLead = document.getElementById('opp-lead').type === 'hidden';
    lostOpen({
      title: 'Mark deal as lost',
      intro: `${d.name} is closed as lost, so it adds nothing to ${lead.name}'s lifetime value. Say why, so your team can learn from it.`,
      reasons: DEAL_LOST_REASONS,
      apply: (reason, note) => oppCommit(oppId, d, { reason, note }),
      cancel: () => oppOpen(oppId, fromLead ? d.leadId : '', d)
    });
    return;
  }
  oppCommit(oppId, d);
}
function oppCommit(oppId, d, lost) {
  const lead = DB.leads.find(l => l.id === d.leadId);
  // A lost reason is kept only while the deal is Lost.
  if (d.status !== 'Lost') { d.lostReason = ''; d.lostNote = ''; } else if (lost) { d.lostReason = lost.reason; d.lostNote = lost.note; }
  const label = `${d.name} · ${fmtMoney(d.value)}`;
  let prev = null;
  if (oppId) {
    const o = DB.opps.find(x => x.id === oppId);
    prev = o.status;
    const edited = o.name !== d.name || o.value !== d.value || o.closeDate !== d.closeDate || o.note !== d.note;
    Object.assign(o, d);
    if (edited && prev === d.status) logActivity(lead.id, 'lead_updated', 'Deal edited', label);
  } else {
    const fresh = { id: 'O' + (501 + DB.opps.length) + '-' + DB.seq, ...d, createdAt: Date.now() };
    DB.opps.push(fresh);
    logActivity(lead.id, 'opp_created', 'Deal added', label, { oppId: fresh.id });
  }
  if (d.status !== prev) {
    if (d.status === 'Won') logActivity(lead.id, 'opp_won', 'Deal won', label);
    if (d.status === 'Lost') logActivity(lead.id, 'opp_lost', 'Deal lost', `${d.name}. ${lostText(d.lostReason, d.lostNote)}`);
    if (d.status === 'Open' && prev) logActivity(lead.id, 'lead_updated', 'Deal reopened', d.name);
    // A lead with won revenue has converted.
    if (d.status === 'Won' && lead.status !== 'Converted') {
      logActivity(lead.id, 'status_changed', 'Status changed', `${lead.status} → Converted`);
      lead.status = 'Converted'; stamp(lead, 'status'); lead.lostReason = ''; lead.lostNote = '';
    }
  }
  closeModal();
  toast(oppId ? 'Deal saved' : 'Deal added');
  render();
}

function oppDelete(oppId) {
  const o = DB.opps.find(x => x.id === oppId);
  if (!confirm(`Delete “${o.name}”? This removes its revenue from the lead.`)) return;
  DB.opps = DB.opps.filter(x => x.id !== oppId);
  logActivity(o.leadId, 'lead_updated', 'Deal deleted', `${o.name} · ${fmtMoney(o.value)}`);
  closeModal();
  toast('Deal deleted');
  render();
}
