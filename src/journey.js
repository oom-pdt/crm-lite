// Customer journey: the tracked visits and clicks that led up to the first conversation, shown as touchpoints.

const TOUCH_TYPES = ['ad_click', 'search', 'referral', 'email_click', 'direct', 'recorded'];
const TOUCH_FALLBACK = { recorded: 'Recorded by hand', ad_click: 'Ad click', search: 'Organic Search', referral: 'Referral', email_click: 'Email', direct: 'Direct' };
// How the first conversation reads in the summary line, by the channel the person used.
const CHANNEL_VERB = { 'WhatsApp': 'Messaged', 'Live chat': 'Messaged', 'Phone call': 'Called', 'Web form': 'Submitted a form', 'Email': 'Emailed' };

// Groups a lead's tracked events, oldest first, into touchpoints, runs of browsed pages, and conversations.
// A landing page is already shown on its touchpoint, so it is not counted again as a browsed page.
function journeyOf(leadId) {
  const steps = trackedSteps(leadId), l = DB.leads.find(x => x.id === leadId);
  // A lead with no tracked visit but a recorded origin (Walk-in, Event, Personal referral, Phone enquiry) has that origin as its one touch,
  // dated when the lead was added. Tracked touches always win; a recorded one is only a stand-in.
  if (l && !steps.some(s => s.kind === 'touch') && MANUAL_SOURCES.includes(l.source)) {
    const by = (DB.activities.find(a => a.leadId === leadId && a.type === 'lead_created') || {}).by || '';
    steps.unshift({ kind: 'touch', e: { id: 'rec-' + leadId, seq: 0, leadId, at: l.createdAt, type: 'recorded', title: l.source, detail: '', by: null, meta: { label: l.source, detail: l.attribution.sourceDetail || '', recordedBy: by } } });
  }
  return steps;
}
function trackedSteps(leadId) {
  const events = DB.activities.filter(e => e.leadId === leadId && (TRACKED_TYPES.includes(e.type) || e.type === 'conversation_started')).sort((a, b) => a.at - b.at || a.seq - b.seq);
  const steps = [];
  events.forEach(e => {
    if (TOUCH_TYPES.includes(e.type)) steps.push({ kind: 'touch', e });
    else if (e.type === 'conversation_started') steps.push({ kind: 'convo', e });
    else if (!(e.meta && e.meta.landing)) {
      const last = steps[steps.length - 1];
      if (last && last.kind === 'pages') last.list.push(e); else steps.push({ kind: 'pages', list: [e] });
    }
  });
  return steps;
}
const touchLabel = e => (e.meta && e.meta.label) || TOUCH_FALLBACK[e.type];

// First touch is the earliest visit. Last touch only exists once the lead has a deal: it is the latest visit before the first deal
// was made. A visit after that is never the last touch, and with no deal there is no last touch at all (`last` is null).
// Direct visits are skipped for last touch when an earlier visit by another channel exists. A recorded origin counts as a touch only when there are no tracked ones.
function journeyEnds(steps, leadId) {
  const touches = steps.filter(s => s.kind === 'touch').map(s => s.e);
  const deals = DB.opps.filter(o => o.leadId === leadId);
  const before = deals.length ? touches.filter(e => e.at <= Math.min(...deals.map(o => o.createdAt))) : [];
  // Last non-direct: a direct visit is usually someone returning, so it only takes the label when nothing else came before the deal.
  const pick = [...before].reverse().find(e => e.type !== 'direct') || before[before.length - 1] || null;
  return { touches, first: touches[0], last: pick };
}

function journeySummary(steps, leadId) {
  const { touches, first, last } = journeyEnds(steps, leadId), convo = steps.find(s => s.kind === 'convo');
  const headline = !last ? `First touch ${touchLabel(first)}.` : last === first ? `First and last touch ${touchLabel(first)}.` : `First touch ${touchLabel(first)}. Converted on ${touchLabel(last)}.`;
  const ads = touches.filter(e => e.type === 'ad_click').length, pages = steps.filter(s => s.kind === 'pages').reduce((n, s) => n + s.list.length, 0);
  const parts = [];
  if (first.type === 'recorded') parts.push('Recorded by hand');
  if (ads) parts.push(`Clicked ${plural(ads, 'ad', 'ads')}`);
  if (pages) parts.push(`Browsed ${plural(pages, 'page', 'pages')}`);
  if (convo) {
    const days = Math.floor((convo.e.at - first.at) / 864e5), channel = convo.e.meta && convo.e.meta.channel;
    parts.push(`${CHANNEL_VERB[channel] || 'Got in touch'} ${days < 1 ? 'the same day' : days + (days === 1 ? ' day later' : ' days later')}`);
  }
  return { headline, line: parts.join(' · ') };
}

// What the timeline shows: everything, or only the key moments when the summary has been clicked.
function timelineView(leadId) {
  const all = timelineOf(leadId), shown = state.ui.keyMoments ? all.filter(x => x.key) : all;
  return { html: shown.map(x => x.html).join(''), count: state.ui.keyMoments ? `${shown.length} of ${plural(all.length, 'activity', 'activities')} · Key moments only` : `${plural(all.length, 'activity', 'activities')} · Newest first` };
}
function journeyFocus(leadId) {
  state.ui.keyMoments = !state.ui.keyMoments;
  const v = timelineView(leadId);
  document.getElementById('timeline').innerHTML = v.html;
  document.getElementById('tl-count').textContent = v.count;
  document.getElementById('j-sum').outerHTML = journeySummaryHTML(leadId);
  refreshIcons();
}
function journeyToggle(leadId, gid) {
  const o = state.ui.journeyOpen, i = o.indexOf(gid);
  if (i < 0) o.push(gid); else o.splice(i, 1);
  document.getElementById('timeline').innerHTML = timelineView(leadId).html;
  refreshIcons();
}

// ---- Timeline entries for tracked visits --------------------------------------
// Tracked visits are drawn as a dot on the timeline line with a tinted card beside it, not as an icon circle.
function touchItemHTML(e, tag) {
  const m = e.meta || {};
  const pairs = [['Referred by', m.referrer], ['Landing page', m.landingPage], ['Campaign', m.campaign], ['Ad', m.ad], [e.type === 'search' ? 'Search term' : 'Keyword', m.keyword], ['Medium', m.medium], ['Source', m.source], ['Click ID', m.clickId], ['Details', m.detail], ['Recorded by', m.recordedBy]].filter(p => p[1]);
  return `<li class="tl-item is-journey"><span class="tl-dot"></span><div><div class="j-card">
    <div class="j-head">${activityIcon(e.type)}<span>${esc(touchLabel(e))}</span>${tag ? pill(tag) : ''}</div>
    <div class="tl-meta">${fmtDateTime(e.at)}</div>
    ${pairs.length ? `<dl class="kv j-kv">${pairs.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : e.detail ? `<div class="tl-detail">${esc(e.detail)}</div>` : ''}
  </div></div></li>`;
}
function pagesItemHTML(leadId, list) {
  const gid = list[0].id, open = state.ui.journeyOpen.includes(gid);
  return `<li class="tl-item is-journey is-pages"><span class="tl-dot"></span><div>
    <button class="j-toggle${open ? ' is-open' : ''}" onclick="journeyToggle('${leadId}', '${gid}')" aria-expanded="${open}">${icon('page_view')}<span>Browsed ${plural(list.length, 'page', 'pages')}</span>${icon('expand')}</button>
    ${open ? `<ul class="j-pages">${list.map(e => `<li><span>${esc(e.detail)}</span><span class="tl-meta">${fmtDateTime(e.at)}</span></li>`).join('')}</ul>` : ''}
  </div></li>`;
}

// The entry for the conversion: the first deal made for the lead (the same moment last touch is measured against).
function convertedEvent(leadId) {
  const first = DB.opps.filter(o => o.leadId === leadId).sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!first) return null;
  const made = DB.activities.filter(a => a.leadId === leadId && a.type === 'opp_created').sort((a, b) => a.at - b.at || a.seq - b.seq);
  return made.find(a => a.meta && a.meta.oppId === first.id) || made[0] || null;
}

// Every entry of a lead's timeline, newest first. Tracked clicks become touchpoint entries and "Browsed N pages" groups;
// landing-page views are folded into their touchpoint. Everything else (conversation, notes, deals, edits) is a plain entry.
function timelineOf(leadId) {
  const all = DB.activities.filter(a => a.leadId === leadId), folded = new Set(), items = [];
  const steps = journeyOf(leadId), ends = steps.some(s => s.kind === 'touch') ? journeyEnds(steps, leadId) : null;
  // The visit that opened the journey is always labelled. The one that led to the first deal is labelled too, but only when there is a deal. A single visit can be both.
  const tagOf = e => !ends ? '' : ends.first === ends.last && e === ends.first ? 'First and last touch' : e === ends.first ? 'First touch' : e === ends.last ? 'Last touch' : '';
  steps.forEach(s => {
    if (s.kind === 'touch') { folded.add(s.e.id); items.push({ at: s.e.at, seq: s.e.seq, html: touchItemHTML(s.e, tagOf(s.e)), key: !!tagOf(s.e) }); }
    else if (s.kind === 'pages') { const last = s.list[s.list.length - 1]; s.list.forEach(e => folded.add(e.id)); items.push({ at: last.at, seq: last.seq, html: pagesItemHTML(leadId, s.list) }); }
  });
  all.forEach(e => { if (e.type === 'page_view' && e.meta && e.meta.landing) folded.add(e.id); });
  // The entries "key moments" keeps: first touch, last touch (with a deal) and the conversion itself.
  const conv = convertedEvent(leadId);
  all.filter(e => !folded.has(e.id)).forEach(e => items.push({ at: e.at, seq: e.seq, html: leadEventHTML(e, conv && e.id === conv.id ? 'Converted' : ''), key: !!(conv && e.id === conv.id) }));
  return items.sort((a, b) => b.at - a.at || b.seq - a.seq);
}

// The one-line story above the timeline: where they came from and how long it took them to get in touch.
function journeySummaryHTML(leadId) {
  const steps = journeyOf(leadId);
  if (!steps.some(s => s.kind === 'touch')) return '';
  const sum = journeySummary(steps, leadId);
  const on = state.ui.keyMoments;
  return `<button class="j-summary${on ? ' is-on' : ''}" id="j-sum" aria-pressed="${on}" onclick="journeyFocus('${leadId}')" title="${on ? 'Show all activity' : 'Show only the first touch, last touch and conversion'}">${icon('journey')}<div><div class="j-headline">${esc(sum.headline)}</div><div class="tl-meta">${esc(sum.line)}</div></div><span class="j-focus" aria-hidden="true">${icon('focus')}</span></button>`;
}
