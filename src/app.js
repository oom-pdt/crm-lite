// Start-up.
window.addEventListener('hashchange', () => { state.ui.editing = false; state.ui.keyMoments = false; state.ui.selected = []; state.ui.drpOpen = ''; closeModal(); render(); });
if (!location.hash) history.replaceState(null, '', '#/leads');
render();
