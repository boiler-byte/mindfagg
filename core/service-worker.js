'use strict';
// mindfagg v30: core/service-worker.js (klassisches Script; gemeinsame globale Laufzeit).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .catch(err => console.warn('Service Worker Registrierung fehlgeschlagen:', err));
  });
}
