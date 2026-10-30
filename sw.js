/* mindfagg Service Worker — Offline-Cache */
'use strict';

const VERSION = 'mindfagg-v1';
const CORE_CACHE = `${VERSION}-core`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// Alles, was ohne Netzwerk startbar sein muss.
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/kanban.css',
  './css/calendar.css',
  './js/kanban.js',
  './js/calendar.js',
  './js/extras.js',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS).catch(err => {
        // Einzelne fehlende Dateien dürfen die Installation nicht blockieren.
        console.warn('[SW] Einige Core-Assets konnten nicht gecacht werden:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(k => k !== CORE_CACHE && k !== RUNTIME_CACHE)
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Nur same-origin cachen. Externe Ressourcen (falls je eingebunden) direkt durchreichen.
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first, damit Updates ankommen, mit Cache-Fallback offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Statische Assets: cache-first, im Hintergrund auffrischen.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        fetch(req).then(res => {
          if (res && res.ok) caches.open(RUNTIME_CACHE).then(c => c.put(req, res.clone()));
        }).catch(() => {});
        return cached;
      }
      return fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});

// Optional: Message-basierte manuelle Aktualisierung
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});