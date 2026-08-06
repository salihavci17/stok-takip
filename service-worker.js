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

// ========== FETCH EVENT - SADECE GET İSTEKLERİ ==========
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // SADECE GET isteklerini işle, diğerlerini direkt geç
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // Firebase, Google API ve CDN isteklerini ASLA önbelleğe alma, direkt ağdan getir
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('firestore.googleapis.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // Statik dosyaları önbellekten veya ağdan getir
  event.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request))
      .catch(() => caches.match('./index.html'))
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