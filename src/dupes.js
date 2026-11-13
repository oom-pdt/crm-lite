// Duplicate handling: matching incoming leads to existing ones, spotting duplicates later, and merging them.

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---- Matching ---------------------------------------------------------------
// Two leads are the same person when they share an email (ignoring case) or a phone number (last 8 digits).
// Any of a lead's emails or phone numbers can match, not just the primary ones.
const shareKey = (x, y) => x.some(k => k && y.includes(k));
function matchReason(a, b) {
  const e = shareKey(emailsOf(a).map(emailKey), emailsOf(b).map(emailKey));
  const p = shareKey(phonesOf(a).map(phoneKey), phonesOf(b).map(phoneKey));
  return e && p ? 'email and phone number' : e ? 'email' : p ? 'phone number' : '';
}
// Other leads the current user can see that look like the same person.
function duplicatesOf(l) { return visibleLeads().filter(x => x.id !== l.id && matchReason(l, x)); }
// Lead ids that have a possible duplicate, for flagging them in the list.
function dupMap() {
  const byKey = {}, flagged = {};
  visibleLeads().forEach(l => new Set([...emailsOf(l).map(e => `e${emailKey(e)}`), ...phonesOf(l).map(p => `p${phoneKey(p)}`)]).forEach(k => { if (k.length > 1) (byKey[k] = byKey[k] || []).push(l.id); }));
  Object.values(byKey).forEach(ids => { if (ids.length > 1) ids.forEach(id => { flagged[id] = true; }); });
  return flagged;
}

// Everyone linked to this lead through a shared email or phone number, directly or through another duplicate.
function dupGroup(l) {
  const vis = visibleLeads(), seen = new Set([l.id]), queue = [l];
  while (queue.length) { const cur = queue.shift(); vis.forEach(x => { if (!seen.has(x.id) && matchReason(cur, x)) { seen.add(x.id); queue.push(x); } }); }
  return vis.filter(x => seen.has(x.id)).sort((a, b) => a.createdAt - b.createdAt);
}

function dupBannerHTML(l) {
  const ds = duplicatesOf(l);
  if (!ds.length) return '';
  const group = dupGroup(l);
  return `<div class="notice" role="alert">${icon('warn')}<div><strong>Possible duplicate${ds.length > 1 ? 's' : ''}</strong>
    ${ds.map(d => `<div class="notice-row"><span><a href="#/leads/${d.id}">${esc(d.name)}</a> has the same ${matchReason(l, d)}.</span><button class="btn" onclick="mergeOpen('${l.id},${d.id}')">${icon('merge')}Merge</button></div>`).join('')}
    ${group.length > ds.length + 1 ? `<div class="notice-row"><span>${group.length} leads are linked by shared details.</span><button class="btn" onclick="mergeOpen('${group.map(g => g.id).join(',')}')">${icon('merge')}Merge all ${group.length}</button></div>` : ''}
  </div></div>`;
}

// ---- Merging ----------------------------------------------------------------
// Any number of leads (2 or more). The earliest-created lead is kept and the rest are folded into it.
// For each field the dialog proposes the most recently updated value, and the person can pick a different one.
const MERGE_LABELS = { name: 'Name', email: 'Email', phone: 'Phone', status: 'Status', assigneeId: 'Assignee' };
const mergeShow = (f, v) => f === 'assigneeId' ? (v ? userName(v) : 'Unassigned') : (v || '—');
const fieldStamp = (l, f) => (l.fieldUpdated && l.fieldUpdated[f]) || l.createdAt;
const isEmpty = v => v == null || v === '';

// Default choice per field: the latest updated value. An empty value never beats a filled one; ties go to the earlier lead.
function mergePlan(leads) {
  const sorted = leads.slice().sort((a, b) => a.createdAt - b.createdAt);
  const choice = {};
  MERGE_FIELDS.forEach(f => {
    const filled = sorted.filter(l => !isEmpty(l[f]));
    choice[f] = (filled.length ? filled : sorted).reduce((a, b) => fieldStamp(b, f) > fieldStamp(a, f) ? b : a).id;
  });
  return { sorted, survivor: sorted[0], others: sorted.slice(1), choice };
}
// What a field's dropdown offers: each distinct filled value once. The dropdown starts on the latest value; people can pick another.
function mergeOptions(plan, f) {
  const same = v => f === 'email' ? String(v).toLowerCase() : String(v);   // emails that differ only by case are one value
  const byValue = new Map();
  plan.sorted.forEach(l => { if (!isEmpty(l[f])) { const k = same(mergeShow(f, l[f])); if (!byValue.has(k) || l.id === plan.choice[f]) byValue.set(k, l); } });
  return [...byValue.values()].map(l => [l.id, mergeShow(f, l[f])]);
}
function mergeLeads(csv) {
  const leads = String(csv).split(',').map(id => DB.leads.find(x => x.id === id));
  return leads.length >= 2 && leads.every(l => l && canSeeLead(l)) && new Set(leads).size === leads.length ? leads : null;
}

function mergeOpen(csv) {
  const leads = mergeLeads(csv);
  if (!leads) return;
  const plan = mergePlan(leads), ids = new Set(leads.map(l => l.id));
  const acts = DB.activities.filter(x => ids.has(x.leadId)).length, opps = DB.opps.filter(o => ids.has(o.leadId)).length;
  const row = f => {
    const opts = mergeOptions(plan, f);
    const after = opts.length > 1 ? selectHTML('mg-' + f, opts, plan.choice[f], `aria-label="After merge: ${MERGE_LABELS[f]}"`) : `<div class="value-pill">${esc(mergeShow(f, plan.sorted.find(l => l.id === plan.choice[f])[f]))}</div>`;
    return `<tr><th scope="row">${MERGE_LABELS[f]}</th>${plan.sorted.map(l => `<td data-label="${esc(l.name)}">${esc(mergeShow(f, l[f]))}</td>`).join('')}<td class="after" data-label="After merge">${after}</td></tr>`;
  };
  openModal(`Merge ${leads.length} leads`, `
    <p>The timelines are combined into one lead (${plural(acts, 'activity', 'activities')} and ${plural(opps, 'deal', 'deals')} in total). For each field the most recently updated value is selected, and you can choose a different one.</p>
    <div class="table-wrap" style="margin-top:12px"><table class="merge-table">
      <thead><tr><th></th>${plan.sorted.map(l => `<th>${esc(l.name)}<div class="cell-sub">Created ${fmtDate(l.createdAt)}</div></th>`).join('')}<th>After merge</th></tr></thead>
      <tbody>${MERGE_FIELDS.map(row).join('')}</tbody>
    </table></div>
    <p class="muted" style="margin-top:12px">${esc(plan.survivor.name)} (the earliest lead) is kept. Source and first-touch details come from it. Any other emails and phone numbers are kept as additional ones, and notes are combined. This can't be undone.</p>`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="mergeDo('${[...ids].join(',')}')">${icon('merge')}Merge ${leads.length} leads</button>`, 'wide');
}

const uniqueBy = (arr, key) => { const seen = new Set(); return arr.filter(v => { const k = key(v); if (seen.has(k)) return false; seen.add(k); return true; }); };
function mergeDo(csv) {
  const leads = mergeLeads(csv);
  if (!leads) return;
  const plan = mergePlan(leads), choice = { ...plan.choice };
  // Use what the person picked in the dropdowns; fall back to the proposed value where there was no dropdown.
  MERGE_FIELDS.forEach(f => { const el = document.getElementById('mg-' + f); if (el && leads.some(l => l.id === el.value)) choice[f] = el.value; });
  const picks = {}, stamps = {};
  MERGE_FIELDS.forEach(f => { const src = leads.find(l => l.id === choice[f]); picks[f] = src[f]; stamps[f] = fieldStamp(src, f); });
  const { survivor, others } = plan, gone = new Set(others.map(l => l.id));
  const acts = DB.activities.filter(x => gone.has(x.leadId)), opps = DB.opps.filter(o => gone.has(o.leadId));
  acts.forEach(x => { x.leadId = survivor.id; });
  opps.forEach(o => { o.leadId = survivor.id; });
  // Nothing is lost: every other email and phone number from the merged leads is kept as an additional one.
  // A demoted primary becomes "Secondary"; additional ones keep the titles people gave them.
  const entries = field => leads.flatMap(l => [{ label: 'Secondary', value: l[field], primary: true }, ...(l[field === 'email' ? 'moreEmails' : 'morePhones'] || [])]).filter(x => x.value);
  const allEmails = entries('email'), allPhones = entries('phone');
  const chosen = f => leads.find(l => l.id === choice[f]);
  MERGE_FIELDS.forEach(f => { survivor[f] = picks[f]; });
  survivor.lostReason = survivor.status === 'Lost' ? chosen('status').lostReason || '' : ''; survivor.lostNote = survivor.status === 'Lost' ? chosen('status').lostNote || '' : '';
  survivor.emailLabel = chosen('email').emailLabel || 'Primary'; survivor.phoneLabel = chosen('phone').phoneLabel || 'Primary';
  survivor.moreEmails = uniqueBy(allEmails.filter(x => emailKey(x.value) !== emailKey(survivor.email)).map(x => ({ label: x.label, value: x.value.toLowerCase() })), x => emailKey(x.value));
  survivor.morePhones = uniqueBy(allPhones.filter(x => x.value !== survivor.phone && !(phoneKey(x.value) && phoneKey(x.value) === phoneKey(survivor.phone))).map(x => ({ label: x.label, value: x.value })), x => phoneKey(x.value) || x.value);
  // Notes are never dropped: the survivor's come first, then each other lead's that isn't already in them.
  survivor.notes = uniqueBy(leads.map(l => (l.notes || '').trim()).filter(Boolean), x => x).join('\n\n');
  survivor.fieldUpdated = { ...stamps };
  if (others.some(l => l.origin === 'tracked')) survivor.origin = 'tracked';   // a lead that came from tracking stays system-created
  DB.leads = DB.leads.filter(x => !gone.has(x.id));
  state.ui.selected = state.ui.selected.filter(id => !gone.has(id));
  logActivity(survivor.id, 'merged', 'Leads merged', `Merged with ${others.map(l => `${l.name} (${l.id})`).join(', ')}. Combined ${plural(acts.length, 'activity', 'activities')} and ${plural(opps.length, 'deal', 'deals')}.`);
  closeModal();
  toast(`${leads.length} leads merged`);
  navigate('#/leads/' + survivor.id);
}

// ---- Incoming leads ---------------------------------------------------------
// A real build would receive these from click tracking and the chat, form and call integrations.
// Here the prototype toolbar simulates one, so the matching rules can be tried.

function trackedClicks(source, a) {
  const out = [];
  const visit = visitMeta(source, a);
  if (source === 'Google Ads' || source === 'Meta Ads') out.push(['ad_click', `Clicked ${source} ad`, [a.campaign, a.ad, a.keyword && `“${a.keyword}”`].filter(Boolean).join(' · '), visit]);
  else if (source === 'Organic Search') out.push(['search', 'Arrived from organic search', a.keyword ? `Searched “${a.keyword}”` : '', visit]);
  else if (source === 'Referral') out.push(['referral', 'Arrived from a referral link', a.referrer || '', visit]);
  else if (source === 'Email') out.push(['email_click', 'Clicked an email link', a.campaign || '', visit]);
  else out.push(['direct', 'Visited the site directly', '', visit]);
  if (a.landingPage) out.push(['page_view', 'Viewed page', a.landingPage, { landing: true }]);
  return out;
}

// Adds a new lead, or, when the email or phone number already belongs to a lead, adds the activity to that lead's timeline.
// Matching runs over every lead in the organisation, whoever is looking at the screen.
function receiveLead(p) {
  const email = emailKey(p.email), phone = phoneKey(p.phone);
  const match = (email && DB.leads.find(l => emailsOf(l).some(e => emailKey(e) === email))) || (phone && DB.leads.find(l => phonesOf(l).some(x => phoneKey(x) === phone))) || null;
  const now = Date.now(), MIN = 6e4;
  const add = (leadId, at, type, title, detail, meta) => DB.activities.push({ id: 'a' + (++DB.seq), seq: DB.seq, leadId, at, type, title, detail: detail || '', by: null, meta: meta || null });
  const attribution = Object.fromEntries(ATTR_FIELDS.map(f => [f.key, p.attribution ? (p.attribution[f.key] || '') : '']));
  let lead = match, matchBy = '', filled = [];

  if (!match) {
    const id = 'L' + (1001 + DB.leads.length) + '-' + (++DB.seq);
    lead = { id, name: p.name || 'Unknown', email: email, phone: p.phone || '', notes: '', emailLabel: 'Primary', phoneLabel: 'Primary', moreEmails: [], morePhones: [], status: 'New', source: p.source, attribution, contactChannel: p.channel, createdAt: now, assigneeId: null, origin: 'tracked', fieldUpdated: Object.fromEntries(MERGE_FIELDS.map(f => [f, now])) };
    DB.leads.push(lead);
  } else {
    const byEmail = email && emailsOf(match).some(e => emailKey(e) === email), byPhone = phone && phonesOf(match).some(x => phoneKey(x) === phone);
    matchBy = byEmail && byPhone ? 'email and phone number' : byEmail ? 'email' : 'phone number';
    // Only fill gaps; never overwrite what the lead already has.
    if (!match.email && email) { match.email = email; stamp(match, 'email'); filled.push('email'); }
    if (!match.phone && p.phone) { match.phone = p.phone; stamp(match, 'phone'); filled.push('phone number'); }
    // A different email or number from the same person is kept as an additional one.
    if (email && !emailsOf(match).some(e => emailKey(e) === email)) { match.moreEmails = [...(match.moreEmails || []), { label: 'Secondary', value: email }]; filled.push('additional email'); }
    if (p.phone && !phonesOf(match).some(x => x === p.phone || (phoneKey(x) && phoneKey(x) === phoneKey(p.phone)))) { match.morePhones = [...(match.morePhones || []), { label: 'Secondary', value: p.phone }]; filled.push('additional phone number'); }
  }

  trackedClicks(p.source, attribution).forEach(([type, title, detail, meta], i, all) => add(lead.id, now - (all.length - i + 1) * MIN, type, title, detail, meta));
  if (match) {
    add(lead.id, now - MIN, 'conversation_started', `Contacted again via ${p.channel}`, `Matched to this lead by ${matchBy}, so no new lead was created.`, { channel: p.channel });
    if (filled.length) add(lead.id, now, 'lead_updated', 'Details updated', `Added ${filled.join(' and ')} from the new submission.`);
  } else {
    add(lead.id, now - MIN, 'conversation_started', `Started a conversation via ${p.channel}`, 'Earlier tracked clicks were matched to this contact.', { channel: p.channel });
    add(lead.id, now, 'lead_created', 'Lead created automatically', `Identified by ${email ? 'email' : 'phone number'}`);
  }
  return { lead, created: !match, matchBy, filled };
}

function intakeOpen() {
  openModal('Simulate incoming lead', `
    <p class="muted" style="margin-bottom:14px">Prototype only. This stands in for a form, call or chat arriving from tracking. If the email or phone number matches an existing lead, the activity is added to that lead's timeline instead of creating a new lead.</p>
    <div class="form-grid">
      ${fieldHTML('Name', 'in-name', inputHTML('in-name', ''), 'span-2')}
      ${fieldHTML('Email', 'in-email', inputHTML('in-email', '', 'type="email"'))}
      ${fieldHTML('Phone', 'in-phone', inputHTML('in-phone', '', 'type="tel"'))}
      ${fieldHTML('Source', 'in-source', selectHTML('in-source', TRACKED_SOURCES, 'Google Ads', `onchange="attrToggle('in', this.value)"`))}
      ${fieldHTML('Contacted us via', 'in-channel', selectHTML('in-channel', CONTACT_CHANNELS.filter(c => c !== 'In person'), 'Web form'))}
      ${attrFieldsHTML('in', 'Google Ads', {})}
    </div>
    <p class="form-error" id="in-error" role="alert"></p>`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="intakeSubmit()">Receive lead</button>`);
}

function intakeSubmit() {
  const source = val('in-source'), email = val('in-email'), phone = val('in-phone');
  const err = !email && !phone ? 'Enter an email or a phone number.' : email && !validEmail(email) ? 'Enter a valid email address.' : '';
  if (err) { document.getElementById('in-error').textContent = err; return; }
  const r = receiveLead({ name: val('in-name'), email, phone, source, channel: val('in-channel'), attribution: attrRead('in', source) });
  closeModal();
  toast(r.created ? 'New lead created' : `Added to ${r.lead.name}'s timeline, matched by ${r.matchBy}`);
  if (canSeeLead(r.lead)) navigate('#/leads/' + r.lead.id); else render();
}
