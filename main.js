/* ==========================================================================
   MAIN.JS
   Navigazione tra le due sezioni principali dell'app e inizializzazione.
   ========================================================================== */

function switchMainView(view) {
  document.querySelectorAll('.topbar-nav button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.section-view').forEach(v => v.classList.remove('active'));
  document.getElementById('nav-' + view).classList.add('active');
  document.getElementById('view-' + view).classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  initAcquisti();
  initAnalisi();
  switchMainView('acquisti');
});
