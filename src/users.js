// Users page (admin only) and the prototype toolbar.

function usersPage() {
  if (!isAdmin()) { location.replace('#/leads'); return null; }
  const count = id => DB.leads.filter(l => l.assigneeId === id).length;
  return `
    <header class="page-head">
      <div><h1>Users</h1><p class="sub">Admins see every lead. Basic users see only the leads assigned to them.</p></div>
      <button class="btn btn-primary" onclick="userOpenAdd()">${icon('add')}Add user</button>
    </header>
    <section class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th class="hide-sm">Email</th><th>Role</th><th class="num">Leads assigned</th></tr></thead>
        <tbody>${DB.users.map(u => `<tr>
          <td><div class="cell-main">${esc(u.name)}${u.id === state.userId ? ' <span class="muted">(you)</span>' : ''}</div></td>
          <td class="hide-sm">${esc(u.email)}</td>
          <td>${u.id === state.userId ? pill('Admin') : selectHTML('role-' + u.id, [['admin', 'Admin'], ['basic', 'Basic']], u.role, `onchange="userSetRole('${u.id}', this.value)" aria-label="Role for ${esc(u.name)}" style="width:auto;min-width:110px"`)}</td>
          <td class="num">${count(u.id)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="count">You can't change your own role, so the organisation always has an admin.</div>
    </section>`;
}

function userSetRole(id, role) {
  const u = DB.users.find(x => x.id === id);
  u.role = role;
  toast(`${u.name} is now ${role === 'admin' ? 'an admin' : 'a basic user'}`);
  render();
}

function userOpenAdd() {
  openModal('Add user', `
    <div class="form-grid">
      ${fieldHTML('Name', 'nu-name', inputHTML('nu-name', '', 'required aria-required="true"'), '', '', true)}
      ${fieldHTML('Email', 'nu-email', inputHTML('nu-email', '', 'type="email" required aria-required="true"'), '', '', true)}
      ${fieldHTML('Role', 'nu-role', selectHTML('nu-role', [['basic', 'Basic'], ['admin', 'Admin']], 'basic'), 'span-2')}
    </div>
    <p class="form-error" id="nu-error" role="alert"></p>`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="userSaveNew()">Add user</button>`);
}

function userSaveNew() {
  const name = val('nu-name'), email = val('nu-email').toLowerCase();
  const err = !name ? 'Enter a name.' : !validEmail(email) ? 'Enter a valid email address.' : DB.users.some(u => u.email === email) ? 'A user with this email already exists.' : '';
  if (err) { document.getElementById('nu-error').textContent = err; return; }
  DB.users.push({ id: 'u' + (DB.users.length + 1) + '-' + (++DB.seq), name, email, role: val('nu-role') });
  closeModal();
  toast('User added');
  render();
}

// ---- Prototype toolbar (not part of the product) ----------------------------
function devbarHTML() {
  return `<span class="devbar-title">CRM Lite Demo <span class="tag">DEV</span></span>
    <label><span class="hide-sm">View as</span> <select onchange="devViewAs(this.value)" aria-label="View as user">${DB.users.map(u => `<option value="${u.id}"${u.id === state.userId ? ' selected' : ''}>${esc(u.name)} (${u.role === 'admin' ? 'Admin' : 'Basic'})</option>`).join('')}</select></label>
    <div class="devbar-toggles">
      <span class="lbl">Actions:</span>
      <button type="button" class="dev-toggle" onclick="intakeOpen()" aria-label="Simulate incoming lead">${icon('inbox')}<span class="hide-sm">Simulate incoming lead</span></button>
      <button type="button" class="dev-toggle" onclick="devReset()" aria-label="Reset data">${icon('reset')}<span class="hide-sm">Reset data</span></button>
    </div>`;
}

function devViewAs(id) {
  state.userId = id;
  state.ui.assignee = '';
  state.ui.selected = [];
  state.ui.editing = false;
  closeModal();
  render();
}

function devReset() {
  DB = seedData();
  state.userId = 'u1';
  Object.assign(state.ui, { q: '', status: '', source: '', assignee: '', oppStatus: '', editing: false, selected: [] });
  closeModal();
  toast('Data reset');
  navigate('#/leads');
}
