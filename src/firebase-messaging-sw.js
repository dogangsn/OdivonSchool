/* Odivon School – Firebase Cloud Messaging service worker.
 *
 * Served from the site root (angular.json copies it there). PushService
 * registers it with the Firebase web config in the query string, so the
 * config lives only in src/environments/*.ts.
 *
 * The daily digest function sends data-only messages
 * ({ title, body, link, tag }); this worker turns them into a notification
 * and opens/focuses the app on click.
 */
/* global importScripts, firebase, clients */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
let config = null;
try {
  config = JSON.parse(params.get('config') || 'null');
} catch (e) {
  config = null;
}

function show(data) {
  data = data || {};
  const title = data.title || 'Odivon School';
  return self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/logo.png',
    badge: '/favicon.ico',
    tag: data.tag || 'odivon',
    renotify: false,
    data: { link: data.link || '/' },
  });
}

if (config && config.apiKey && config.messagingSenderId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    // Messages that carry a `notification` block are shown by the SDK itself.
    if (payload && payload.notification) return;
    return show(payload && payload.data);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.link) || '/';
  const target = new URL(raw, self.location.origin);
  // Never navigate away from our own site.
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          // The app is open: bring it forward and let its router go there
          // (PushService listens for this message).
          w.postMessage({ type: 'odivon-push-open', link: url.slice(self.location.origin.length) || '/' });
          return w.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
