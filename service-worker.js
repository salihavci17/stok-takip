const CACHE_NAME = 'stok-v6';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://unpkg.com/html5-qrcode',
  'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching assets...');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// ========== FETCH EVENT - SADECE STATİK DOSYALAR ==========
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Sadece GET isteklerini işle, diğerlerini direkt geç
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // Firebase, Google API ve CDN isteklerini asla yakalama
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('cloudfunctions.net') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // Kendi statik dosyalarımızı önbellekten veya ağdan getir
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(request).then(response => {
          if (response && response.status === 200 && url.origin === location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
      .catch(() => {
        return caches.match('./index.html');
      })
  );
});

// ========== PUSH BİLDİRİMLERİ ==========
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: '📦 Stok Takip', body: 'Yeni bir bildirim var!' };
  }
  
  const options = {
    body: data.body || 'Stok ile ilgili bir bildirim var!',
    icon: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: '📦 Uygulamayı Aç' },
      { action: 'dismiss', title: 'Kapat' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || '📦 Stok Takip', options)
  );
});

// Bildirime tıklandığında
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});