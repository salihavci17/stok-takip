// firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBdxkBa8K77nnLVFefpyzS-ACuxuZhhPc8",
    authDomain: "stok-app-ca168.firebaseapp.com",
    projectId: "stok-app-ca168",
    storageBucket: "stok-app-ca168.appspot.com",
    messagingSenderId: "599049285321",
    appId: "1:599049285321:web:0c51fb5f9331ac4e20e718"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Arka planda mesaj alındı:', payload);

    const notificationTitle = payload.notification?.title || '📦 Stok Takip';
    const notificationOptions = {
        body: payload.notification?.body || 'Yeni bir bildirim var!',
        icon: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
        data: {
            url: payload.data?.url || '/'
        },
        actions: [
            { action: 'open', title: '📦 Uygulamayı Aç' }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
        clients.openWindow(urlToOpen)
    );
});