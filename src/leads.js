// Leads list with the summary tiles, the add-lead dialog, and the lead page.

// ---- Leads list -------------------------------------------------------------
function leadsPage() {
  const ui = state.ui, admin = isAdmin();
  const leads = visibleLeads();
  return `
    <header class="page-head">
      <div><h1>Leads</h1><p class="sub">${admin ? 'Every lead in the organisation' : 'Leads assigned to you'}</p></div>
      <button class="btn btn-primary" onclick="leadOpenAdd()">${icon('add')}Add lead</button>
    </header>
    ${leadsSummaryHTML(leads)}
    <section class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}<input class="input" id="lead-q" placeholder="Search name, email or phone" value="${esc(ui.q)}" oninput="leadSetFilter('q', this.value)" aria-label="Search leads"></div>
        ${selectHTML('lead-f-status', [['', 'All statuses'], ...LEAD_STATUSES], ui.status, `onchange="leadSetFilter('status', this.value)" aria-label="Filter by status"`)}
        ${selectHTML('lead-f-source', [['', 'All sources'], ...LEAD_SOURCES], ui.source, `onchange="leadSetFilter('source', this.value)" aria-label="Filter by source"`)}
        <div class="drp" id="drp-leads">${drpHTML('leads')}</div>
        ${admin ? selectHTML('lead-f-assignee', [['', 'All assignees'], ['none', 'Unassigned'], ...DB.users.map(u => [u.id, u.name])], ui.assignee, `onchange="leadSetFilter('assignee', this.value)" aria-label="Filter by assignee"`) : ''}
      </div>
      <div id="lead-results">${leadsResultsHTML()}</div>
    </section>`;
}

function leadsSummaryHTML(leads) {
  const ltv = ltvMap();
  const won = leads.reduce((s, l) => s + (ltv[l.id] || 0), 0);
  const converted = leads.filter(l => l.status === 'Converted').length;
  const tile = (label, value, note) => `<div class="card tile"><div class="tile-label">${label}</div><div class="tile-value">${value}</div><div class="tile-note">${note}</div></div>`;
  return `
    <div class="tiles">
      ${tile('Leads', leads.length, 'All time')}
      ${tile('Converted', converted, leads.length ? `${Math.round(converted / leads.length * 100)}% of leads` : '—')}
      ${tile('Won revenue', fmtMoney(won), 'From won deals')}
    </div>`;
}

// The line under the source pill. Manually added leads say so, because that is what decides whether they can be deleted.
function sourceNote(l) {
  const detail = l.attribution.sourceDetail || l.attribution.campaign;
  return l.origin === 'manual' ? ['Added manually', detail].filter(Boolean).join(' · ') : detail;
}

function leadsFiltered() {
  const ui = state.ui, q = ui.q.trim().toLowerCase();
  return visibleLeads().filter(l =>
    (!q || l.name.toLowerCase().includes(q) || emailsOf(l).some(e => e.includes(q)) || phonesOf(l).some(p => p.replace(/\s/g, '').includes(q.replace(/\s/g, '')))) &&
    (!ui.status || l.status === ui.status) &&
    (!ui.source || l.source === ui.source) &&
    dateMatch(ui.dates.leads, l.createdAt) &&
    (!ui.assignee || (ui.assignee === 'none' ? !l.assigneeId : l.assigneeId === ui.assignee))
  ).sort((a, b) => b.createdAt - a.createdAt);
}

function leadsResultsHTML() {
  const rows = leadsFiltered(), ltv = ltvMap(), admin = isAdmin();
  // Only leads that are in view can stay selected, so a bulk action never touches rows the user can't see.
  const inView = new Set(rows.map(l => l.id));
  state.ui.selected = state.ui.selected.filter(id => inView.has(id));
  const sel = new Set(state.ui.selected);
  if (!rows.length) return `<div class="empty">${visibleLeads().length ? 'No leads match these filters.' : 'No leads are assigned to you yet.'}</div>`;
  return `${bulkBarHTML(sel.size)}<div class="table-wrap"><table>
    <thead><tr><th class="sel"><input type="checkbox" class="chk" id="lead-sel-all" onchange="leadToggleAll(this.checked)" aria-label="Select all leads shown"${sel.size === rows.length ? ' checked' : ''}></th><th>Lead</th><th class="hide-sm">Source</th><th class="hide-sm">Status</th>${admin ? '<th class="hide-sm">Assignee</th>' : ''}<th class="hide-sm">Created</th><th class="num">Lifetime value</th></tr></thead>
    <tbody>${rows.map(l => `<tr class="is-link${sel.has(l.id) ? ' is-selected' : ''}" onclick="navigate('#/leads/${l.id}')">
      <td class="sel" onclick="event.stopPropagation()"><input type="checkbox" class="chk" onchange="leadToggle('${l.id}', this.checked)" aria-label="Select ${esc(l.name)}"${sel.has(l.id) ? ' checked' : ''}></td>
      <td><a class="cell-main" href="#/leads/${l.id}" onclick="event.stopPropagation()">${esc(l.name)}</a>${dupMap()[l.id] ? ' <span class="pill pill-duplicate">Possible duplicate</span>' : ''}<div class="cell-sub hide-sm">${esc(l.email || '—')}</div><div class="show-sm">${pill(l.source)} ${pill(l.status)}${l.origin === 'manual' ? '<div class="cell-sub">Added manually</div>' : ''}</div></td>
      <td class="hide-sm">${pill(l.source)}${sourceNote(l) ? `<div class="cell-sub">${esc(sourceNote(l))}</div>` : ''}</td>
      <td class="hide-sm">${pill(l.status)}</td>
      ${admin ? `<td class="hide-sm${l.assigneeId ? '' : ' muted'}">${esc(userName(l.assigneeId))}</td>` : ''}
      <td class="hide-sm">${fmtDate(l.createdAt)}</td>
      <td class="num">${ltv[l.id] ? `<strong>${fmtMoney(ltv[l.id])}</strong>` : '<span class="muted">—</span>'}</td>
    </tr>`).join('')}</tbody></table></div>
    <div class="count">${rows.length} of ${visibleLeads().length} leads</div>`;
}

// ---- Bulk actions -----------------------------------------------------------
// Assign and Delete are admin only. Anyone can change the status of leads they can see.
// Only manually created leads can be deleted; the delete dialog says so when the selection includes others.
function bulkBarHTML(n) {
  if (!n) return '';
  const admin = isAdmin();
  return `<div class="bulk-bar" role="group" aria-label="Bulk actions"><strong>${n} selected</strong>
    ${admin ? selectHTML('bulk-assign', [['', 'Assign to…'], ['none', 'Unassigned'], ...DB.users.map(u => [u.id, u.name])], '', `onchange="leadBulkAssign(this.value)" aria-label="Assign selected leads"`) : ''}
    ${selectHTML('bulk-status', [['', 'Change status…'], ...LEAD_STATUSES], '', `onchange="leadBulkStatus(this.value)" aria-label="Change status of selected leads"`)}
    ${admin ? `<button class="btn btn-delete" onclick="leadBulkDeleteAsk()">${icon('del')}Delete</button>` : ''}
    <button class="btn" onclick="leadClearSel()">Clear</button>
  </div>`;
}
const leadCount = n => `${n} ${n === 1 ? 'lead' : 'leads'}`;
function selectedLeads() { return DB.leads.filter(l => state.ui.selected.includes(l.id) && canSeeLead(l)); }

function leadRefreshResults() {
  document.getElementById('lead-results').innerHTML = leadsResultsHTML();
  refreshIcons();
  leadSyncSelectAll();
}
// The header checkbox is half-filled when only some of the shown leads are selected.
function leadSyncSelectAll() {
  const box = document.getElementById('lead-sel-all');
  if (box) box.indeterminate = state.ui.selected.length > 0 && !box.checked;
}
function leadToggle(id, on) {
  const s = new Set(state.ui.selected);
  if (on) s.add(id); else s.delete(id);
  state.ui.selected = [...s];
  leadRefreshResults();
}
function leadToggleAll(on) { state.ui.selected = on ? leadsFiltered().map(l => l.id) : []; leadRefreshResults(); }
function leadClearSel() { state.ui.selected = []; leadRefreshResults(); }

function leadBulkStatus(status) {
  const leads = selectedLeads();
  if (!status || !leads.length) return;
  let n = 0;
  if (status === 'Lost') {
    const targets = leads.filter(l => l.status !== 'Lost');
    if (!targets.length) { toast('Already Lost'); render(); return; }
    leadsMarkLost(targets, true);
    render();   // puts the dropdown back until the reason is confirmed
    return;
  }
  leads.forEach(l => { if (l.status !== status) { leadApplyStatus(l, status); n++; } });
  state.ui.selected = [];
  toast(n ? `${leadCount(n)} changed to ${status}` : `Already ${status}`);
  render();
}
function leadBulkAssign(value) {
  const leads = selectedLeads();
  if (!isAdmin() || !value || !leads.length) return;
  const next = value === 'none' ? null : value;
  let n = 0;
  leads.forEach(l => { if (l.assigneeId !== next) { logActivity(l.id, 'assignee_changed', 'Assignee changed', `${userName(l.assigneeId)} → ${userName(next)}`); l.assigneeId = next; stamp(l, 'assigneeId'); n++; } });
  state.ui.selected = [];
  toast(n ? `${leadCount(n)} ${next ? `assigned to ${userName(next)}` : 'unassigned'}` : 'No change');
  render();
}
function leadBulkDeleteAsk() {
  const leads = selectedLeads();
  if (!isAdmin() || !leads.length) return;
  const manual = leads.filter(l => l.origin === 'manual'), n = leads.length, m = manual.length;
  if (!m) {
    openModal(`Can't delete ${leadCount(n)}`,
      `<p><strong>Only manually created leads can be deleted.</strong> ${n === 1 ? "The selected lead wasn't" : `None of the ${n} selected leads were`} created manually, so nothing will be deleted.</p>`,
      `<button class="btn btn-primary" onclick="closeModal()">OK</button>`);
    return;
  }
  const ids = new Set(manual.map(l => l.id));
  const opps = DB.opps.filter(o => ids.has(o.leadId)), won = opps.filter(o => o.status === 'Won').reduce((t, o) => t + o.value, 0);
  const warning = m < n ? `<p><strong>Only manually created leads can be deleted.</strong> ${m} of the ${n} selected leads ${m === 1 ? 'is' : 'are'} manually created, so only ${m === 1 ? 'that one' : `those ${m}`} will be deleted. The other ${n - m} will be kept.</p>` : '';
  openModal(`Delete ${leadCount(m)}?`,
    `${warning}<p>This permanently removes ${m === 1 ? 'this lead' : 'these leads'}, ${opps.length} ${opps.length === 1 ? 'deal' : 'deals'} (${fmtMoney(won)} won revenue) and their timelines. It can't be undone.</p>`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-delete" onclick="leadBulkDeleteDo()">Delete ${leadCount(m)}</button>`);
}
function leadBulkDeleteDo() {
  if (!isAdmin()) return;
  const ids = new Set(selectedLeads().filter(l => l.origin === 'manual').map(l => l.id));
  DB.leads = DB.leads.filter(l => !ids.has(l.id));
  DB.opps = DB.opps.filter(o => !ids.has(o.leadId));
  DB.activities = DB.activities.filter(a => !ids.has(a.leadId));
  state.ui.selected = [];
  closeModal();
  toast(`${leadCount(ids.size)} deleted`);
  render();
}

// Filters refresh only the results, so the search box keeps focus while typing.
function leadSetFilter(key, value) {
  state.ui[key] = value;
  leadRefreshResults();
}

// ---- Attribution fields (shared by the add dialog and the lead page) --------
function attrFieldsHTML(prefix, source, attr) {
  return ATTR_FIELDS.map(f => `<div class="field" data-attr="${f.key}"${SOURCE_FIELDS[source].includes(f.key) ? '' : ' hidden'}><label class="field-label" for="${prefix}-${f.key}">${f.label}</label>${inputHTML(`${prefix}-${f.key}`, attr[f.key] || '')}</div>`).join('');
}
// Shows only the attribution fields that apply to the chosen source.
function attrToggle(prefix, source) {
  ATTR_FIELDS.forEach(f => { document.getElementById(`${prefix}-${f.key}`).closest('.field').hidden = !SOURCE_FIELDS[source].includes(f.key); });
}
function attrRead(prefix, source) {
  const a = {};
  ATTR_FIELDS.forEach(f => { a[f.key] = SOURCE_FIELDS[source].includes(f.key) ? val(`${prefix}-${f.key}`) : ''; });
  return a;
}
function leadValidate(d, exceptId) {
  if (!d.name) return 'Enter a name.';
  if (!d.email && !d.phone) return 'Enter an email or a phone number.';
  if (d.email && !validEmail(d.email)) return 'Enter a valid email address.';
  if (d.moreEmails.length && !d.email) return 'Add a primary email before adding more.';
  if (d.morePhones.length && !d.phone) return 'Add a primary phone number before adding more.';
  if (d.moreEmails.some(e => !validEmail(e.value))) return 'Enter a valid additional email address.';
  return '';
}

// Emails and phone numbers. With one value it is a plain field plus an "Add another" button. Once a second is added the field becomes a
// list headed "Emails" (or "Phone numbers"): each row is an editable title and its value, starting with Primary, then Secondary.
// The first row is always the primary one.
const CONTACT_KINDS = {
  email: { head: 'Emails', single: 'Email', type: 'email', add: 'Add another email' },
  phone: { head: 'Phone numbers', single: 'Phone', type: 'tel', add: 'Add another phone number' }
};
function contactEditHTML(prefix, kind, st) {
  const k = CONTACT_KINDS[kind], id = `${prefix}-${kind}`;
  const addBtn = `<button type="button" class="btn btn-more" onclick="contactAdd('${prefix}', '${kind}')">${icon('add')}${k.add}</button>`;
  if (!st.more.length && !st.expanded) {
    return `<div class="field span-2 ce" id="${id}-ce" data-label="${esc(st.label)}"><label class="field-label" for="${id}">${k.single}</label>${inputHTML(id, st.value, `type="${k.type}"`)}${addBtn}</div>`;
  }
  const row = (label, value, primary, n) => `<div class="ce-row"><input class="input ce-label" value="${esc(label)}" aria-label="${k.single} ${n} title">
    <input class="input ce-value"${primary ? ` id="${id}"` : ''} type="${k.type}" value="${esc(value)}" aria-label="${k.single} ${n}">
    ${primary ? '<span class="ce-gap"></span>' : `<button type="button" class="btn btn-icon" onclick="contactRemove(this)" aria-label="Remove ${k.single.toLowerCase()} ${n}">${icon('del')}</button>`}</div>`;
  return `<div class="field span-2 ce ce-multi" id="${id}-ce"><div class="field-label">${k.single}</div>
    ${row(st.label, st.value, true, 1)}${st.more.map((m, i) => row(m.label, m.value, false, i + 2)).join('')}${addBtn}</div>`;
}
// What the editor currently shows, read back from the page.
function contactState(prefix, kind) {
  const box = document.getElementById(`${prefix}-${kind}-ce`);
  if (!box.classList.contains('ce-multi')) return { label: box.dataset.label, value: val(`${prefix}-${kind}`), more: [] };
  const rows = [...box.querySelectorAll('.ce-row')].map(r => ({ label: r.querySelector('.ce-label').value.trim(), value: r.querySelector('.ce-value').value.trim() }));
  return { label: rows[0].label, value: rows[0].value, more: rows.slice(1), expanded: true };
}
function contactAdd(prefix, kind) {
  const st = contactState(prefix, kind);
  if (!st.label) st.label = defaultContactLabel(0);
  st.more.push({ label: defaultContactLabel(st.more.length + 1), value: '' });
  st.expanded = true;
  document.getElementById(`${prefix}-${kind}-ce`).outerHTML = contactEditHTML(prefix, kind, st);
  refreshIcons();
  document.getElementById(`${prefix}-${kind}-ce`).querySelector('.ce-row:last-of-type .ce-value').focus();
}
function contactRemove(btn) { btn.closest('.ce-row').remove(); }
// Blank rows are dropped, and so are repeats of the primary or of each other. A blank title falls back to its default.
function contactRead(prefix, kind) {
  const st = contactState(prefix, kind), key = kind === 'email' ? emailKey : p => phoneKey(p) || p.trim();
  const fix = v => kind === 'email' ? v.toLowerCase() : v;
  const seen = new Set([key(st.value)]), more = [];
  st.more.forEach(m => { if (m.value && !seen.has(key(m.value))) { seen.add(key(m.value)); more.push({ label: m.label || defaultContactLabel(more.length + 1), value: fix(m.value) }); } });
  return { label: st.label || 'Primary', value: fix(st.value), more };
}

// ---- Add lead ---------------------------------------------------------------
function leadOpenAdd() {
  const admin = isAdmin();
  openModal('Add lead', `
    <div class="form-grid">
      ${fieldHTML('Name', 'nl-name', inputHTML('nl-name', '', 'required aria-required="true"'), 'span-2', '', true)}
      ${fieldHTML('Email', 'nl-email', inputHTML('nl-email', '', 'type="email"'))}
      ${fieldHTML('Phone', 'nl-phone', inputHTML('nl-phone', '', 'type="tel"'))}
      ${fieldHTML('Status', 'nl-status', selectHTML('nl-status', LEAD_STATUSES.filter(s => s !== 'Lost'), 'New'))}
      ${fieldHTML('Assignee', 'nl-assignee', selectHTML('nl-assignee', admin ? assigneeOptions() : [[state.userId, me().name]], state.userId, admin ? '' : 'disabled'), '', admin ? '' : 'Leads you add are assigned to you.')}
    </div>
    <div class="form-section">Where did this lead come from?</div>
    <div class="form-grid">
      ${fieldHTML('Source', 'nl-source', selectHTML('nl-source', MANUAL_SOURCES, 'Personal referral', `onchange="attrToggle('nl', this.value)"`))}
      ${fieldHTML('Contacted us via', 'nl-channel', selectHTML('nl-channel', CONTACT_CHANNELS, 'Phone call'))}
      ${attrFieldsHTML('nl', 'Personal referral', {})}
    </div>
    <p class="form-error" id="nl-error" role="alert"></p>`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="leadSaveNew()">Add lead</button>`);
}

function leadSaveNew() {
  const source = val('nl-source');
  const d = {
    name: val('nl-name'), email: val('nl-email').toLowerCase(), phone: val('nl-phone'), status: val('nl-status'), source,
    notes: '', emailLabel: 'Primary', phoneLabel: 'Primary', moreEmails: [], morePhones: [],
    attribution: attrRead('nl', source), contactChannel: val('nl-channel'),
    // Basic users can only create leads for themselves, whatever the form says.
    assigneeId: isAdmin() ? (val('nl-assignee') || null) : state.userId
  };
  const err = leadValidate(d);
  if (err) { document.getElementById('nl-error').textContent = err; return; }
  const id = 'L' + (1001 + DB.leads.length) + '-' + (++DB.seq);
  const now = Date.now();
  DB.leads.push({ id, ...d, origin: 'manual', createdAt: now, fieldUpdated: Object.fromEntries(MERGE_FIELDS.map(f => [f, now])) });
  logActivity(id, 'lead_created', 'Lead added manually', `Source: ${source}`);
  closeModal();
  toast(duplicatesOf(DB.leads.at(-1)).length ? 'Lead added. It may be a duplicate.' : 'Lead added');
  navigate('#/leads/' + id);
}

// ---- Lead page --------------------------------------------------------------
function leadDetailPage(id) {
  const l = DB.leads.find(x => x.id === id);
  if (!l || !canSeeLead(l)) { toast('That lead is not available to you.'); location.replace('#/leads'); return null; }
  const editing = state.ui.editing, admin = isAdmin();
  const opps = DB.opps.filter(o => o.leadId === id).sort((a, b) => b.createdAt - a.createdAt);
  const ltv = leadLtv(id);
  const row = (label, value) => `<dt>${label}</dt><dd>${value}</dd>`;
  const text = v => v ? esc(v) : '<span class="muted">—</span>';
  // One value is a plain row. With more, the plain label ("Phone") stands alone and each value gets its own row beneath it:
  // the title (Primary, Secondary, ...) in the label column with a bar beside the group, and only the number in the value column.
  const contactRows = (single, label, primary, more = []) => more.length
    ? `<dt class="head">${single}</dt><div class="kv-sub">${[{ label, value: primary }, ...more].map(x => `<dt>${esc(x.label)}</dt><dd>${text(x.value)}</dd>`).join('')}</div>`
    : row(single, text(primary));

  // How the lead came in is fixed once the lead exists, so these rows are read-only, in edit mode too.
  // Lead source is the first touch (see the journey); "Contacted us via" is the channel they got in touch on.
  const sourceRows = `${row('Lead source', pill(l.source))}${row('Contacted us via', text(l.contactChannel))}`;
  const details = editing ? `
    <div class="form-grid">
      ${fieldHTML('Name', 'le-name', inputHTML('le-name', l.name, 'required aria-required="true"'), 'span-2', '', true)}
      ${contactEditHTML('le', 'email', { label: l.emailLabel || 'Primary', value: l.email, more: l.moreEmails || [] })}
      ${contactEditHTML('le', 'phone', { label: l.phoneLabel || 'Primary', value: l.phone, more: l.morePhones || [] })}
    </div>
    <dl class="kv" style="margin-top:16px">${sourceRows}</dl>` : `
    <dl class="kv">
      ${row('Name', esc(l.name))}
      ${contactRows('Email', l.emailLabel || 'Primary', l.email, l.moreEmails)}
      ${contactRows('Phone', l.phoneLabel || 'Primary', l.phone, l.morePhones)}
      ${sourceRows}
    </dl>`;

  const view = timelineView(id);

  return `
    <a class="back" href="#/leads">${icon('back')}Leads</a>
    <header class="page-head">
      <div class="lead-head"><h1>${esc(l.name)}</h1>${pill(l.status)}</div>
    </header>
    ${dupBannerHTML(l)}
    ${contactBarHTML(l)}
    ${leadStatsHTML(l, ltv, editing)}
    <p class="form-error" id="le-error" role="alert" style="margin:-8px 0 16px"></p>
    <div class="grid-2">
      <div>
        <section class="card"><div class="card-head"><h2>Details</h2>
          <div class="head-actions">${editing
            ? `<button class="btn" onclick="leadEdit(false)">Cancel</button><button class="btn btn-primary" onclick="leadSave('${id}')">Save changes</button>`
            : `<button class="btn" onclick="leadEdit(true)">${icon('edit')}Edit</button>`}</div>
        </div>${details}</section>
        <section class="card">
          <div class="card-head"><h2>Deals</h2><button class="btn" onclick="oppOpen('', '${id}')">${icon('add')}Add</button></div>
          ${opps.length ? opps.map(o => `<div class="opp-row">
              <div><div class="cell-main opp-title"><span>${esc(o.name)}</span>${pill(o.status)}</div><div class="cell-sub">${o.status === 'Open' ? 'Opened ' + fmtDate(o.createdAt) : 'Closed ' + fmtDate(o.closeDate)}${o.status === 'Lost' && o.lostReason ? ` · ${esc(o.lostReason)}` : ''}${o.note ? ` · ${esc(o.note)}` : ''}</div></div>
              <span class="num"><strong>${fmtMoney(o.value)}</strong></span>
              <button class="btn btn-icon" onclick="oppOpen('${o.id}', '${id}')" aria-label="Edit ${esc(o.name)}">${icon('edit')}</button>
            </div>`).join('') + `<div class="opp-total"><span>Lifetime value (won)</span><span>${fmtMoney(ltv)}</span></div>`
            : '<div class="empty">No deals yet. Add one to log revenue from this lead.</div>'}
        </section>
        ${leadNotesHTML(l)}
      </div>
      <section class="card">
        <div class="card-head">
          <div><h2>Timeline</h2><div class="muted" id="tl-count">${view.count}</div></div>
          <button class="btn" onclick="leadActivityOpen('${id}')">${icon('add')}Add activity</button>
        </div>
        ${journeySummaryHTML(id)}
        <ol class="timeline" id="timeline">${view.html}</ol>
      </section>
    </div>`;
}

// What created the lead: the conversation or form they got in touch on, or a person adding it by hand. Not "click tracking",
// which only explains where they came from before that.
const CREATED_FROM = { 'WhatsApp': 'From a WhatsApp conversation', 'Phone call': 'From a phone call', 'Web form': 'From a web form', 'Email': 'From an email', 'Live chat': 'From a live chat' };
function createdFrom(l) { return l.origin === 'manual' ? 'Added manually' : CREATED_FROM[l.contactChannel] || 'From an enquiry'; }

// Status, owner, revenue and age sit above the cards, apart from the contact details. Status and assignee save straight away.
function leadStatsHTML(l, ltv, editing) {
  const lock = editing ? ' disabled title="Save or cancel your edits first"' : '';
  const wonCount = DB.opps.filter(o => o.leadId === l.id && o.status === 'Won').length;
  const tile = (label, body, note) => `<div class="card tile"><div class="tile-label">${label}</div><div class="tile-body">${body}</div><div class="tile-note">${note || '&nbsp;'}</div></div>`;
  const assignee = isAdmin()
    ? selectHTML('lead-assignee', assigneeOptions(), l.assigneeId, `onchange="leadAssign('${l.id}', this.value)" aria-label="Assignee"${lock}`)
    : `<div class="tile-value">${l.assigneeId ? esc(userName(l.assigneeId)) : '<span class="muted">Unassigned</span>'}</div>`;
  return `<div class="lead-stats">
    ${tile('Status', selectHTML('lead-status', LEAD_STATUSES, l.status, `onchange="leadSetStatus('${l.id}', this.value)" aria-label="Status"${lock}`), l.status === 'Lost' && l.lostReason ? `Reason: ${esc(l.lostReason)}${l.lostNote ? `<br>\u201c${esc(l.lostNote)}\u201d` : ''}` : 'Updates straight away')}
    ${tile('Assignee', assignee, isAdmin() ? 'Updates straight away' : '')}
    ${tile('Lifetime value', `<div class="tile-value">${fmtMoney(ltv)}</div>`, plural(wonCount, 'won deal', 'won deals'))}
    ${tile('Created', `<div class="tile-value">${fmtDate(l.createdAt)}</div>`, createdFrom(l))}
  </div>`;
}

// Changing the status is its own action and saves straight away.
function leadSetStatus(id, status) {
  const l = DB.leads.find(x => x.id === id);
  if (!l || l.status === status || !LEAD_STATUSES.includes(status)) return;
  if (status === 'Lost') { leadsMarkLost([l], false); render(); return; }   // render puts the dropdown back until the reason is confirmed
  leadApplyStatus(l, status);
  toast(`Status set to ${status}`);
  render();
}

// Sets a status and logs it. A lost reason is kept only while the lead is Lost.
function leadApplyStatus(l, status, lost) {
  logActivity(l.id, 'status_changed', 'Status changed', `${l.status} → ${status}${lost ? `. ${lostText(lost.reason, lost.note)}` : ''}`);
  l.status = status; stamp(l, 'status');
  l.lostReason = lost ? lost.reason : ''; l.lostNote = lost ? lost.note : '';
}
function leadsMarkLost(leads, bulk) {
  const n = leads.length;
  lostOpen({
    title: n === 1 ? 'Mark lead as lost' : `Mark ${n} leads as lost`,
    intro: n === 1 ? `${leads[0].name} stays in your list as Lost. Say why, so your team can learn from it.` : `These ${n} leads stay in your list as Lost. Say why, so your team can learn from it.`,
    reasons: LEAD_LOST_REASONS,
    apply: (reason, note) => {
      leads.forEach(l => leadApplyStatus(l, 'Lost', { reason, note }));
      if (bulk) state.ui.selected = [];
      toast(n === 1 ? 'Status set to Lost' : `${leadCount(n)} changed to Lost`);
      render();
    }
  });
}

// Clicking a contact button still opens the user's app, and then logs the contact on the timeline and asks for a note.
// Contact buttons open the user's own app (phone, messages, email) or the web link for WhatsApp / Telegram.
// Phone numbers are reduced to digits, so +65 8000 1002 becomes 6580001002. A button is disabled when the lead lacks that detail.
function contactBarHTML(l) {
  const digits = l.phone.replace(/\D/g, '');
  const phone = digits.length >= 7 ? digits : '';
  const email = validEmail(l.email) ? l.email : '';
  const items = [
    { kind: 'call', key: 'callLead', label: 'Call', href: phone && `tel:+${phone}`, need: 'phone number' },
    { kind: 'sms', key: 'smsLead', label: 'SMS', href: phone && `sms:+${phone}`, need: 'phone number' },
    { kind: 'whatsapp', key: 'whatsappLead', label: 'WhatsApp', href: phone && `https://wa.me/${phone}`, need: 'phone number', web: true },
    { kind: 'telegram', key: 'telegramLead', label: 'Telegram', href: phone && `https://t.me/+${phone}`, need: 'phone number', web: true },
    { kind: 'email', key: 'emailLead', label: 'Email', href: email && `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}`, need: 'email address' }
  ];
  return `<div class="contact-bar" role="group" aria-label="Contact ${esc(l.name)}">${items.map(i => i.href
    ? `<a class="btn" href="${esc(i.href)}"${i.web ? ' target="_blank" rel="noopener noreferrer"' : ''} onclick="leadContactClicked('${i.kind}', '${l.id}')">${icon(i.key)}${i.label}</a>`
    : `<span class="btn" role="link" aria-disabled="true" title="No ${i.need} on this lead">${icon(i.key)}${i.label}</span>`).join('')}</div>`;
}

const CONTACT_LABELS = { call: 'Call', sms: 'SMS', whatsapp: 'WhatsApp', telegram: 'Telegram', email: 'Email', meeting: 'Meeting' };
// Waits a moment so the browser can finish opening the link before the page re-renders.
function leadContactClicked(kind, id) { setTimeout(() => leadContactLog(kind, id), 150); }
function leadContactLog(kind, id) {
  const l = DB.leads.find(x => x.id === id);
  if (!l || !canSeeLead(l) || !CONTACT_LABELS[kind]) return;
  const title = `${CONTACT_LABELS[kind]} logged`;
  const entry = logActivity(id, 'contact_' + kind, title, '');
  render();
  openModal(title, `
    <p class="muted" style="margin-bottom:14px">${esc(l.name)} · ${esc(kind === 'email' ? l.email : l.phone)}. This is now on the timeline.</p>
    ${fieldHTML('Note', 'contact-note', `<textarea class="textarea" id="contact-note" rows="3" maxlength="1000" placeholder="What happened? (optional)" oninput="document.getElementById('contact-save').disabled = !this.value.trim()" onkeydown="if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') leadContactSaveNote('${entry.id}')"></textarea>`)}`,
    `<button class="btn" onclick="closeModal()">Skip</button><button class="btn btn-primary" id="contact-save" onclick="leadContactSaveNote('${entry.id}')" disabled>Save note</button>`);
}
// "Add activity" in the timeline: log a note, or a call, message, email or meeting that happened outside the app.
function leadActivityOpen(id) {
  const l = DB.leads.find(x => x.id === id);
  if (!l || !canSeeLead(l)) return;
  openModal('Add activity', `
    <div class="form-grid">
      ${fieldHTML('Type', 'act-type', selectHTML('act-type', [['note', 'Note'], ...Object.entries(CONTACT_LABELS)], 'note'), 'span-2')}
      ${fieldHTML('Note', 'act-note', `<textarea class="textarea" id="act-note" rows="4" maxlength="1000" placeholder="What happened?" onkeydown="if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') leadActivitySave('${id}')"></textarea>`, 'span-2', 'Required for a note, optional for everything else.')}
    </div>
    <p class="form-error" id="act-error" role="alert"></p>`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="leadActivitySave('${id}')">Add activity</button>`);
}
function leadActivitySave(id) {
  const l = DB.leads.find(x => x.id === id), kind = val('act-type'), note = val('act-note');
  if (!l || !canSeeLead(l)) return;
  if (kind !== 'note' && !CONTACT_LABELS[kind]) return;
  if (kind === 'note' && !note) { document.getElementById('act-error').textContent = 'Write a note.'; return; }
  if (kind === 'note') logActivity(id, 'note', 'Note', note);
  else logActivity(id, 'contact_' + kind, `${CONTACT_LABELS[kind]} logged`, note);
  closeModal();
  toast(kind === 'note' ? 'Note added' : `${CONTACT_LABELS[kind]} logged`);
  render();
}

function leadContactSaveNote(entryId) {
  const entry = DB.activities.find(a => a.id === entryId), note = val('contact-note');
  if (!entry || !note) return;
  entry.detail = note;
  closeModal();
  toast('Note saved');
  render();
}

function leadEventHTML(e, tag) {
  return `<li class="tl-item">
    <span class="tl-icon">${activityIcon(e.type)}</span>
    <div>
      <div class="tl-title">${esc(e.title)}${TRACKED_TYPES.includes(e.type) ? ' <span class="pill pill-tracked">Tracked</span>' : ''}${tag ? ' ' + pill(tag) : ''}</div>
      ${e.detail ? `<div class="tl-detail${e.type === 'note' || e.type.startsWith('contact_') ? ' tl-note' : ''}">${esc(e.detail)}</div>` : ''}
      <div class="tl-meta">${fmtDateTime(e.at)}${e.by ? ` · ${esc(e.by)}` : ''}</div>
    </div>
  </li>`;
}

// A free-text notes field for anything that doesn't fit elsewhere. The box is always there: clicking it makes it active (blue outline)
// and it saves when you click away (Esc discards, Ctrl/Cmd+Enter saves). Formatting is rendered while the box is not active,
// because a textarea can only show the raw text.
const NOTES_PLACEHOLDER = 'Anything worth remembering about this lead';
function leadNotesBodyHTML(l) {
  const open = `onclick="if (!event.target.closest('a')) leadNotesOpen('${l.id}')" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); leadNotesOpen('${l.id}'); }"`;
  return `<div class="notes-text${l.notes ? '' : ' is-empty'}" tabindex="0" role="button" aria-label="Notes" ${open}>${l.notes ? mdHTML(l.notes) : NOTES_PLACEHOLDER}</div>`;
}
function leadNotesHTML(l) {
  return `<section class="card"><div class="card-head"><h2>Notes</h2></div><div id="lead-notes-body">${leadNotesBodyHTML(l)}</div></section>`;
}
function leadNotesOpen(id) {
  const l = DB.leads.find(x => x.id === id);
  document.getElementById('lead-notes-body').innerHTML = `<textarea class="textarea" id="lead-notes" maxlength="5000" aria-label="Notes" placeholder="${NOTES_PLACEHOLDER}"
      oninput="leadNotesFit(this)" onblur="leadNotesClose('${id}', true)" onkeydown="leadNotesKey(event, '${id}')">${esc(l.notes || '')}</textarea>`;
  const el = document.getElementById('lead-notes');
  leadNotesFit(el); el.focus(); el.setSelectionRange(el.value.length, el.value.length);
}
// The box grows with what is typed, so it never scrolls inside itself and opening it doesn't change its size.
function leadNotesFit(el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight + 2, 76) + 'px'; }
function leadNotesKey(e, id) {
  if (e.key === 'Escape') { e.stopPropagation(); leadNotesClose(id, false); }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') leadNotesClose(id, true);
}
// Closing never re-renders the page, so a click that made the box lose focus still lands on whatever was clicked.
function leadNotesClose(id, save) {
  const el = document.getElementById('lead-notes');
  if (!el) return;
  const l = DB.leads.find(x => x.id === id), next = el.value.trim(), changed = save && next !== (l.notes || '');
  el.onblur = null;   // taking the box out fires one more blur
  if (changed) {
    l.notes = next;
    const entry = logActivity(id, 'lead_updated', 'Notes updated', '');
    if (!state.ui.keyMoments) document.getElementById('timeline').insertAdjacentHTML('afterbegin', leadEventHTML(entry));
    document.getElementById('tl-count').textContent = timelineView(id).count;
    toast('Notes saved');
  }
  document.getElementById('lead-notes-body').innerHTML = leadNotesBodyHTML(l);
  refreshIcons();
}
function leadEdit(on) { state.ui.editing = on; render(); }

function leadSave(id) {
  const l = DB.leads.find(x => x.id === id);
  const em = contactRead('le', 'email'), ph = contactRead('le', 'phone');
  // Source, contact channel and attribution are fixed once a lead exists, so they are carried over as they are.
  const d = {
    name: val('le-name'), email: em.value, phone: ph.value, source: l.source,
    emailLabel: em.label, phoneLabel: ph.label, moreEmails: em.more, morePhones: ph.more,
    attribution: l.attribution, contactChannel: l.contactChannel
  };
  const err = leadValidate(d, id);
  if (err) { document.getElementById('le-error').textContent = err; return; }

  const labels = { name: 'name', email: 'email', phone: 'phone' };
  const changed = Object.keys(labels).filter(k => l[k] !== d[k]).map(k => labels[k]);
  const sig = (label, more) => JSON.stringify([label, more]);
  if (sig(l.emailLabel || 'Primary', l.moreEmails || []) !== sig(d.emailLabel, d.moreEmails)) changed.push('additional emails');
  if (sig(l.phoneLabel || 'Primary', l.morePhones || []) !== sig(d.phoneLabel, d.morePhones)) changed.push('additional phone numbers');
  if (changed.length) logActivity(id, 'lead_updated', 'Details edited', `Updated ${changed.join(', ')}`);
  MERGE_FIELDS.filter(f => f in d && l[f] !== d[f]).forEach(f => stamp(l, f));
  Object.assign(l, d);
  state.ui.editing = false;
  toast(duplicatesOf(l).length ? 'Lead saved. It may be a duplicate.' : 'Lead saved');
  render();
}

// Reassigning is its own action (admin only) and saves straight away.
function leadAssign(id, userId) {
  if (!isAdmin()) return;
  const l = DB.leads.find(x => x.id === id), next = userId || null;
  if (l.assigneeId === next) return;
  logActivity(id, 'assignee_changed', 'Assignee changed', `${userName(l.assigneeId)} → ${userName(next)}`);
  l.assigneeId = next; stamp(l, 'assigneeId');
  toast(next ? `Assigned to ${userName(next)}` : 'Lead unassigned');
  render();
}

