self.addEventListener('fetch', function(event) {
    // Bu kısım uygulamanın hızlı açılmasını sağlar
});
self.addEventListener('install', (e) => {
  console.log('Service Worker: Kuruldu');
});

self.addEventListener('fetch', (e) => {
  // Bu boş olsa bile tanımlanmış olması PWA için yeterlidir
});