// Lost needs a reason. Marking a lead or a deal as Lost opens this dialog first: pick a reason (required) and add details (optional).

let pendingLost = null;

// ctx: { title, intro, reasons, apply(reason, note), cancel() }
function lostOpen(ctx) {
  pendingLost = ctx;
  openModal(ctx.title, `
    <p class="muted" style="margin-bottom:14px">${esc(ctx.intro)}</p>
    <div class="form-grid">
      ${fieldHTML('Reason', 'lost-reason', selectHTML('lost-reason', [['', 'Choose a reason…'], ...ctx.reasons], ''), 'span-2', '', true)}
      ${fieldHTML('Details', 'lost-note', '<textarea class="textarea" id="lost-note" placeholder="Anything your team should know"></textarea>', 'span-2', 'Optional.')}
    </div>
    <p class="form-error" id="lost-error" role="alert"></p>`,
    `<button class="btn" onclick="lostCancel()">Cancel</button><button class="btn btn-delete" onclick="lostConfirm()">Mark as lost</button>`);
}
function lostConfirm() {
  const reason = val('lost-reason'), note = val('lost-note');
  if (!reason) { document.getElementById('lost-error').textContent = 'Choose a reason.'; return; }
  const ctx = pendingLost; pendingLost = null;
  closeModal();
  if (ctx) ctx.apply(reason, note);
}
function lostCancel() {
  const ctx = pendingLost; pendingLost = null;
  closeModal();
  if (ctx && ctx.cancel) ctx.cancel();
}
// How a lost reason reads in the timeline.
const lostText = (reason, note) => `Reason: ${reason}.${note ? ` \u201c${note}\u201d` : ''}`;
