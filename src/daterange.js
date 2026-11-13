// Date range filter shared by the Leads and Deals lists: presets plus a custom From / To range.
// A filter is { preset, from, to, n }. preset '' means all time; 'custom' uses from / to (YYYY-MM-DD, either may be blank); 'lastN' covers the last n days up to today.

const DATE_PRESETS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['lastWeek', 'Last week'],
  ['month', 'This month'], ['lastMonth', 'Last month'], ['', 'All time']
];
// "Last N days up to today" is the one open-ended preset; n is kept on the filter.
const LAST_DAYS_MAX = 3650;
// Each list says which date it filters on, so the button can name it. A deal's date is when it closed, or when it was opened while it is still open.
const DATE_FILTERS = { leads: { label: 'Created', refresh: () => leadRefreshResults() }, deals: { label: 'Date', refresh: () => render() } };

const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// 'YYYY-MM-DD' as local midnight, so a deal closing "today" is today in the user's own time zone.
const dateStart = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const dateNextDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d + 1).getTime(); };

// The first and last day (inclusive, as YYYY-MM-DD) a filter covers. Either end may be '' when it is open.
function dateSpan(f) {
  if (!f.preset) return { from: '', to: '' };
  if (f.preset === 'custom') return { from: f.from, to: f.to };
  const t = new Date(), y = t.getFullYear(), m = t.getMonth(), d = t.getDate();
  const day = (yy, mm, dd) => dateKey(new Date(yy, mm, dd));
  const monday = d - ((t.getDay() + 6) % 7);   // weeks run Monday to Sunday
  switch (f.preset) {
    case 'today': return { from: day(y, m, d), to: day(y, m, d) };
    case 'yesterday': return { from: day(y, m, d - 1), to: day(y, m, d - 1) };
    case 'week': return { from: day(y, m, monday), to: day(y, m, monday + 6) };
    case 'lastWeek': return { from: day(y, m, monday - 7), to: day(y, m, monday - 1) };
    case 'month': return { from: day(y, m, 1), to: day(y, m + 1, 0) };
    case 'lastN': return { from: day(y, m, d - (f.n - 1)), to: day(y, m, d) };
    case 'lastMonth': return { from: day(y, m - 1, 1), to: day(y, m, 0) };
  }
  return { from: '', to: '' };
}

// True when a timestamp (ms) or a YYYY-MM-DD string falls inside the filter.
function dateMatch(f, v) {
  if (!f.preset) return true;
  const { from, to } = dateSpan(f);
  const t = typeof v === 'string' ? dateStart(v) : v;
  return (!from || t >= dateStart(from)) && (!to || t < dateNextDay(to));
}

const dateShort = (s, withYear) => new Date(dateStart(s)).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
function dateSummary(f) {
  if (!f.preset) return 'All time';
  if (f.preset === 'lastN') return `Last ${f.n} ${f.n === 1 ? 'day' : 'days'}`;
  if (f.preset !== 'custom') return DATE_PRESETS.find(p => p[0] === f.preset)[1];
  if (f.from && f.to) return f.from === f.to ? dateShort(f.from, true) : `${dateShort(f.from, f.from.slice(0, 4) !== f.to.slice(0, 4))} – ${dateShort(f.to, true)}`;
  return f.from ? `From ${dateShort(f.from, true)}` : `Until ${dateShort(f.to, true)}`;
}

// ---- Calendar ---------------------------------------------------------------
const monthStart = (ym, add = 0) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1 + add, 1); };
const monthKey = d => dateKey(d).slice(0, 7);
function monthHTML(ym, draft) {
  const first = monthStart(ym), lead = (first.getDay() + 6) % 7, days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const today = dateKey(new Date()), { from, to } = draft;
  let cells = '<span></span>'.repeat(lead);
  for (let d = 1; d <= days; d++) {
    const k = `${ym}-${String(d).padStart(2, '0')}`;
    const edge = k === from || k === to, inside = from && to && k > from && k < to;
    const cls = ['drp-day', edge ? 'is-edge' : '', inside ? 'is-inside' : '', k === today ? 'is-today' : '', from && to && from !== to && k === from ? 'is-start' : '', from && to && from !== to && k === to ? 'is-end' : ''].join(' ');
    cells += `<button class="${cls}" onclick="drpDay('${k}')" aria-label="${fmtDate(dateStart(k))}"${edge ? ' aria-pressed="true"' : ''}>${d}</button>`;
  }
  const head = first.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });
  return `<div class="drp-month"><div class="drp-month-title">${head}</div>
    <div class="drp-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(w => `<span class="drp-dow">${w}</span>`).join('')}${cells}</div></div>`;
}

function drpHTML(key) {
  const f = state.ui.dates[key], cfg = DATE_FILTERS[key], open = state.ui.drpOpen === key, dr = state.ui.drpDraft;
  const fieldBtn = (which, label) => `<button class="drp-field${dr.active === which ? ' is-active' : ''}" onclick="drpActive('${which}')" aria-label="${label} date"><span class="${dr[which] ? '' : 'muted'}">${dr[which] ? fmtDate(dateStart(dr[which])) : 'Select'}</span></button>`;
  return `
    <button class="btn drp-btn${f.preset ? ' is-active' : ''}" onclick="drpToggle('${key}')" aria-haspopup="dialog" aria-expanded="${open}">${icon('dateRange')}<span>${cfg.label}: ${esc(dateSummary(f))}</span></button>
    ${open ? `<div class="drp-pop" role="dialog" aria-label="Filter by ${cfg.label.toLowerCase()}">
      <div class="drp-side">
        <div class="drp-presets">${DATE_PRESETS.map(([p, label]) => `<button class="${f.preset === p ? 'is-active' : ''}" onclick="drpPreset('${key}', '${p}')">${label}</button>`).join('')}</div>
        <div class="drp-lastn${f.preset === 'lastN' ? ' is-active' : ''}"><label for="drp-n">Last</label><input class="input" type="number" id="drp-n" min="1" max="${LAST_DAYS_MAX}" step="1" value="${f.preset === 'lastN' ? f.n : 30}" onchange="drpLastN('${key}', this.value)" aria-label="Number of days"></div>
      </div>
      <div class="drp-custom">
        <div class="drp-range">
          <button class="btn btn-icon" onclick="drpMonth(-1)" aria-label="Previous month">${icon('prev')}</button>
          <div class="drp-fields">${fieldBtn('from', 'From')}<span class="drp-dash" aria-hidden="true">–</span>${fieldBtn('to', 'To')}</div>
          <button class="btn btn-icon" onclick="drpMonth(1)" aria-label="Next month">${icon('next')}</button>
        </div>
        <div class="drp-months">${monthHTML(dr.month, dr)}${monthHTML(monthKey(monthStart(dr.month, 1)), dr)}</div>
        <button class="btn btn-primary drp-apply" onclick="drpApply('${key}')"${dr.from || dr.to ? '' : ' disabled'}>Apply range</button>
      </div>
    </div>` : ''}`;
}
// The wrapper is rebuilt as a whole, so the button label and the open state never disagree.
function drpPaint(key) {
  const el = document.getElementById('drp-' + key);
  el.innerHTML = drpHTML(key);
  refreshIcons();
  const pop = el.querySelector('.drp-pop');
  if (!pop) return;
  // Keep the popover inside the window when the button sits near the right edge (phones, narrow toolbars).
  const r = pop.getBoundingClientRect(), edge = 16;
  if (r.right > innerWidth - edge) pop.style.left = (innerWidth - edge - r.right) + 'px';
  if (pop.getBoundingClientRect().left < edge) pop.style.left = (edge - el.getBoundingClientRect().left) + 'px';
}
function drpToggle(key) {
  if (state.ui.drpOpen === key) state.ui.drpOpen = '';
  else {
    // The calendar starts from the range already in force, so a preset's dates show up on it.
    const { from, to } = dateSpan(state.ui.dates[key]);
    state.ui.drpOpen = key;
    state.ui.drpDraft = { from, to, month: (from || dateKey(new Date())).slice(0, 7), active: 'from' };
  }
  drpPaint(key);
}
function drpClose() { const k = state.ui.drpOpen; if (!k) return; state.ui.drpOpen = ''; if (document.getElementById('drp-' + k)) drpPaint(k); }
function drpSet(key, f) { state.ui.dates[key] = f; state.ui.drpOpen = ''; DATE_FILTERS[key].refresh(); if (document.getElementById('drp-' + key)) drpPaint(key); }
function drpPreset(key, preset) { drpSet(key, { preset, from: '', to: '' }); }
// Whole numbers from 1 up; anything else is ignored rather than guessed at.
function drpLastN(key, v) {
  const n = Math.floor(Number(v));
  if (!(n >= 1)) return;
  drpSet(key, { preset: 'lastN', from: '', to: '', n: Math.min(n, LAST_DAYS_MAX) });
}
function drpActive(which) { state.ui.drpDraft.active = which; drpPaint(state.ui.drpOpen); }
function drpMonth(n) { const dr = state.ui.drpDraft; dr.month = monthKey(monthStart(dr.month, n)); drpPaint(state.ui.drpOpen); }
// First click sets the start, second sets the end. A day before the start restarts the range, so the two can never cross.
function drpDay(k) {
  const dr = state.ui.drpDraft;
  if (dr.active === 'from') { dr.from = k; if (dr.to && dr.to < k) dr.to = ''; dr.active = 'to'; }
  else if (dr.from && k < dr.from) { dr.from = k; dr.to = ''; }
  else { dr.to = k; if (!dr.from) { dr.active = 'from'; } }
  drpPaint(state.ui.drpOpen);
}
function drpApply(key) {
  const { from, to } = state.ui.drpDraft;
  if (from || to) drpSet(key, { preset: 'custom', from, to });
}

document.addEventListener('mousedown', e => { if (state.ui.drpOpen && !e.target.closest('.drp')) drpClose(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') drpClose(); });
