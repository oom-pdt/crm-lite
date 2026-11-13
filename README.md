# CRM Lite

**Live demo:** https://oom-pdt.github.io/crm-lite/ (prototype with placeholder data only)

A clickable prototype of a bare-bones CRM for a client business: a list of the leads we generate for them, where each lead came from, and the revenue it produced.

Everything runs in the browser with mock data held in memory. There is no backend, login or real tracking. All people, emails, phone numbers, campaigns and figures are placeholders.

## Running it

Open `index.html` in a browser. No build step is needed.

For a single file you can send to someone:

```bash
python3 scripts/build_standalone.py   # writes standalone.html
```

Fonts (Google Fonts) and icons (Lucide) still load from a CDN.

## What is in it

| Screen | What it does |
|---|---|
| Leads | Summary tiles (leads, won revenue, converted) and a searchable, filterable list. Tick leads (or the header box for everything shown) to get a bulk bar: assign, change status, delete. **Add lead** creates a lead by hand. |
| Lead page | Edit the lead's details and attribution, log deals, add notes, and read the full timeline. |
| Deals | Every deal on the leads you can see, with totals for Open, Won and Lost. |
| Users (admin only) | Change a user's role and add users. |

The dark pill at the bottom of the screen is a prototype toolbar, not part of the product. **View as** switches between the admin and the basic users. **Reset data** restores the mock data.

## Rules the prototype follows

- **Roles.** An admin sees every lead. A basic user sees only leads assigned to them, in every list, total and search, and cannot open another user's lead by URL. Only an admin can reassign a lead (the Assignee dropdown at the top of the lead page, which saves straight away) or open Users. A lead that a basic user adds is assigned to that user.
- **Bulk actions.** Assign and Delete are admin only; anyone can change the status of leads they can see. Selection only ever covers leads currently in view.
- **Delete.** Only manually created leads can be deleted. If the selection includes automatically added leads, the dialog says so, gives the real count of manual leads, and deletes only those; the rest are kept. Deleting also removes the lead's deals and timeline.
- **Duplicates.** Two leads are the same person when they share an email (ignoring case) or a phone number (last 8 digits, so "+65 8000 1002" and "80001002" match).
  - *Incoming:* a form, call or chat from an existing contact is added to that lead's timeline, not saved as a new lead. Missing email or phone details are filled in; existing values and the first-touch source are never overwritten. The dark prototype toolbar's **Simulate incoming lead** button stands in for the real intake.
  - *Found later:* adding a lead or editing an email or phone so that it matches another lead is allowed. Both leads get a **Possible duplicate** tag in the list, and the lead page shows a warning with a **Merge** button.
  - *Merge:* works for two leads or more (the lead page offers **Merge** for each lead sharing a detail with it, and **Merge all N** when three or more are linked, even if two of them only connect through a third). The dialog shows every lead's value for name, email, phone, status and assignee. The **After merge** column is a dropdown preset to the most recently updated value (an empty value never replaces a filled one), and you can pick any other lead's value instead. The earliest-created lead is kept and the rest are removed; timelines and deals are combined (so lifetime value adds up) and source and first-touch details come from the kept lead. Everyone being merged must be visible to the person merging.
- **Lost needs a reason.** Marking a lead or a deal as Lost (from the lead page, the bulk bar or the deal editor) opens a dialog with a required reason and optional details. The reason shows on the lead page and the timeline, and is cleared if the lead or deal is reopened. Lead reasons: Not a fit, No response, Went elsewhere, Price, Spam or invalid, Other. Deal reasons: Price, Went elsewhere, No response, Timing, Other.
- **Date filter.** The Leads list filters by created date and the Deals list by close date (or the date opened, for open deals), with the same picker: Today, Yesterday, This week and Last week (Monday to Sunday), This month, Last month, All time, "Last N days" up to today (1 to 3650), or a custom range picked on a two-month calendar (click a start day, then an end day; either end can be left open). Choosing a range filters the list only; the summary tiles stay all-time. Each list keeps its own range while you move around.
- **Customer journey is part of the Timeline.** For a tracked lead, a summary line sits above the timeline (first touch, where they converted, ads clicked, pages browsed, how long until they got in touch). Each tracked visit is a timeline entry with its parameters (landing page, campaign, ad, keyword or search term, medium, source, referrer), and the pages browsed between visits collapse into one "Browsed N pages" entry that expands in place. Landing-page views are shown on their visit, not counted again as browsed pages. **Lead source** is the first touch (the same meaning as HubSpot's "Original source"), and "Contacted us via" is a separate fact about how they got in touch; the contact itself is never a touch. **First touch** is the earliest touch and is always labelled. A touch is a visit by a channel (ad click, organic search, referral link, email link, direct visit); pages browsed are part of the visit. A tracked touch always wins. A lead with no tracked visit but a recorded origin (Walk-in, Event, Personal referral, Phone enquiry) has that origin as its one touch, dated when it was added and marked as recorded by hand. **Last touch** only exists once the lead has a deal: the latest touch before the first deal was made, skipping direct visits when another channel came earlier (the usual "last non-direct" rule). A touch after the deal is never the last touch. With no deal there is no last touch, and the headline names only the first touch. The entry for the first deal made is labelled **Converted**. Clicking the summary above the timeline shows only the key moments (first touch, last touch and Converted); clicking it again shows everything. The lead status **Converted** (previously Customer) is set when a deal is marked Won. Everything else (the conversation, notes, deals, edits) sits in the same newest-first list. Some seeded leads come back by organic search after an ad, so first touch and converted-on differ. Manually added leads have no tracked clicks, so they have no summary.
- **Lifetime value** is never typed in. It is the sum of the lead's Won deals.
- **Close date.** An open deal has no close date. Marking a deal Won or Lost shows the date field, starting at today (you can change it to log a past sale), and reopening the deal clears it. The Deals date filter uses the close date for closed deals and the date opened for open ones.
- **Deals** belong to exactly one lead. A lead can have several. Marking one Won also sets the lead's status to Converted.
- **Lead source** is the first touch, shown as a read-only row in Details next to "Contacted us via" (the channel they got in touch on); there is no separate Lead source card. It is set when the lead is created and can't be edited afterwards. The campaign, ad, keyword, landing page, referrer and click ID are shown on the first-touch entry in the timeline. There is no catch-all "Other" source: offline sources are named (Walk-in, Event, Personal referral, Phone enquiry) and take a free-text Details field when the lead is added. The Created tile says what created the lead (for example "From a WhatsApp conversation", or "Added manually"). Manually added leads are labelled "Added manually" in the list, because only those can be deleted.
- **Timeline.** Clicks tracked before the lead contacted us are tagged "Tracked". The "Started a conversation" event is the point where those clicks were matched to the contact. Every edit a user makes is logged after that. Use **Add activity** (top of the timeline) to log a note, call, SMS, WhatsApp, Telegram, email or meeting. Clicking a Call, SMS, WhatsApp, Telegram or Email button on the lead page still opens the app and also logs it ("Call logged" and so on), then asks for an optional note.
- A lead needs a name and either an email or a phone number. Emails must be unique.

## Design

CRM Lite shares its identity with the Galaxis Hub v2 demo (`../Hub-V2-Demo`) so the products look like one family, and keeps its own glass look.

- **Shared with Hub v2:** Radio Canada Big headings and Arimo body text with Hub's letter-spacing, Hub's blue and neutral greys, blue page titles, pill-shaped buttons and tabs, small bold navigation labels with a tinted active item, KPI-style summary cards, a tinted table header row, Hub's light modal backdrop, 1.75px icon strokes, a dark toast, and the dark top dev bar with a `DEV` tag.
- **CRM Lite's own:** glass cards on a flat, very light blue-grey page, no borders, very rounded corners and fields, and tinted status pills.
- **One deliberate difference:** Hub's primary blue (#398FF7) is too light for white text, so filled buttons use Hub's own darker hover blue (#2E72C6), and small blue text uses #0356B8. All text passes 4.5:1.

## Code layout

| File | Purpose |
|---|---|
| `src/styles.css` | Design tokens, glass components, layout |
| `src/data.js` | Field lists and the seeded mock data generator |
| `src/core.js` | State, role scoping (`visibleLeads`, `visibleOpps`), routing, formatting, modal, toast, icon registry |
| `src/leads.js` | Leads list, revenue summary, add-lead dialog, lead page |
| `src/opps.js` | Deals list and the deal editor |
| `src/users.js` | Users page and the prototype toolbar |
| `src/app.js` | Start-up |

Each file is a plain script sharing one set of globals, loaded in the order listed in `index.html`. Each icon has one meaning; the registry is the comment above `ICONS` in `src/core.js`.

## Open questions

- Should a basic user be able to reassign a lead to someone else?
- Who picks up a lead that arrives with no assignee? Today only an admin can see it.
- Should winning an deal always move the lead to Converted?
- For the real build: how clicks are matched to a contact (click ID and UTM capture, WhatsApp and call integrations), PDPA consent and retention for lead data, and whether ad spend and ROAS belong in the CRM.
