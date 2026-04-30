const CACHE_NAME = 'stok-v2'; // v1'den v2'ye yükselttik
const assets = [
    './', 
    './index.html', 
    './style.css', 
    './app.js',
    './manifest.json' // Manifest'i de önbelleğe ekleyelim
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(assets);
        })
    );
});