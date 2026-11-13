// State, role scoping, routing, formatting, modal and toast.

/* Icon registry — one icon, one meaning. Check this list before using an icon anywhere new;
   if the meaning is different, add a new entry instead of reusing one.
     users               Leads (nav)
     target              Deal (nav, and "deal added" in the timeline)
     user-cog            Users & roles (nav)
     plus                Add a new record
     pencil              Edit (buttons, and "details edited" in the timeline)
     x                   Close a dialog
     trash-2             Delete (leads, and removing an additional email or phone number)
     triangle-alert      Warning (possible duplicate lead)
     git-merge           Merge duplicate leads (button, and "leads merged" in the timeline)
     inbox               Simulate an incoming lead (prototype toolbar)
     arrow-left          Back to the list
     search              Search a list
     rotate-ccw          Reset prototype data
     mouse-pointer-click Paid ad click
     globe               Visit from organic search
     link                Visit from a referral link
     mail-open           Visit from an email link
     corner-down-right   Direct visit
     panel-top           Page view
     message-circle      Conversation started
     user-plus           Lead created
     sticky-note         Note
     refresh-cw          Status changed
     user-check          Assignee changed
     phone               Call a lead (button, and "call logged" in the timeline)
     message-square-text Text (SMS) a lead (button, and "SMS logged" in the timeline)
     messages-square     Message a lead on WhatsApp (button, and "WhatsApp logged" in the timeline)
     send                Message a lead on Telegram (button, and "Telegram logged" in the timeline)
     mail                Email a lead (button, and "email logged" in the timeline)
     calendar            A meeting with a lead ("meeting logged" in the timeline)
     calendar-range      Filter a list by date range
     route               Customer journey summary
     eye                 View only the key moments in a timeline (first touch, last touch, converted)
     hand                A touch recorded by hand (walk-in, event, referral, phone enquiry)
     chevron-down        Show or hide the pages browsed in a journey
     chevron-left        Previous month (date picker)
     chevron-right       Next month (date picker)
     trophy              Deal won
     circle-x            Deal lost */
const ICONS = {
  navLeads: 'users', opp: 'target', navUsers: 'user-cog',
  add: 'plus', del: 'trash-2', warn: 'triangle-alert', merge: 'git-merge', inbox: 'inbox', merged: 'git-merge', edit: 'pencil', close: 'x', back: 'arrow-left', search: 'search', reset: 'rotate-ccw',
  ad_click: 'mouse-pointer-click', search_visit: 'globe', referral: 'link', email_click: 'mail-open', direct: 'corner-down-right',
  page_view: 'panel-top', conversation_started: 'message-circle', lead_created: 'user-plus', note: 'sticky-note',
  status_changed: 'refresh-cw', assignee_changed: 'user-check', lead_updated: 'pencil',
  callLead: 'phone', smsLead: 'message-square-text', whatsappLead: 'messages-square', telegramLead: 'send', emailLead: 'mail',
  contact_call: 'phone', contact_sms: 'message-square-text', contact_whatsapp: 'messages-square', contact_telegram: 'send', contact_email: 'mail', contact_meeting: 'calendar', dateRange: 'calendar-range', prev: 'chevron-left', journey: 'route', focus: 'eye', recorded: 'hand', expand: 'chevron-down', next: 'chevron-right',
  opp_created: 'target', opp_won: 'trophy', opp_lost: 'circle-x'
};
// Activity types that come from click tracking rather than from a user.
const TRACKED_TYPES = ['ad_click', 'search', 'referral', 'email_click', 'direct', 'page_view'];

let DB = seedData();
const state = {
  userId: 'u1',
  ui: { q: '', status: '', source: '', assignee: '', oppStatus: '', dates: { leads: { preset: '', from: '', to: '' }, deals: { preset: '', from: '', to: '' } }, drpOpen: '', keyMoments: false, journeyOpen: [], drpDraft: { from: '', to: '', month: '', active: 'from' }, editing: false, selected: [] }
};

function icon(key) { return `<i data-lucide="${ICONS[key]}" aria-hidden="true"></i>`; }
function activityIcon(type) { return icon(type === 'search' ? 'search_visit' : type); }
function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

// Renders the small subset of Markdown the notes field supports: **bold**, *italic*, ~~strike~~, `code`, # headings,
// "- " / "* " bullets and "1. " numbered lists (indent two spaces to nest), and http(s) links. Everything is HTML-escaped first
// and only the tags produced here are ever added, so nothing a person types can run as markup or script.
function mdInline(raw) {
  const codes = [];
  let s = esc(raw).replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^*])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1<em>$2</em>')
       .replace(/~~([^~\n]+?)~~/g, '<del>$1</del>')
       .replace(/\bhttps?:\/\/[^\s<]+/g, u => { const tail = (u.match(/[.,;:!?)]+$/) || [''])[0], url = u.slice(0, u.length - tail.length); return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${tail}`; });
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}
function mdHTML(text) {
  const out = [], stack = [];   // stack of open lists: { tag, indent }
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${para.map(mdInline).join('<br>')}</p>`); para = []; } };
  const closeTo = indent => { while (stack.length && stack[stack.length - 1].indent >= indent) out.push(`</li></${stack.pop().tag}>`); };
  String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach(line => {
    const item = line.match(/^(\s*)([-*\u2022]|\d+[.)])\s+(.*)$/), head = line.match(/^#{1,3}\s+(.*)$/);
    if (item) {
      flush();
      const indent = item[1].replace(/\t/g, '  ').length, tag = /\d/.test(item[2]) ? 'ol' : 'ul';
      while (stack.length && stack[stack.length - 1].indent > indent) out.push(`</li></${stack.pop().tag}>`);
      const top = stack[stack.length - 1];
      if (top && top.indent === indent && top.tag === tag) out.push('</li><li>');
      else {
        if (top && top.indent === indent) out.push(`</li></${stack.pop().tag}>`);   // same level, different list type
        stack.push({ tag, indent }); out.push(`<${tag}><li>`);
      }
      out.push(mdInline(item[3]));
    } else if (!line.trim()) { flush(); closeTo(0); }
    else if (head) { flush(); closeTo(0); out.push(`<p class="md-h">${mdInline(head[1])}</p>`); }
    else if (stack.length && /^\s+/.test(line)) out.push('<br>' + mdInline(line.trim()));   // a wrapped line inside a list item
    else { closeTo(0); para.push(line); }
  });
  flush(); closeTo(0);
  return out.join('');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtMoney(n) { return 'S$' + Number(n || 0).toLocaleString('en-SG', { maximumFractionDigits: 0 }); }
function fmtDate(v) { return v ? new Date(v).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function fmtDateTime(v) { return new Date(v).toLocaleString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
function pill(label) { return `<span class="pill pill-${slug(label)}">${esc(label)}</span>`; }
function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

// ---- Users and role scoping -------------------------------------------------
function me() { return DB.users.find(u => u.id === state.userId); }
function isAdmin() { return me().role === 'admin'; }
function userName(id) { const u = DB.users.find(x => x.id === id); return u ? u.name : 'Unassigned'; }

// Every screen and total reads leads and deals through these two functions,
// so a basic user never sees anything that is not assigned to them.
function canSeeLead(l) { return isAdmin() || l.assigneeId === state.userId; }
function visibleLeads() { return DB.leads.filter(canSeeLead); }
function visibleOpps() { const ids = new Set(visibleLeads().map(l => l.id)); return DB.opps.filter(o => ids.has(o.leadId)); }

// Lifetime value is never stored: it is the sum of the lead's Won deals.
function ltvMap() {
  const m = {};
  DB.opps.forEach(o => { if (o.status === 'Won') m[o.leadId] = (m[o.leadId] || 0) + o.value; });
  return m;
}
function leadLtv(id) { return ltvMap()[id] || 0; }

// Matching keys for spotting the same person. Email ignores case; phone compares the last 8 digits, so
// "+65 8000 1002", "6580001002" and "80001002" are the same number.
function emailKey(e) { return String(e || '').trim().toLowerCase(); }
// Every email and phone number a lead has: the primary first, then any additional ones.
// Additional ones are { label, value } entries; the primary's title is emailLabel / phoneLabel. People can rename every title.
const emailsOf = l => [l.email, ...(l.moreEmails || []).map(x => x.value)].filter(Boolean);
const phonesOf = l => [l.phone, ...(l.morePhones || []).map(x => x.value)].filter(Boolean);
const CONTACT_LABELS_DEFAULT = ['Primary', 'Secondary', 'Tertiary'];
const defaultContactLabel = i => CONTACT_LABELS_DEFAULT[i] || 'Other';
function phoneKey(p) { const d = String(p || '').replace(/\D/g, ''); return d.length >= 8 ? d.slice(-8) : ''; }
// Marks a field as just updated, which is what a merge uses to decide which value is the latest.
function stamp(l, field) { (l.fieldUpdated = l.fieldUpdated || {})[field] = Date.now(); }

function logActivity(leadId, type, title, detail, meta) {
  const entry = { id: 'a' + (++DB.seq), seq: DB.seq, leadId, at: Date.now(), type, title, detail: detail || '', by: me().name, meta: meta || null };
  DB.activities.push(entry);
  return entry;
}

// ---- Form helpers -----------------------------------------------------------
function selectHTML(id, options, value, attrs = '') {
  const opts = options.map(o => { const [v, label] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(value == null ? '' : value) ? ' selected' : ''}>${esc(label)}</option>`; }).join('');
  return `<select class="select" id="${id}" ${attrs}>${opts}</select>`;
}
function fieldHTML(label, id, control, cls = '', hint = '', required = false) {
  return `<div class="field ${cls}" data-field="${id}"><label class="field-label" for="${id}">${esc(label)}${required ? '<span class="field-req">Required</span>' : ''}</label>${control}${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}</div>`;
}
function inputHTML(id, value, attrs = '') { return `<input class="input" id="${id}" value="${esc(value)}" ${attrs}>`; }
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function assigneeOptions() { return [['', 'Unassigned'], ...DB.users.map(u => [u.id, u.name])]; }

// ---- Modal and toast --------------------------------------------------------
function openModal(title, body, foot, cls = '') {
  document.getElementById('modal-root').innerHTML = `
    <div class="modal-backdrop" onmousedown="if (event.target === this) closeModal()">
      <div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><h2>${esc(title)}</h2><button class="btn btn-icon" onclick="closeModal()" aria-label="Close">${icon('close')}</button></div>
        ${body}
        <div class="modal-foot">${foot}</div>
      </div>
    </div>`;
  refreshIcons();
  const first = document.querySelector('.modal input, .modal select');
  if (first) first.focus();
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

// ---- Routing ----------------------------------------------------------------
function navigate(hash) { if (location.hash === hash) render(); else location.hash = hash; }

function render() {
  const [, page = 'leads', id] = location.hash.replace(/^#/, '').split('/');
  let html;
  if (page === 'leads' && id) html = leadDetailPage(id);
  else if (page === 'deals') html = oppsPage();
  else if (page === 'users') html = usersPage();
  else html = leadsPage();
  // A page returns null when the current user may not open it; it has already redirected.
  if (html == null) return;
  document.getElementById('rail').innerHTML = railHTML(page);
  document.getElementById('view').innerHTML = html;
  document.getElementById('devbar').innerHTML = devbarHTML();
  refreshIcons();
  leadSyncSelectAll();
}

function railHTML(page) {
  const link = (p, key, label) => `<a class="rail-link${page === p ? ' is-active' : ''}" href="#/${p}"${page === p ? ' aria-current="page"' : ''}>${icon(key)}<span>${label}</span></a>`;
  return `
    <div class="rail-org"><strong>CRM Lite</strong><span>${esc(ORG_NAME)}</span></div>
    ${link('leads', 'navLeads', 'Leads')}
    ${link('deals', 'opp', 'Deals')}
    ${isAdmin() ? link('users', 'navUsers', 'Users') : ''}
    <div class="rail-me"><strong>${esc(me().name)}</strong><span>${isAdmin() ? 'Admin · All leads' : 'Basic user · Own leads'}</span></div>`;
}
