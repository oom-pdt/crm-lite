// Mock data. Every person, email, phone number, campaign and figure here is a placeholder.

const ORG_NAME = 'Demo Organisation';
const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
// Tracked sources come from click tracking and are never offered when adding a lead by hand.
const TRACKED_SOURCES = ['Google Ads', 'Meta Ads', 'Organic Search', 'Referral', 'Direct', 'Email'];
const MANUAL_SOURCES = ['Personal referral', 'Walk-in', 'Event', 'Phone enquiry'];
const LEAD_SOURCES = [...TRACKED_SOURCES, ...MANUAL_SOURCES];
const CONTACT_CHANNELS = ['WhatsApp', 'Phone call', 'Web form', 'Email', 'Live chat', 'In person'];
const OPP_STATUSES = ['Open', 'Won', 'Lost'];
// Marking a lead or a deal as Lost asks for one of these, plus optional details.
const LEAD_LOST_REASONS = ['Not a fit', 'No response', 'Went elsewhere', 'Price', 'Spam or invalid', 'Other'];
const DEAL_LOST_REASONS = ['Price', 'Went elsewhere', 'No response', 'Timing', 'Other'];
// Fields a merge picks the most recently updated value for. Each lead keeps a timestamp per field (fieldUpdated).
const MERGE_FIELDS = ['name', 'email', 'phone', 'status', 'assigneeId'];

// First-touch attribution fields, and which of them apply to each source.
const ATTR_FIELDS = [
  { key: 'sourceDetail', label: 'Details' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'ad', label: 'Ad / ad group' },
  { key: 'keyword', label: 'Keyword / search term' },
  { key: 'landingPage', label: 'Landing page' },
  { key: 'referrer', label: 'Referrer' },
  { key: 'clickId', label: 'Click ID' }
];
const SOURCE_FIELDS = {
  'Google Ads': ['campaign', 'ad', 'keyword', 'landingPage', 'clickId'],
  'Meta Ads': ['campaign', 'ad', 'landingPage', 'clickId'],
  'Organic Search': ['keyword', 'landingPage'],
  'Referral': ['referrer', 'landingPage'],
  'Direct': ['landingPage'],
  'Email': ['campaign', 'landingPage'],
  // Offline sources have no clicks to track, so they only carry a free-text detail
  'Personal referral': ['sourceDetail'],
  'Walk-in': ['sourceDetail'],
  'Event': ['sourceDetail'],
  'Phone enquiry': ['sourceDetail']
};

// Structured details of a tracked visit. They are kept on the activity as `meta`, which is what the customer journey shows.
// `label` names the channel; the rest are the parameters a real tracker would capture.
function visitMeta(source, a) {
  const m = { label: source, landingPage: a.landingPage || '' };
  if (source === 'Google Ads') return { ...m, source: 'google', medium: 'cpc', campaign: a.campaign || '', ad: a.ad || '', keyword: a.keyword || '', clickId: a.clickId || '' };
  if (source === 'Meta Ads') return { ...m, source: 'meta', medium: 'paid_social', campaign: a.campaign || '', ad: a.ad || '', clickId: a.clickId || '' };
  if (source === 'Organic Search') return { ...m, referrer: 'google.com', keyword: a.keyword || '' };
  if (source === 'Referral') return { ...m, referrer: a.referrer || '' };
  if (source === 'Email') return { ...m, source: 'email', medium: 'email', campaign: a.campaign || '' };
  return m;
}

const SEED_USERS = [
  { id: 'u1', name: 'Jamie Lim', email: 'jamie.lim@example.com', role: 'admin' },
  { id: 'u2', name: 'Priya Nair', email: 'priya.nair@example.com', role: 'basic' },
  { id: 'u3', name: 'Marcus Lee', email: 'marcus.lee@example.com', role: 'basic' },
  { id: 'u4', name: 'Sofia Rahman', email: 'sofia.rahman@example.com', role: 'basic' }
];

const SEED_FIRST = ['Aiden', 'Bella', 'Chen', 'Divya', 'Ethan', 'Farah', 'Gabriel', 'Hui Min', 'Imran', 'Jia Hui', 'Kai', 'Lina', 'Mei', 'Nikhil', 'Olivia', 'Pei Shan', 'Qistina', 'Ravi', 'Siti', 'Theo'];
const SEED_LAST = ['Ang', 'Bose', 'Chua', 'Das', 'Eng', 'Foo', 'Goh', 'Hassan', 'Ismail', 'Koh', 'Low', 'Menon', 'Ng', 'Ong', 'Pillai', 'Quek', 'Raj', 'Sim', 'Teo', 'Wong'];
const SEED_PAGES = ['/', '/services', '/pricing', '/contact', '/about', '/case-studies', '/blog/getting-started'];
const SEED_ATTR = {
  'Google Ads': { campaign: ['Search — Brand', 'Search — Generic', 'Performance Max'], ad: ['Brand terms', 'Service keywords', 'Competitor terms'], keyword: ['service near me', 'best value service package', 'demo organisation pricing', 'book a consultation'] },
  'Meta Ads': { campaign: ['Lead Gen — Click to WhatsApp', 'Retargeting — Engaged visitors', 'Awareness — Video'], ad: ['Carousel — Packages', 'Video — Customer story', 'Static — Limited offer'] },
  'Organic Search': { keyword: ['how to choose a service provider', 'service package comparison', 'demo organisation reviews'] },
  'Referral': { referrer: ['partner-site.example', 'directory.example', 'community-forum.example'] },
  'Email': { campaign: ['Monthly newsletter', 'Re-engagement series'] },
  'Personal referral': { sourceDetail: ['Introduced by an existing customer', 'Recommended by a friend of the business'] },
  'Walk-in': { sourceDetail: ['Front desk visit', 'Showroom visit'] },
  'Event': { sourceDetail: ['Annual trade expo', 'Partner open house'] },
  'Phone enquiry': { sourceDetail: ['Called the office line', 'Returned a missed call'] }
};
// Leads someone added by hand (index in the seed list -> source they chose). Everything else is created from tracked clicks.
const SEED_MANUAL_SOURCE = { 4: 'Personal referral', 9: 'Phone enquiry', 15: 'Walk-in', 21: 'Event', 27: 'Personal referral', 33: 'Phone enquiry', 38: 'Walk-in' };
const SEED_MANUAL_NOTES = ['Enquired in person and asked for a quote.', 'Introduced by an existing customer; prefers a call after 4pm.', 'Called the office directly, details taken by phone.', 'Came through a partner event; follow up with the brochure.'];
const SEED_LEAD_NOTES = ['Prefers to be contacted in the **afternoon**.', '**Quote request**\n- Two locations\n- Proposal due *Friday*\n- Follow up once it is out', 'Decision maker is travelling until next week.\n\n1. Check in on Monday\n2. Send the case study'];
const SEED_OPP_NAMES = ['Starter package', 'Annual plan', 'Add-on service', 'Consultation package', 'Renewal', 'Premium upgrade'];

// Small seeded generator so the mock data is identical on every load.
function seedRng(seed) {
  let a = seed;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function seedData() {
  const r = seedRng(20261110);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const weighted = pairs => { let x = r() * pairs.reduce((s, p) => s + p[1], 0); for (const [v, w] of pairs) { if ((x -= w) < 0) return v; } return pairs[0][0]; };
  const DAY = 864e5, HOUR = 36e5, MIN = 6e4;
  const now = Date.now();
  const db = { users: SEED_USERS.map(u => ({ ...u })), leads: [], activities: [], opps: [], seq: 0 };
  const act = (leadId, at, type, title, detail, meta) => db.activities.push({ id: 'a' + (++db.seq), seq: db.seq, leadId, at, type, title, detail: detail || '', by: null, meta: meta || null });

  for (let i = 0; i < 42; i++) {
    const id = 'L' + (1001 + i);
    const first = SEED_FIRST[i % SEED_FIRST.length], last = SEED_LAST[(i * 7 + 3) % SEED_LAST.length];
    const drawn = weighted([['Google Ads', 30], ['Meta Ads', 25], ['Organic Search', 19], ['Referral', 10], ['Direct', 9], ['Email', 7]]);
    const source = SEED_MANUAL_SOURCE[i] || drawn;
    const manual = i in SEED_MANUAL_SOURCE;
    const createdAt = now - Math.floor((1 + r() * 110) * DAY) - Math.floor(r() * 8 * HOUR);
    const pool = SEED_ATTR[source] || {};
    const attribution = { sourceDetail: '', campaign: '', ad: '', keyword: '', landingPage: '', referrer: '', clickId: '' };
    SOURCE_FIELDS[source].forEach(k => {
      if (k === 'landingPage') attribution[k] = pick(SEED_PAGES.slice(0, 4));
      else if (k === 'clickId') attribution[k] = (source === 'Google Ads' ? 'gclid-' : 'fbclid-') + 'placeholder-' + (4000 + Math.floor(r() * 5999));
      else if (pool[k]) attribution[k] = pick(pool[k]);
    });
    const channelDrawn = source === 'Meta Ads' ? weighted([['WhatsApp', 7], ['Web form', 2], ['Phone call', 1]]) : weighted([['Web form', 4], ['WhatsApp', 3], ['Phone call', 2], ['Email', 1], ['Live chat', 1]]);
    const contactChannel = { 'Walk-in': 'In person', 'Event': 'In person', 'Personal referral': 'Phone call', 'Phone enquiry': 'Phone call' }[source] || channelDrawn;
    const status = weighted([['New', 22], ['Contacted', 20], ['Qualified', 20], ['Converted', 28], ['Lost', 10]]);
    const assigneeId = i % 14 === 5 ? null : weighted([['u2', 4], ['u3', 4], ['u4', 3], ['u1', 1]]);
    const hasEmail = contactChannel !== 'WhatsApp' && contactChannel !== 'Phone call' || r() < 0.5;
    db.leads.push({
      id, name: `${first} ${last}`,
      email: hasEmail ? `${first}.${last}${i}`.toLowerCase().replace(/\s+/g, '') + '@example.com' : '',
      phone: `+65 8000 ${1000 + i}`,
      status, source, attribution, contactChannel, createdAt, assigneeId,
      lostReason: status === 'Lost' ? LEAD_LOST_REASONS[i % LEAD_LOST_REASONS.length] : '', lostNote: '',
      // The email and phone above are the primary ones. People can keep more here.
      notes: i % 9 === 2 ? SEED_LEAD_NOTES[(i / 9 | 0) % SEED_LEAD_NOTES.length] : '',
      emailLabel: 'Primary', phoneLabel: 'Primary', moreEmails: [], morePhones: [],
      // 'tracked' leads were created automatically from click tracking, so their attribution is system-generated
      origin: manual ? 'manual' : 'tracked',
      fieldUpdated: Object.fromEntries(MERGE_FIELDS.map(f => [f, createdAt]))
    });

    // Tracked clicks come first; the conversation is what ties them to this contact.
    let t = createdAt - Math.floor(r() * 9 * DAY) - 2 * HOUR;
    const a = attribution;
    const visit = visitMeta(source, a), t0 = t;
    if (source === 'Google Ads' || source === 'Meta Ads') act(id, t, 'ad_click', `Clicked ${source} ad`, `${a.campaign} · ${a.ad}${a.keyword ? ` · “${a.keyword}”` : ''}`, visit);
    else if (source === 'Organic Search') act(id, t, 'search', 'Arrived from organic search', `Searched “${a.keyword}”`, visit);
    else if (source === 'Referral') act(id, t, 'referral', 'Arrived from a referral link', a.referrer, visit);
    else if (source === 'Email') act(id, t, 'email_click', 'Clicked an email link', a.campaign, visit);
    else if (source === 'Direct') act(id, t, 'direct', 'Visited the site directly', '', visit);
    if (!manual) {
      act(id, t + MIN, 'page_view', 'Viewed page', a.landingPage, { landing: true });
      const views = 1 + Math.floor(r() * 4);
      for (let v = 0; v < views; v++) {
        t += Math.floor((createdAt - 10 * MIN - t) * r() * 0.6);
        act(id, t, 'page_view', 'Viewed page', pick(SEED_PAGES));
      }
      // Some people come back by another route (organic search) before getting in touch. Index-based, so the random stream is unchanged.
      if (i % 3 === 1 && source !== 'Organic Search') {
        const kw = SEED_ATTR['Organic Search'].keyword[i % 3], back = { landingPage: SEED_PAGES[i % 4], keyword: kw };
        const t2 = t0 + Math.floor((createdAt - t0) * (0.5 + (i % 4) * 0.1));
        act(id, t2, 'search', 'Arrived from organic search', `Searched “${kw}”`, visitMeta('Organic Search', back));
        act(id, t2 + MIN, 'page_view', 'Viewed page', back.landingPage, { landing: true });
      }
      act(id, createdAt - 3 * MIN, 'conversation_started', `Started a conversation via ${contactChannel}`, 'Earlier tracked clicks were matched to this contact.', { channel: contactChannel });
      act(id, createdAt, 'lead_created', 'Lead created automatically', `Identified by ${hasEmail ? 'email' : 'phone number'}`);
    } else {
      // No tracked clicks: a person typed this lead in, so the timeline starts with them.
      act(id, createdAt, 'lead_created', 'Lead added manually', `Source: ${source}`);
      db.activities[db.activities.length - 1].by = SEED_USERS[i % 2 ? 0 : 1].name;
      act(id, createdAt + HOUR, 'note', 'Note', pick(SEED_MANUAL_NOTES));
      db.activities[db.activities.length - 1].by = SEED_USERS[i % 2 ? 0 : 1].name;
    }

    // Deals follow the lead's status so the seeded numbers add up.
    const opp = (oStatus, offset) => {
      const openedAt = Math.min(createdAt + Math.floor((1 + r() * 6) * DAY) + offset, now - HOUR);
      const closedAt = Math.min(openedAt + Math.floor((2 + r() * 14) * DAY), now);
      const value = (3 + Math.floor(r() * 58)) * 100;
      if (oStatus === 'Open') r();   // an open deal used to draw an expected close date here; the draw stays so the sample data is unchanged
      const o = { id: 'O' + (501 + db.opps.length), leadId: id, name: pick(SEED_OPP_NAMES), value, status: oStatus, lostReason: oStatus === 'Lost' ? DEAL_LOST_REASONS[db.opps.length % DEAL_LOST_REASONS.length] : '', lostNote: '', closeDate: oStatus === 'Open' ? '' : new Date(closedAt).toISOString().slice(0, 10), note: '', createdAt: openedAt };
      db.opps.push(o);
      act(id, openedAt, 'opp_created', 'Deal added', `${o.name} · S$${value.toLocaleString('en-SG')}`, { oppId: o.id });
      if (oStatus === 'Won') act(id, closedAt, 'opp_won', 'Deal won', `${o.name} · S$${value.toLocaleString('en-SG')}`);
      if (oStatus === 'Lost') act(id, closedAt, 'opp_lost', 'Deal lost', o.name);
    };
    if (status === 'Converted') { opp('Won', 0); if (r() < 0.4) opp('Won', 20 * DAY); if (r() < 0.3) opp('Open', 30 * DAY); }
    if (status === 'Qualified') opp('Open', 0);
    if (status === 'Lost' && r() < 0.6) opp('Lost', 0);
    if (status === 'Contacted' && r() < 0.3) opp('Open', 0);
  }
  // A few leads with more than one email or phone number.
  const withBoth = db.leads.filter(l => l.email && l.phone && !['L1007', 'L1013', 'L1019', 'L1031'].includes(l.id));
  withBoth[2].moreEmails = [{ label: 'Work', value: 'work.' + withBoth[2].email }];
  withBoth[5].morePhones = [{ label: 'Secondary', value: '+65 6000 5005' }];
  withBoth[8].moreEmails = [{ label: 'Secondary', value: 'home.' + withBoth[8].email }]; withBoth[8].morePhones = [{ label: 'Office', value: '+65 6000 5008' }];
  // Two possible duplicates, so the warning and the merge have something to show.
  const L = i => db.leads[i];
  L(12).phone = L(6).phone;                                   // same phone number, different name and email
  if (!L(18).email) L(18).email = 'shared.contact@example.com';
  L(30).email = L(18).email;                                  // same email address, different name and phone
  // On the first pair the older lead was reassigned recently, so a merge keeps that assignee but the newer lead's other details.
  const [older, newer] = L(6).createdAt <= L(12).createdAt ? [L(6), L(12)] : [L(12), L(6)];
  older.assigneeId = 'u2'; newer.assigneeId = 'u3';
  older.fieldUpdated.assigneeId = now - 2 * HOUR;
  db.activities.push({ id: 'a' + (++db.seq), seq: db.seq, leadId: older.id, at: now - 2 * HOUR, type: 'assignee_changed', title: 'Assignee changed', detail: 'Unassigned → Priya Nair', by: SEED_USERS[0].name });
  return db;
}
