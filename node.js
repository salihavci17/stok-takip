// Önce Firebase Admin SDK'yı kurun: npm install firebase-admin
const admin = require('firebase-admin');

// Hizmet hesabı anahtar dosyasını indirip projeye ekleyin
const serviceAccount = require('./path/to/service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'stok-app-ca168'
});

async function sendNotification(fcmToken, title, body, url = '/') {
    const message = {
        notification: { title, body },
        webpush: {
            notification: {
                icon: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
                actions: [{ action: 'open', title: '📦 Uygulamayı Aç' }]
            },
            data: { url: url }
        },
        token: fcmToken,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Bildirim gönderildi:', response);
    } catch (error) {
        console.error('Bildirim gönderme hatası:', error);
    }
}