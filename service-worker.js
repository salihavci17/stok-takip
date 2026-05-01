const CACHE_NAME = 'stok-v2';
const assets = [
    './', 
    './index.html', 
    './style.css', 
    './app.js',
    './manifest.json',
    'https://cdn-icons-png.flaticon.com/512/2897/2897785.png'
];

// Yükleme ve Önbelleğe Alma
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(assets);
        })
    );
});

// ÖNEMLİ: İstekleri Önbellekten Sunma (Bu kısım sende eksikti)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Eğer önbellekte varsa onu döndür, yoksa ağa git
            return response || fetch(event.request);
        })
    );
});