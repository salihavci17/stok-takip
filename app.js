// ================================================================
// STOK TAKİP SİSTEMİ - TAM VE EKSİKSİZ
// ================================================================

// --- FIREBASE MODÜLLERİ ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, query, where, Timestamp,
    onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc, orderBy, limit, addDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signOut, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

// --- KONFİGÜRASYON ---
const firebaseConfig = {
    apiKey: "AIzaSyBdxkBa8K77nnLVFefpyzS-ACuxuZhhPc8",
    authDomain: "stok-app-ca168.firebaseapp.com",
    projectId: "stok-app-ca168",
    storageBucket: "stok-app-ca168.appspot.com",
    messagingSenderId: "599049285321",
    appId: "1:599049285321:web:0c51fb5f9331ac4e20e718"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);

// --- DEĞİŞKENLER ---
let stoklar = {};
let sepet = [];
let html5QrCode = null;
let seciliUrunId = "";
let mevcutKullanici = null;
let mevcutRol = null;
let mevcutDurum = null;
let notificationPermission = false;
let _lastNotificationTime = 0;
let fcmRetryCount = 0;
const MAX_FCM_RETRY = 3;
let grafik = null;
let inaktiviteTimeout = null;
const INACTIVITY_LIMIT = 30 * 60 * 1000;
let logSayfa = 0;
const LOG_LIMIT = 50;
let logFiltre = 'hepsi';
let logArama = '';
let quickNavPosition = 'top';
let gruplar = {};
let hareketlerUnsubscribe = null;
let kameraAktif = false;
let oncekiTab = 'stok-listesi';
let oncekiScrollY = 0;

// --- DASHBOARD WIDGET DEĞİŞKENLERİ ---
let dashboardWidgets = [];
const WIDGET_OPTIONS = {
    toplamStok: { id: 'toplamStok', title: '📦 Toplam Stok', icon: '📦' },
    kritik: { id: 'kritik', title: '⚠️ Kritik Ürün', icon: '⚠️' },
    bugunGiris: { id: 'bugunGiris', title: '📥 Bugün Giriş', icon: '📥' },
    populer: { id: 'populer', title: '🏆 Popüler Ürün', icon: '🏆' },
    kritikListe: { id: 'kritikListe', title: '📋 Kritik Liste', icon: '📋' },
    sonHareketler: { id: 'sonHareketler', title: '🕒 Son Hareketler', icon: '🕒' },
    siparisSayisi: { id: 'siparisSayisi', title: '📦 Sipariş Sayısı', icon: '📦' },
    kullaniciSayisi: { id: 'kullaniciSayisi', title: '👥 Kullanıcı Sayısı', icon: '👥' },
    grupSayisi: { id: 'grupSayisi', title: '📁 Grup Sayısı', icon: '📁' },
    toplamUrunCesidi: { id: 'toplamUrunCesidi', title: '🏷️ Ürün Çeşidi', icon: '🏷️' },
    bugunCikis: { id: 'bugunCikis', title: '📤 Bugün Çıkış', icon: '📤' }
};

// --- YARDIMCI FONKSİYONLAR ---
function getUrunAdi(urun) {
    if (!urun) return "Bilinmeyen";
    return urun.urunAd || urun.ad || urun.isim || urun.name || urun.id || "Bilinmeyen";
}

function adminMi() { return mevcutRol === 'admin'; }
function yoneticiMi() { return mevcutRol === 'admin' || mevcutRol === 'yonetici'; }

// ========== LOG EKLEME ==========
async function logEkle(islem, detay, ekstra = {}) {
    if (!mevcutKullanici) return;
    try {
        await addDoc(collection(db, "logs"), {
            kullanici: mevcutKullanici.email,
            islem: islem,
            detay: detay,
            tarih: Timestamp.now(),
            ...ekstra
        });
    } catch(e) {
        console.warn('Log eklenemedi:', e.message);
    }
}

// ========== YÜKLEME SPINNER ==========
function showLoading(text = 'Yükleniyor...') {
    const spinner = document.getElementById('loadingSpinner');
    const textEl = document.getElementById('loadingText');
    if (spinner) {
        textEl.textContent = text;
        spinner.style.display = 'flex';
    }
}

function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'none';
}

// ========== PROGRESS BAR ==========
function showProgress(total, label = 'İşlem devam ediyor...') {
    const container = document.getElementById('progressContainer');
    const bar = document.getElementById('progressBar');
    const percent = document.getElementById('progressPercent');
    const labelEl = document.getElementById('progressLabel');
    if (container) {
        container.style.display = 'block';
        labelEl.textContent = label;
        bar.style.width = '0%';
        percent.textContent = '0%';
        window._progressTotal = total;
        window._progressCurrent = 0;
    }
}

function updateProgress(current) {
    const bar = document.getElementById('progressBar');
    const percent = document.getElementById('progressPercent');
    if (bar && window._progressTotal) {
        const pct = Math.min(100, Math.round((current / window._progressTotal) * 100));
        bar.style.width = pct + '%';
        percent.textContent = pct + '%';
    }
}

function hideProgress() {
    const container = document.getElementById('progressContainer');
    if (container) container.style.display = 'none';
}

// ========== DEBOUNCE YARDIMCISI ==========
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========== ÖZEL CONFIRM MODAL ==========
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const msgEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmYesBtn');
        const noBtn = document.getElementById('confirmNoBtn');
        
        titleEl.textContent = title || '⚠️ Emin misiniz?';
        msgEl.textContent = message || 'Bu işlemi gerçekleştirmek istediğinize emin misiniz?';
        modal.style.display = 'flex';
        
        const cleanup = () => {
            modal.style.display = 'none';
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
        };
        const onYes = () => { cleanup(); resolve(true); };
        const onNo = () => { cleanup(); resolve(false); };
        
        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
    });
}

// ========== HATA MESAJI ÇEVİRİ ==========
function getFriendlyErrorMessage(error) {
    const messages = {
        'permission-denied': 'Bu işlemi yapmak için yetkiniz yok.',
        'unauthenticated': 'Lütfen tekrar giriş yapın.',
        'not-found': 'İstenen veri bulunamadı.',
        'already-exists': 'Bu veri zaten mevcut.',
        'failed-precondition': 'İşlem şu anda gerçekleştirilemiyor.',
        'aborted': 'İşlem iptal edildi.',
        'out-of-range': 'Geçersiz değer aralığı.',
        'unimplemented': 'Bu özellik henüz desteklenmiyor.',
        'internal': 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.',
        'unavailable': 'Servis şu anda kullanılamıyor.',
        'deadline-exceeded': 'İşlem zaman aşımına uğradı.',
        'quota-exceeded': 'Depolama alanı dolu. Lütfen site verilerini temizleyin.',
        'network-request-failed': 'İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.'
    };
    
    if (error.code && messages[error.code]) return messages[error.code];
    if (error.message) {
        for (const [key, msg] of Object.entries(messages)) {
            if (error.message.includes(key)) return msg;
        }
        if (error.message.includes('auth/')) {
            const authMsg = error.message.split('auth/')[1]?.split(')')[0];
            const authMessages = {
                'user-not-found': 'Bu e-posta adresine kayıtlı kullanıcı bulunamadı.',
                'wrong-password': 'Geçersiz şifre. Lütfen tekrar deneyin.',
                'email-already-in-use': 'Bu e-posta adresi zaten kullanılıyor.',
                'invalid-email': 'Geçersiz e-posta adresi.',
                'weak-password': 'Şifre çok zayıf. En az 6 karakter olmalı.',
                'too-many-requests': 'Çok fazla deneme yaptınız. Lütfen birkaç dakika sonra tekrar deneyin.'
            };
            if (authMessages[authMsg]) return authMessages[authMsg];
        }
        return error.message;
    }
    return 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

// ========== SES VE TİTREŞİM ==========
function playAlertSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) { /* Sessizce başarısız ol */ }
}

function vibrateDevice() {
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
}

// ========== BENİ HATIRLA ==========
function saveRememberMe(email) {
    if (document.getElementById('rememberMe')?.checked) {
        localStorage.setItem('rememberedEmail', email);
    } else {
        localStorage.removeItem('rememberedEmail');
    }
}

function loadRememberMe() {
    const email = localStorage.getItem('rememberedEmail');
    if (email) {
        const input = document.getElementById('loginEmail');
        if (input) input.value = email;
        const checkbox = document.getElementById('rememberMe');
        if (checkbox) checkbox.checked = true;
    }
}

// ========== OTURUM ZAMAN AŞIMI ==========
function oturumZamanAsimiBaslat() {
    if (inaktiviteTimeout) clearTimeout(inaktiviteTimeout);
    inaktiviteTimeout = setTimeout(() => {
        if (mevcutKullanici) {
            showToast('⏰ 30 dakika işlem yapılmadığı için otomatik çıkış yapılıyor...', true);
            setTimeout(() => window.kullaniciCikis(), 2000);
        }
    }, INACTIVITY_LIMIT);
}

function oturumZamanAsimiSifirla() {
    if (inaktiviteTimeout) {
        clearTimeout(inaktiviteTimeout);
        inaktiviteTimeout = null;
    }
    oturumZamanAsimiBaslat();
}

// Tüm etkinlikleri dinle
document.addEventListener('click', oturumZamanAsimiSifirla);
document.addEventListener('keydown', oturumZamanAsimiSifirla);
document.addEventListener('touchstart', oturumZamanAsimiSifirla);
document.addEventListener('scroll', oturumZamanAsimiSifirla);

// ========== TOAST BİLDİRİM ==========
function showToast(msg, err = false) {
    const t = document.getElementById('toastMessage');
    if (!t) return;
    t.textContent = msg;
    t.style.background = err ? 'var(--btn-danger)' : 'var(--toast-bg)';
    t.classList.add('show');
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove('show'), 4000);
}

// ========== PUSH BİLDİRİM FONKSİYONLARI ==========
function updateNotificationButton(enabled) {
    const btn = document.getElementById('notificationToggleBtn');
    if (!btn) return;
    if (enabled) {
        btn.classList.add('active');
        btn.textContent = '🔔';
        btn.title = 'Bildirimler açık';
    } else {
        btn.classList.remove('active');
        btn.textContent = '🔕';
        btn.title = 'Bildirimler kapalı';
    }
}

function checkNotificationStatus() {
    if (Notification.permission === 'granted') {
        notificationPermission = true;
        updateNotificationButton(true);
    } else {
        notificationPermission = false;
        updateNotificationButton(false);
    }
}

// ========== TEMA YÖNETİMİ ==========
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const select = document.getElementById('themeSelect');
    if (select) select.value = theme;
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

// ========== GRAFİK ==========
async function grafikGuncelle() {
    const canvas = document.getElementById('hareketGrafik');
    if (!canvas) return;
    try {
        const bugun = new Date();
        const son7Gun = new Date();
        son7Gun.setDate(bugun.getDate() - 7);
        son7Gun.setHours(0,0,0,0);
        
        const snap = await getDocs(query(
            collection(db, "hareketler"),
            where("tarih", ">=", Timestamp.fromDate(son7Gun))
        ));
        
        const gunluk = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(bugun);
            d.setDate(d.getDate() - i);
            d.setHours(0,0,0,0);
            const key = d.toISOString().slice(0,10);
            gunluk[key] = { giris: 0, cikis: 0 };
        }
        
        snap.forEach(d => {
            const h = d.data();
            const tarih = h.tarih?.toDate();
            if (!tarih) return;
            const key = tarih.toISOString().slice(0,10);
            if (gunluk[key]) {
                if (h.tur === 'giris') gunluk[key].giris += h.miktar;
                else gunluk[key].cikis += h.miktar;
            }
        });
        
        const labels = Object.keys(gunluk).sort();
        const girisData = labels.map(k => gunluk[k].giris);
        const cikisData = labels.map(k => gunluk[k].cikis);
        
        if (grafik) grafik.destroy();
        
        const ctx = canvas.getContext('2d');
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text');
        const textSecondary = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
        
        grafik = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(d => d.slice(5)),
                datasets: [
                    {
                        label: 'Giriş',
                        data: girisData,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46,204,113,0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Çıkış',
                        data: cikisData,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231,76,60,0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: textColor }
                    }
                },
                scales: {
                    x: { ticks: { color: textSecondary } },
                    y: { ticks: { color: textSecondary } }
                }
            }
        });
    } catch(e) {
        console.error('Grafik hatası:', e);
    }
}

// ================================================================
// KİMLİK DOĞRULAMA VE KULLANICI YÖNETİMİ
// ================================================================

// ========== GİRİŞ / KAYIT ==========
async function kullaniciGiris() {
    const email = document.getElementById('loginEmail')?.value;
    const sifre = document.getElementById('loginPassword')?.value;
    if (!email || !sifre) return showToast("E-posta ve şifre girin!", true);
    saveRememberMe(email);
    try {
        await signInWithEmailAndPassword(auth, email, sifre);
    } catch (e) {
        showToast(getFriendlyErrorMessage(e), true);
    }
}

async function kullaniciKayit() {
    const email = document.getElementById('registerEmail')?.value;
    const sifre = document.getElementById('registerPassword')?.value;
    if (!email || !sifre) return showToast("E-posta ve şifre girin!", true);
    if (sifre.length < 6) return showToast("Şifre en az 6 karakter!", true);
    try {
        const kullanicilarSnap = await getDocs(collection(db, "kullanicilar"));
        const ilkKullanici = kullanicilarSnap.empty;
        const userCredential = await createUserWithEmailAndPassword(auth, email, sifre);
        await sendEmailVerification(userCredential.user);
        let rol = ilkKullanici ? "admin" : "personel";
        let durum = ilkKullanici ? "aktif" : "beklemede";
        await setDoc(doc(db, "kullanicilar", userCredential.user.uid), {
            email: email,
            rol: rol,
            durum: durum,
            kayitTarihi: Timestamp.now()
        });
        await signOut(auth);
        showToast(ilkKullanici ? "🎉 İlk kullanıcı ADMIN! Email doğrulayın." : "✅ Kayıt başarılı! Admin onayı bekliyor.");
        switchLoginTab('giris');
    } catch (e) {
        showToast(getFriendlyErrorMessage(e), true);
    }
}

async function kullaniciCikis() {
    localStorage.removeItem('stokSepet');
    sepet = [];
    if (inaktiviteTimeout) clearTimeout(inaktiviteTimeout);
    await signOut(auth);
    window.location.reload();
}

function switchLoginTab(tab) {
    const girisForm = document.getElementById('girisForm');
    const kayitForm = document.getElementById('kayitForm');
    const girisTab = document.getElementById('girisTab');
    const kayitTab = document.getElementById('kayitTab');
    if (girisForm) girisForm.classList.remove('active');
    if (kayitForm) kayitForm.classList.remove('active');
    if (girisTab) girisTab.classList.remove('active');
    if (kayitTab) kayitTab.classList.remove('active');
    if (tab === 'giris') {
        if (girisForm) girisForm.classList.add('active');
        if (girisTab) girisTab.classList.add('active');
    } else if (tab === 'kayit') {
        if (kayitForm) kayitForm.classList.add('active');
        if (kayitTab) kayitTab.classList.add('active');
    } else {
        if (girisForm) girisForm.classList.add('active');
        if (girisTab) girisTab.classList.add('active');
    }
}

// ========== FCM SETUP ==========
function setupFCM() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.log('FCM: Bildirimler desteklenmiyor');
        return;
    }
    
    if (Notification.permission !== 'granted') return;
    
    const vapidKey = 'BC93ET2YlPin9VMIhJVD7KpiSETd5MFtDUlTw_6LSQM7CioDDbeh48bIXRz8XAEB2mqFRsh49SRsT9vEQ1arWNY';
    
    getToken(messaging, { vapidKey: vapidKey })
        .then(token => {
            console.log('FCM Token:', token);
        })
        .catch(err => {
            console.warn('FCM token alınamadı:', err);
            if (fcmRetryCount < MAX_FCM_RETRY) {
                fcmRetryCount++;
                setTimeout(setupFCM, 5000 * fcmRetryCount);
            }
        });
    
    onMessage(messaging, (payload) => {
        console.log('FCM mesajı alındı:', payload);
        showToast(payload.notification?.title + ': ' + payload.notification?.body);
    });
}

function checkForUpdates() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            reg.update();
        });
    }
}

// ========== ŞİFRE SIFIRLAMA ==========
function sifreSifirlamaFormuGoster() {
    const modal = document.getElementById('sifreSifirlamaModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('sifreSifirlamaEmail').value = '';
        document.getElementById('sifreSifirlamaEmail').focus();
    }
}

function sifreSifirlamaModalKapat() {
    const modal = document.getElementById('sifreSifirlamaModal');
    if (modal) modal.style.display = 'none';
}

async function sifreSifirlamaGonder() {
    const email = document.getElementById('sifreSifirlamaEmail')?.value.trim();
    if (!email) {
        showToast("❌ Lütfen e-posta adresinizi girin!", true);
        document.getElementById('sifreSifirlamaEmail').focus();
        return;
    }
    if (!email.includes('@') || !email.includes('.')) {
        showToast("❌ Geçerli bir e-posta adresi girin!", true);
        document.getElementById('sifreSifirlamaEmail').focus();
        return;
    }
    try {
        const btn = document.querySelector('#sifreSifirlamaModal button:first-child');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Gönderiliyor...';
        }
        await sendPasswordResetEmail(auth, email);
        showToast(`✅ Şifre sıfırlama bağlantısı ${email} adresine gönderildi!`);
        sifreSifirlamaModalKapat();
    } catch (error) {
        console.error('Şifre sıfırlama hatası:', error);
        showToast(getFriendlyErrorMessage(error), true);
    } finally {
        const btn = document.querySelector('#sifreSifirlamaModal button:first-child');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📧 Bağlantı Gönder';
        }
    }
}

// ========== AUTH STATE ==========
onAuthStateChanged(auth, async (user) => {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if (!loginScreen || !mainApp) return;

    if (user) {
        mevcutKullanici = user;
        if (!user.emailVerified) {
            await signOut(auth);
            loginScreen.style.display = 'flex';
            mainApp.style.display = 'none';
            showToast("Email doğrulayın!", true);
            return;
        }
        const q = query(collection(db, "kullanicilar"), where("email", "==", user.email));
        const snap = await getDocs(q);
        if (snap.empty) {
            await signOut(auth);
            showToast("Kullanıcı bulunamadı!", true);
            return;
        }
        const userData = snap.docs[0].data();
        mevcutRol = userData.rol;
        mevcutDurum = userData.durum;
        if (mevcutDurum !== 'aktif') {
            await signOut(auth);
            showToast(mevcutDurum === 'beklemede' ? "Hesabınız onaylanmadı!" : "Hesabınız engellenmiş!", true);
            return;
        }
        document.getElementById('userName').innerText = user.email.split('@')[0];
        document.getElementById('userRole').innerText = mevcutRol;
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';

        oturumZamanAsimiBaslat();
        checkForUpdates();
        if (adminMi()) kullaniciListesiniGetir();
        verileriGetir();
        siparisleriListele();
        checkNotificationStatus();
        loadTheme();
        sepetiYukle();
        dashboardWidgetlariYukle();
        loadQuickNavPosition();
        setupFCM();

        document.querySelectorAll('.quick-nav-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tab = this.dataset.tab;
                if (tab) switchTab(tab);
            });
        });

        window.addEventListener('hashchange', function() {
            const hash = window.location.hash.replace('#', '');
            if (hash) {
                const tab = document.getElementById(hash);
                if (tab) switchTab(hash);
            }
        });

        if (window.location.hash) {
            const hash = window.location.hash.replace('#', '');
            if (document.getElementById(hash)) {
                setTimeout(() => switchTab(hash), 100);
            }
        }

        try {
            await logEkle('giris', 'Kullanıcı giriş yaptı');
        } catch (e) {
            console.warn('Giriş logu eklenemedi:', e.message);
        }

    } else {
        mevcutKullanici = null;
        mevcutRol = null;
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
        if (inaktiviteTimeout) clearTimeout(inaktiviteTimeout);
        loadRememberMe();
        try {
            await logEkle('cikis', 'Kullanıcı çıkış yaptı');
        } catch (e) {
            console.warn('Çıkış logu eklenemedi:', e.message);
        }
    }
});

// ================================================================
// LOG GÖSTERİMİ
// ================================================================
async function loglariGetir() {
    const tbody = document.getElementById('logTabloGovde');
    if (!tbody) return;
    try {
        showLoading('Loglar yükleniyor...');
        let q = query(collection(db, "logs"), orderBy("tarih", "desc"), limit(LOG_LIMIT));
        if (logFiltre !== 'hepsi') {
            q = query(q, where("islem", "==", logFiltre));
        }
        const snap = await getDocs(q);
        tbody.innerHTML = "";
        if (snap.empty) {
            tbody.innerHTML = `
                <tr><td colspan="4">
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <h4>Hiç log kaydı yok</h4>
                        <p>Sistem aktiviteleri burada görünecek.</p>
                    </div>
                </td></tr>
            `;
            document.getElementById('logSayac').innerHTML = '📊 <strong>0</strong> kayıt';
            hideLoading();
            return;
        }
        let html = "";
        snap.forEach(d => {
            const log = d.data();
            const tarih = log.tarih?.toDate().toLocaleString('tr-TR') || '-';
            if (logArama && !log.kullanici.toLowerCase().includes(logArama.toLowerCase()) && 
                !log.detay.toLowerCase().includes(logArama.toLowerCase())) {
                return;
            }
            const islemEtiketi = log.islem.replace('_', ' ').toUpperCase();
            html += `
                <tr>
                    <td style="padding:8px 12px; font-size:12px; color:#888;">${tarih}</td>
                    <td style="padding:8px 12px; font-weight:500;">${log.kullanici}</td>
                    <td style="padding:8px 12px;">
                        <span style="background:var(--btn-primary); color:white; padding:2px 10px; border-radius:12px; font-size:11px;">${islemEtiketi}</span>
                    </td>
                    <td style="padding:8px 12px; font-size:13px;">${log.detay}</td>
                </tr>
            `;
        });
        if (html === "") {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888; padding:20px;">🔍 Arama sonucu bulunamadı</td></tr>';
        } else {
            tbody.innerHTML = html;
        }
        document.getElementById('logSayac').innerHTML = `📊 <strong>${snap.size}</strong> kayıt`;
        hideLoading();
    } catch(e) {
        console.error('Log getirme hatası:', e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--btn-danger); padding:20px;">❌ Loglar yüklenirken hata oluştu</td></tr>';
        hideLoading();
    }
}

function loglariFiltrele() {
    logFiltre = document.getElementById('logFiltreIslem')?.value || 'hepsi';
    logArama = document.getElementById('logArama')?.value || '';
    loglariGetir();
}

function logSayfaDegistir(yon) {
    logSayfa = Math.max(0, logSayfa + yon);
    loglariGetir();
}

async function loglariTemizle() {
    if (!adminMi()) {
        showToast('Bu işlemi yapmak için admin yetkisi gerekli.', true);
        return;
    }
    const confirmed = await showConfirm('⚠️ Logları Temizle', 'Tüm log kayıtları silinecek. Devam etmek istediğinize emin misiniz?');
    if (!confirmed) return;
    try {
        const snap = await getDocs(collection(db, 'logs'));
        const silinecek = snap.docs.map(d => d.ref);
        for (const ref of silinecek) {
            await deleteDoc(ref);
        }
        showToast('✅ Tüm loglar temizlendi.');
        loglariGetir();
    } catch (e) {
        console.error('Log temizleme hatası:', e);
        showToast(getFriendlyErrorMessage(e), true);
    }
}

// ================================================================
// KULLANICI YÖNETİMİ
// ================================================================
async function adminKullaniciOnayla(userId, yeniDurum, yeniRol = null) {
    if (!adminMi()) return showToast("Admin yetkisi gerekli!", true);
    const guncelleme = { durum: yeniDurum };
    if (yeniRol) guncelleme.rol = yeniRol;
    await updateDoc(doc(db, "kullanicilar", userId), guncelleme);
    showToast("Kullanıcı durumu güncellendi");
    kullaniciListesiniGetir();
}

async function adminKullaniciEkle() {
    if (!adminMi()) {
        showToast("Admin yetkisi gerekli!", true);
        return;
    }
    const emailInput = document.getElementById('yeniKullaniciEmail');
    const sifreInput = document.getElementById('yeniKullaniciSifre');
    const rolSelect = document.getElementById('yeniKullaniciRol');
    const email = emailInput?.value.trim();
    const sifre = sifreInput?.value;
    const rol = rolSelect?.value || 'personel';
    if (!email) {
        showToast("E-posta adresi girin!", true);
        emailInput.focus();
        return;
    }
    if (!sifre || sifre.length < 6) {
        showToast("Şifre en az 6 karakter olmalı!", true);
        sifreInput.focus();
        return;
    }
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, sifre);
        const user = userCredential.user;
        await sendEmailVerification(user);
        const userData = {
            email: email,
            rol: rol,
            durum: "aktif",
            kayitTarihi: Timestamp.now(),
            createdBy: mevcutKullanici?.email || 'Admin'
        };
        await setDoc(doc(db, "kullanicilar", user.uid), userData);
        showToast(`✅ ${email} başarıyla eklendi! Doğrulama maili gönderildi.`);
        await kullaniciListesiniGetir();
        emailInput.value = "";
        sifreInput.value = "";
        rolSelect.value = "personel";
    } catch (e) {
        console.error("❌ Admin kullanıcı ekleme hatası:", e);
        showToast(getFriendlyErrorMessage(e), true);
    }
}

async function kullaniciListesiniGetir() {
    if (!adminMi()) return;
    const listeDiv = document.getElementById('kullaniciListesi');
    if (!listeDiv) return;
    try {
        showLoading('Kullanıcılar yükleniyor...');
        const snap = await getDocs(collection(db, "kullanicilar"));
        if (snap.empty) {
            listeDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👤</div>
                    <h4>Henüz kayıtlı kullanıcı yok</h4>
                    <p>İlk kullanıcıyı eklemek için yukarıdaki formu kullanın.</p>
                </div>
            `;
            hideLoading();
            return;
        }
        let toplam = 0;
        let html = `
            <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:13px;">
                <thead>
                    <tr style="border-bottom:2px solid var(--card-border);">
                        <th style="text-align:left; padding:8px;">E-posta</th>
                        <th style="text-align:left; padding:8px;">Rol</th>
                        <th style="text-align:left; padding:8px;">Durum</th>
                        <th style="text-align:left; padding:8px;">İşlem</th>
                    </tr>
                </thead>
                <tbody>
        `;
        snap.forEach(d => {
            toplam++;
            const data = d.data();
            const durumRenk = data.durum === 'aktif' ? 'var(--btn-success)' : (data.durum === 'beklemede' ? 'var(--btn-warning)' : 'var(--btn-danger)');
            const durumText = data.durum === 'beklemede' ? '⏳ Beklemede' : (data.durum === 'aktif' ? '✅ Aktif' : '🚫 Engelli');
            html += `
                <tr style="border-bottom:1px solid var(--card-border);">
                    <td style="padding:8px;">${data.email}</td>
                    <td style="padding:8px;">
                        <span style="background:var(--btn-primary); color:white; padding:2px 8px; border-radius:12px; font-size:11px;">${data.rol}</span>
                    </td>
                    <td style="padding:8px; color:${durumRenk}; font-weight:bold;">${durumText}</td>
                    <td style="padding:8px;">
                        ${data.durum === 'beklemede' ? `
                            <button onclick="adminKullaniciOnayla('${d.id}', 'aktif', 'personel')" style="background:var(--btn-success); color:white; border:none; border-radius:5px; padding:5px 10px; margin-right:5px; cursor:pointer;">✅ Onayla</button>
                            <button onclick="adminKullaniciOnayla('${d.id}', 'reddedildi')" style="background:var(--btn-danger); color:white; border:none; border-radius:5px; padding:5px 10px; cursor:pointer;">❌ Reddet</button>
                        ` : ''}
                        ${data.durum === 'aktif' ? `
                            <button onclick="adminKullaniciOnayla('${d.id}', 'engelli')" style="background:var(--btn-danger); color:white; border:none; border-radius:5px; padding:5px 10px; margin-right:5px; cursor:pointer;">🚫 Engelle</button>
                        ` : ''}
                        ${data.durum === 'engelli' ? `
                            <button onclick="adminKullaniciOnayla('${d.id}', 'aktif')" style="background:var(--btn-success); color:white; border:none; border-radius:5px; padding:5px 10px; margin-right:5px; cursor:pointer;">🔓 Aktif Et</button>
                        ` : ''}
                        <select onchange="adminKullaniciOnayla('${d.id}', 'aktif', this.value)" style="padding:4px 8px; border-radius:4px; background:var(--input-bg); color:var(--text); border:1px solid var(--card-border); margin-top:5px; cursor:pointer;">
                            <option value="">Rol Değiştir</option>
                            <option value="admin">Admin</option>
                            <option value="yonetici">Yönetici</option>
                            <option value="personel">Personel</option>
                            <option value="goruntuleyici">Görüntüleyici</option>
                        </select>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        html += `
            <div style="margin-top:12px; padding:10px; background:var(--card-border); border-radius:8px; text-align:center; font-weight:600; color:var(--text);">
                👥 Toplam ${toplam} kullanıcı
            </div>
        `;
        listeDiv.innerHTML = html;
        hideLoading();
    } catch(e) {
        console.error("Kullanıcı listesi getirme hatası:", e);
        listeDiv.innerHTML = '<p style="color:var(--btn-danger);">Liste yüklenirken hata oluştu.</p>';
        hideLoading();
    }
}

// ================================================================
// ANA UYGULAMA - VERİ YÖNETİMİ
// ================================================================

// ========== STOK LİSTESİ ==========
function stoklariListele() {
    const tbody = document.getElementById('tablo');
    if (!tbody) {
        console.warn('⚠️ #tablo elementi bulunamadı!');
        return;
    }
    let html = "", toplam = 0, kritikSay = 0;
    let gruplar_temp = {};
    Object.values(stoklar).forEach(u => {
        const g = u.grup || "Genel";
        if (!gruplar_temp[g]) gruplar_temp[g] = [];
        gruplar_temp[g].push(u);
    });
    Object.keys(gruplar_temp).sort().forEach((grup, idx) => {
        const grupId = `grup-${idx}`;
        html += `<tr onclick="window.grupToggle('${grupId}')" style="background:var(--btn-warning); cursor:pointer;">
                    <td colspan="3"><b>📂 ${grup}</b></td>
                 </tr>`;
        gruplar_temp[grup].forEach(u => {
            const m = u.kalan || 0, k = u.kritik || 5;
            toplam += m;
            if (m <= k) kritikSay++;
            html += `<tr class="${grupId}" onclick="window.urunDetayGoster('${u.id}')" style="display:none; cursor:pointer;">
                        <td style="padding-left:20px;">${getUrunAdi(u)}<br><small style="color:#888">${u.barkod || '-'}</small></td>
                        <td style="color:${m <= k ? 'var(--kritik-text)' : ''}"><b>${m}</b> ${u.birim || 'Adet'}</td>
                        <td>${yoneticiMi() ? `<button onclick="event.stopPropagation(); window.urunSil('${u.id}')" style="background:var(--btn-danger); color:white; border:none; border-radius:20px; padding:6px 12px;">✖</button>` : ''}</td>
                    </tr>`;
        });
    });
    html += `<tr style="background:var(--btn-dark); font-weight:700; border-top:2px solid var(--text);">
        <td style="padding:10px 12px; color:var(--text);">📊 TOPLAM</td>
        <td style="padding:10px 12px; text-align:center; color:var(--text);">${toplam}</td>
        <td></td>
    </tr>`;
    tbody.innerHTML = html;
    
    const dashToplam = document.getElementById('dashToplamStok');
    if (dashToplam) dashToplam.innerHTML = `<div>${toplam}</div>`;
    
    const dashKritik = document.getElementById('dashKritik');
    if (dashKritik) dashKritik.innerHTML = `<div>${kritikSay}</div>`;
}

// ========== BADGE GÜNCELLEME ==========
function badgeGuncelle() {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    const badge = document.getElementById('kritikBadge');
    if (badge) {
        if (kritikler.length > 0) {
            badge.textContent = kritikler.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// ========== KRİTİK LİSTE WIDGET ==========
function kritikListeWidgetGuncelle() {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    const container = document.getElementById('dashKritikListe');
    if (!container) return;
    
    if (kritikler.length === 0) {
        container.innerHTML = '<div style="color:var(--text-secondary); font-size:13px;">✅ Kritik ürün yok</div>';
        return;
    }
    
    container.innerHTML = kritikler.slice(0, 5).map(u => 
        `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:13px; border-bottom:1px solid var(--border);">
            <span>${getUrunAdi(u)}</span>
            <span style="color:var(--danger); font-weight:600;">${u.kalan}/${u.kritik}</span>
        </div>`
    ).join('');
    
    if (kritikler.length > 5) {
        container.innerHTML += `<div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">+ ${kritikler.length - 5} daha...</div>`;
    }
}

// ========== KRİTİK KONTROL ==========
function kritikKontrol() {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    const panel = document.getElementById('kritikPanel');
    const liste = document.getElementById('kritikListe');
    if (kritikler.length > 0) {
        if (panel) panel.style.display = 'block';
        if (liste) {
            liste.innerHTML = kritikler.map(u => `<li><strong>${getUrunAdi(u)}</strong>: Stok ${u.kalan} ${u.birim || 'Adet'} / Kritik ${u.kritik}</li>`).join('');
        }
        const now = Date.now();
        if (now - _lastNotificationTime > 60000) {
            const ilk = kritikler[0];
            window.sendNotification(
                '⚠️ Kritik Stok Uyarısı!',
                `${kritikler.length} ürün kritik seviyede. İlk: ${getUrunAdi(ilk)} (Stok: ${ilk.kalan})`,
                '/'
            );
            playAlertSound();
            vibrateDevice();
            _lastNotificationTime = now;
        }
    } else {
        if (panel) panel.style.display = 'none';
    }
    kritikListeWidgetGuncelle();
    badgeGuncelle();
}

// ========== VERİLERİ GETİR ==========
function verileriGetir() {
    onSnapshot(collection(db, "stoklar"), async (snap) => {
        console.log('📦 Stok verileri geldi, doküman sayısı:', snap.size);
        
        stoklar = {};
        const select = document.getElementById("urunSelect");
        if (select) {
            select.innerHTML = '<option value="">Ürün Seçin</option>';
        }
        snap.forEach(d => {
            const data = d.data();
            stoklar[d.id] = { id: d.id, ...data, kalan: data.kalan || 0, kritik: data.kritik || 5 };
            if (select) {
                const opt = document.createElement("option");
                opt.value = d.id;
                opt.textContent = `${getUrunAdi(data)}${data.barkod ? ' (' + data.barkod + ')' : ''}`;
                select.appendChild(opt);
            }
        });
        
        console.log('✅ Stoklar yüklendi, toplam:', Object.keys(stoklar).length);
        
        stoklariListele();
        hareketleriListele({});
        kritikKontrol();
        bugunOzetiniGetir();
        popularesiGetir();
        
        console.log('🔍 Gruplar yükleniyor...');
        await gruplariGetir();
        console.log('✅ Gruplar yüklendi');
        
        kritikListeWidgetGuncelle();
        badgeGuncelle();
        grafikGuncelle();
        dashboardWidgetVerileriniGuncelle();
    }, (error) => {
        console.error('❌ Stok verileri dinlenirken hata:', error);
    });
}

// ================================================================
// GRUP YÖNETİMİ
// ================================================================
async function gruplariGetir() {
    try {
        console.log('🔍 Gruplar getiriliyor...');
        const snap = await getDocs(collection(db, "gruplar"));
        console.log('📦 Grup doküman sayısı:', snap.size);
        
        gruplar = {};
        snap.forEach(d => {
            console.log('📁 Grup bulundu:', d.id, d.data());
            gruplar[d.id] = { id: d.id, ...d.data() };
        });
        
        console.log('✅ Toplam grup:', Object.keys(gruplar).length);
        
        grupListesiniGoster();
        grupSelectleriGuncelle();
        grupSelectleriDoldur();
        return gruplar;
    } catch(e) {
        console.error('❌ Gruplar getirilirken hata:', e);
        const liste = document.getElementById('grupListesi');
        if (liste) {
            liste.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h4>Gruplar yüklenirken hata oluştu</h4>
                    <p>${e.message}</p>
                </div>
            `;
        }
        return {};
    }
}

function grupSelectleriDoldur() {
    const select = document.getElementById('aramaGrup');
    if (!select) return;
    select.innerHTML = '<option value="">Tüm Gruplar</option>';
    Object.values(gruplar).sort((a,b) => a.ad.localeCompare(b.ad)).forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.ad;
        opt.textContent = g.ad;
        select.appendChild(opt);
    });
}

function grupListesiniGoster() {
    const liste = document.getElementById('grupListesi');
    if (!liste) return;
    
    const keys = Object.keys(gruplar);
    let toplamUrun = 0;
    let html = '';
    
    if (keys.length === 0) {
        html = `
            <div class="empty-state">
                <div class="empty-icon">📁</div>
                <h4>Henüz grup oluşturulmamış</h4>
                <p>"Yeni Grup" butonuna tıklayarak ilk grubunuzu oluşturun.</p>
            </div>
        `;
    } else {
        keys.sort().forEach(id => {
            const g = gruplar[id];
            const urunSayisi = Object.values(stoklar).filter(u => u.grup === g.ad).length;
            toplamUrun += urunSayisi;
            html += `
                <div style="background:var(--bg-card); border-radius:16px; padding:16px; border:1px solid var(--border); margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <div style="font-weight:600; font-size:16px;">📁 ${g.ad}</div>
                            ${g.aciklama ? `<div style="font-size:12px; color:#888; margin-top:4px;">${g.aciklama}</div>` : ''}
                            <div style="font-size:12px; color:#666; margin-top:8px;">${urunSayisi} ürün</div>
                        </div>
                        <div style="display:flex; gap:4px;">
                            <button onclick="window.grupDuzenle('${id}')" style="background:var(--btn-primary); color:white; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; font-size:14px;">✏️</button>
                            <button onclick="window.grupSil('${id}')" style="background:var(--btn-danger); color:white; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; font-size:14px;">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
            <div style="margin-top:16px; padding:12px; background:var(--bg-secondary); border-radius:12px; text-align:center; font-weight:600; color:var(--text);">
                📊 Toplam ${keys.length} grup · ${toplamUrun} ürün
            </div>
        `;
    }
    liste.innerHTML = html;
}

function grupSelectleriGuncelle() {
    const selects = document.querySelectorAll('.grupSelect, #modalGrup, #urunGrupSelect, #aramaGrup');
    selects.forEach(select => {
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="Genel">Genel</option>';
        Object.values(gruplar).sort((a,b) => a.ad.localeCompare(b.ad)).forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.ad;
            opt.textContent = g.ad;
            select.appendChild(opt);
        });
        if (currentValue && [...select.options].some(o => o.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

function grupEkleFormuGoster() {
    document.getElementById('grupModalBaslik').textContent = '📁 Yeni Grup';
    document.getElementById('grupDuzenleId').value = '';
    document.getElementById('grupAdi').value = '';
    document.getElementById('grupAciklama').value = '';
    document.getElementById('grupModal').style.display = 'flex';
    document.getElementById('grupAdi').focus();
}

function grupDuzenle(id) {
    const g = gruplar[id];
    if (!g) return showToast('Grup bulunamadı!', true);
    document.getElementById('grupModalBaslik').textContent = '✏️ Grup Düzenle';
    document.getElementById('grupDuzenleId').value = id;
    document.getElementById('grupAdi').value = g.ad;
    document.getElementById('grupAciklama').value = g.aciklama || '';
    document.getElementById('grupModal').style.display = 'flex';
    document.getElementById('grupAdi').focus();
}

function grupModalKapat() {
    document.getElementById('grupModal').style.display = 'none';
}

async function grupKaydet() {
    const id = document.getElementById('grupDuzenleId').value;
    const ad = document.getElementById('grupAdi').value.trim();
    const aciklama = document.getElementById('grupAciklama').value.trim();
    if (!ad) {
        showToast('❌ Lütfen grup adı girin!', true);
        document.getElementById('grupAdi').focus();
        return;
    }
    const exists = Object.values(gruplar).some(g => g.ad === ad && g.id !== id);
    if (exists) {
        showToast('❌ Bu isimde bir grup zaten var!', true);
        document.getElementById('grupAdi').focus();
        return;
    }
    try {
        const data = { ad, aciklama: aciklama || '' };
        if (id) {
            await updateDoc(doc(db, "gruplar", id), data);
            showToast('✅ Grup güncellendi!');
        } else {
            await addDoc(collection(db, "gruplar"), data);
            showToast('✅ Grup oluşturuldu!');
        }
        await logEkle(id ? 'grup_guncelle' : 'grup_ekle', `Grup: ${ad}`, { grupAd: ad });
        grupModalKapat();
        await gruplariGetir();
        stoklariListele();
    } catch(e) {
        console.error('Grup kaydetme hatası:', e);
        showToast(getFriendlyErrorMessage(e), true);
    }
}

async function grupSil(id) {
    const g = gruplar[id];
    if (!g) return showToast('Grup bulunamadı!', true);
    const urunSayisi = Object.values(stoklar).filter(u => u.grup === g.ad).length;
    if (urunSayisi > 0) {
        const confirmed = await showConfirm(
            `⚠️ "${g.ad}" grubu sil`,
            `Bu grupta ${urunSayisi} ürün var. Silmek istediğinize emin misiniz?\n\nÜrünler "Genel" grubuna taşınacak.`
        );
        if (!confirmed) return;
        const batch = writeBatch(db);
        Object.values(stoklar).filter(u => u.grup === g.ad).forEach(u => {
            batch.update(doc(db, "stoklar", u.id), { grup: 'Genel' });
        });
        await batch.commit();
    }
    try {
        await deleteDoc(doc(db, "gruplar", id));
        showToast(`✅ "${g.ad}" grubu silindi!`);
        await logEkle('grup_sil', `Grup: ${g.ad} silindi`, { grupAd: g.ad });
        await gruplariGetir();
        stoklariListele();
    } catch(e) {
        console.error('Grup silme hatası:', e);
        showToast(getFriendlyErrorMessage(e), true);
    }
}

function gruplariFiltrele() {
    const arama = document.getElementById('grupArama')?.value.toLowerCase() || '';
    const cards = document.querySelectorAll('#grupListesi > div[style*="background:var(--bg-card)"]');
    cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(arama) ? '' : 'none';
    });
}

// ================================================================
// GELİŞMİŞ ARAMA
// ================================================================
function gelişmişArama() {
    const query = document.getElementById('aramaKutusu')?.value.toLowerCase() || '';
    const grup = document.getElementById('aramaGrup')?.value || '';
    const barkod = document.getElementById('aramaBarkod')?.value.toLowerCase() || '';
    
    document.querySelectorAll('#tablo tr').forEach(r => {
        if (r.classList.length === 0 || r.classList[0]?.startsWith('grup-') || r.style.background === 'var(--btn-dark)') {
            r.style.display = '';
            return;
        }
        const text = r.innerText.toLowerCase();
        const grupMatch = !grup || text.includes(grup.toLowerCase());
        const barkodMatch = !barkod || text.includes(barkod);
        const queryMatch = !query || text.includes(query);
        r.style.display = (queryMatch && grupMatch && barkodMatch) ? '' : 'none';
    });
}

function aramaTemizle() {
    document.getElementById('aramaKutusu').value = '';
    document.getElementById('aramaBarkod').value = '';
    document.getElementById('aramaGrup').value = '';
    gelişmişArama();
}

// ================================================================
// HAREKETLER
// ================================================================
async function hareketleriListele(filters = {}) {
    const tbody = document.getElementById('hareketlerTablo');
    if (!tbody) return;
    
    if (hareketlerUnsubscribe) {
        hareketlerUnsubscribe();
        hareketlerUnsubscribe = null;
    }
    
    try {
        showLoading('Hareketler yükleniyor...');
        let q = query(collection(db, "hareketler"), orderBy("tarih", "desc"));
        if (filters.baslangic) {
            const start = new Date(filters.baslangic);
            start.setHours(0,0,0,0);
            q = query(q, where("tarih", ">=", Timestamp.fromDate(start)));
        }
        if (filters.bitis) {
            const end = new Date(filters.bitis);
            end.setHours(23,59,59,999);
            q = query(q, where("tarih", "<=", Timestamp.fromDate(end)));
        }
        q = query(q, limit(500));
        
        hareketlerUnsubscribe = onSnapshot(q, (snap) => {
            let docs = snap.docs;
            if (filters.urunFiltre) {
                const lower = filters.urunFiltre.toLowerCase();
                docs = docs.filter(d => {
                    const urun = d.data().urun || '';
                    return urun.toLowerCase().includes(lower);
                });
            }
            if (docs.length === 0) {
                tbody.innerHTML = `
                    <tr><td colspan="5">
                        <div class="empty-state">
                            <div class="empty-icon">🕒</div>
                            <h4>Hareket yok</h4>
                            <p>Filtreye uygun hareket bulunamadı.</p>
                        </div>
                    </td></tr>
                `;
                hideLoading();
                return;
            }
            let html = '';
            let toplamGiris = 0, toplamCikis = 0;
            docs.forEach(d => {
                const h = d.data();
                const id = d.id;
                if (h.tur === 'giris') toplamGiris += h.miktar;
                else toplamCikis += h.miktar;
                const isAdmin = adminMi();
                html += `<tr>
                    <td style="font-size:12px;">${h.tarih?.toDate().toLocaleString('tr-TR') || '-'}</td>
                    <td>${h.urun || '-'}</td>
                    <td><b>${h.miktar}</b> ${h.birim || ''}</td>
                    <td style="color:${h.tur === 'giris' ? 'var(--btn-success)' : 'var(--btn-danger)'}"><b>${h.tur === 'giris' ? 'GİRİŞ' : 'ÇIKIŞ'}</b></td>
                    <td>
                        ${isAdmin ? `
                            <button onclick="window.hareketDuzenle('${id}')" style="background:var(--btn-warning); color:black; border:none; border-radius:20px; padding:4px 10px; margin-right:4px; cursor:pointer;">✏️</button>
                            <button onclick="window.hareketSil('${id}')" style="background:var(--btn-danger); color:white; border:none; border-radius:20px; padding:4px 10px; cursor:pointer;">🗑️</button>
                        ` : ''}
                    </td>
                </tr>`;
            });
            html += `<tr style="background:var(--card-border); font-weight:700; border-top:2px solid var(--text);">
                <td colspan="2" style="padding:10px 12px; color:var(--text);">📊 TOPLAM</td>
                <td style="padding:10px 12px; text-align:center; color:#2ecc71;">+${toplamGiris}</td>
                <td style="padding:10px 12px; text-align:center; color:#e74c3c;">-${toplamCikis}</td>
                <td></td>
            </tr>`;
            tbody.innerHTML = html;
            hideLoading();
        }, (error) => {
            console.error('Hareketler dinleme hatası:', error);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--btn-danger); padding:20px;">❌ Veriler yüklenirken hata oluştu</td></tr>';
            hideLoading();
        });
    } catch(e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--btn-danger); padding:20px;">❌ Hata oluştu</td></tr>';
        hideLoading();
    }
}

function hareketleriFiltrele() {
    const baslangic = document.getElementById('hareketBaslangic')?.value;
    const bitis = document.getElementById('hareketBitis')?.value;
    const urunFiltre = document.getElementById('hareketUrunFiltre')?.value.trim();
    hareketleriListele({ baslangic, bitis, urunFiltre });
}

function hareketleriTemizle() {
    document.getElementById('hareketBaslangic').value = '';
    document.getElementById('hareketBitis').value = '';
    document.getElementById('hareketUrunFiltre').value = '';
    hareketleriListele({});
}

async function hareketSil(id) {
    if (!adminMi()) return showToast("❌ Bu işlem için admin yetkisi gerekli!", true);

    const hareketSnap = await getDoc(doc(db, "hareketler", id));
    if (!hareketSnap.exists()) return showToast("Hareket bulunamadı!", true);
    const hareket = hareketSnap.data();

    let mesaj = `Bu hareketi silmek istediğinize emin misiniz?\n\n📦 ${hareket.urun || '-'}\n🔢 ${hareket.miktar} ${hareket.birim || 'Adet'}\n↕️ ${hareket.tur === 'giris' ? 'Giriş' : 'Çıkış'}`;
    if (hareket.urunId) mesaj += `\n\n⚠️ Stok miktarı da bu harekete göre düzeltilecek.`;

    const confirmed = await showConfirm('🗑️ Hareketi Sil', mesaj);
    if (!confirmed) return;

    try {
        if (hareket.urunId) {
            const stokSnap = await getDoc(doc(db, "stoklar", hareket.urunId));
            if (stokSnap.exists()) {
                const mevcutStok = Number(stokSnap.data().kalan || 0);
                let yeniStok = mevcutStok;
                if (hareket.tur === 'giris') yeniStok -= Number(hareket.miktar || 0);
                else yeniStok += Number(hareket.miktar || 0);

                if (yeniStok < 0) {
                    return showToast("❌ Silme işlemi stoğu negatife düşürür! Önce stoğu düzeltin.", true);
                }

                const batch = writeBatch(db);
                batch.delete(doc(db, "hareketler", id));
                batch.update(doc(db, "stoklar", hareket.urunId), { kalan: yeniStok });
                await batch.commit();
                showToast(`✅ Hareket silindi. Stok: ${mevcutStok} → ${yeniStok}`);
            } else {
                await deleteDoc(doc(db, "hareketler", id));
                showToast("✅ Hareket silindi");
            }
        } else {
            await deleteDoc(doc(db, "hareketler", id));
            showToast("✅ Hareket silindi");
        }
        hareketleriListele({});
    } catch(e) {
        console.error('Silme hatası:', e);
        showToast(getFriendlyErrorMessage(e), true);
    }
}

async function hareketDuzenle(id) {
    if (!adminMi()) return showToast("❌ Bu işlem için admin yetkisi gerekli!", true);
    try {
        const docSnap = await getDoc(doc(db, "hareketler", id));
        if (!docSnap.exists()) return showToast("Hareket bulunamadı!", true);
        const data = docSnap.data();
        document.getElementById('hareketDuzenleId').value = id;
        document.getElementById('hareketDuzenleMiktar').value = data.miktar || 0;
        document.getElementById('hareketDuzenleTur').value = data.tur || 'giris';
        if (data.tarih) {
            const tarih = data.tarih.toDate();
            const yerelTarih = new Date(tarih.getTime() - (tarih.getTimezoneOffset() * 60000))
                .toISOString()
                .slice(0, 16);
            document.getElementById('hareketDuzenleTarih').value = yerelTarih;
        } else {
            document.getElementById('hareketDuzenleTarih').value = '';
        }
        document.getElementById('hareketDuzenleModal').style.display = 'flex';
    } catch(e) {
        console.error('Düzenleme hatası:', e);
        showToast(getFriendlyErrorMessage(e), true);
    }
}

function hareketDuzenleKapat() {
    document.getElementById('hareketDuzenleModal').style.display = 'none';
}

async function hareketDuzenleKaydet() {
    const id = document.getElementById('hareketDuzenleId').value;
    if (!id) return showToast("Hareket ID'si eksik!", true);
    const yeniMiktar = Number(document.getElementById('hareketDuzenleMiktar').value);
    const yeniTur = document.getElementById('hareketDuzenleTur').value;
    const yeniTarihInput = document.getElementById('hareketDuzenleTarih').value;

    if (!yeniMiktar || yeniMiktar < 1) {
        showToast("❌ Geçerli bir miktar girin!", true);
        return;
    }

    try {
        const hareketSnap = await getDoc(doc(db, "hareketler", id));
        if (!hareketSnap.exists()) return showToast("Hareket bulunamadı!", true);
        const eski = hareketSnap.data();

        const guncelleme = { miktar: yeniMiktar, tur: yeniTur };
        if (yeniTarihInput) guncelleme.tarih = Timestamp.fromDate(new Date(yeniTarihInput));

        // Ürün bağlantısı yoksa sadece hareketi güncelle
        if (!eski.urunId) {
            await updateDoc(doc(db, "hareketler", id), guncelleme);
            showToast("✅ Hareket güncellendi (ürün bağlantısı yok)");
            hareketDuzenleKapat();
            hareketleriListele({});
            return;
        }

        const stokSnap = await getDoc(doc(db, "stoklar", eski.urunId));
        if (!stokSnap.exists()) {
            await updateDoc(doc(db, "hareketler", id), guncelleme);
            showToast("⚠️ Ürün silinmiş, sadece hareket güncellendi");
            hareketDuzenleKapat();
            hareketleriListele({});
            return;
        }

        const mevcutStok = Number(stokSnap.data().kalan || 0);

        // 1) Eski hareketin stoğa etkisini geri al
        let yeniStok = mevcutStok;
        if (eski.tur === 'giris') yeniStok -= Number(eski.miktar || 0);
        else yeniStok += Number(eski.miktar || 0);

        // 2) Yeni hareketin etkisini uygula
        if (yeniTur === 'giris') yeniStok += yeniMiktar;
        else yeniStok -= yeniMiktar;

        if (yeniStok < 0) {
            showToast(`❌ Bu değişiklik stoğu negatife düşürür! (Sonuç: ${yeniStok})`, true);
            return;
        }

        const batch = writeBatch(db);
        batch.update(doc(db, "hareketler", id), guncelleme);
        batch.update(doc(db, "stoklar", eski.urunId), { kalan: yeniStok });
        await batch.commit();

        showToast(`✅ Hareket güncellendi. Stok: ${mevcutStok} → ${yeniStok}`);
        hareketDuzenleKapat();
        hareketleriListele({});
    } catch(e) {
        console.error('Güncelleme hatası:', e);
        showToast(getFriendlyErrorMessage(e), true);
    }
}

// ================================================================
// ÜRÜN DETAY TAB
// ================================================================
async function urunDetayGoster(id) {
    const u = stoklar[id];
    if (!u) return showToast("Ürün bulunamadı!", true);
    
    // Mevcut tab ve scroll'u kaydet
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id !== 'urun-detay') {
        oncekiTab = activeTab.id;
        oncekiScrollY = window.scrollY;
    }
    
    switchTab('urun-detay');
    document.getElementById('detayUrunAd').textContent = getUrunAdi(u);
    document.getElementById('detayUrunBarkod').textContent = u.barkod || '-';
    document.getElementById('detayUrunStok').textContent = u.kalan || 0;
    document.getElementById('detayUrunKritik').textContent = u.kritik || 5;
    document.getElementById('detayUrunGrup').textContent = u.grup || 'Genel';
    document.getElementById('detayDuzenleBtn').onclick = function() { detayGoster(id); };
    document.getElementById('detaySilBtn').onclick = function() { urunSil(id); };
    await urunHareketleriniGetir(id);
}

// YENİ FONKSİYON - Geri butonu için
function detayGeri() {
    const hedefTab = oncekiTab || 'stok-listesi';
    switchTab(hedefTab);
    setTimeout(() => {
        window.scrollTo({ top: oncekiScrollY, behavior: 'instant' });
    }, 150);
}

async function urunHareketleriniGetir(urunId) {
    const tbody = document.getElementById('detayHareketlerTablo');
    if (!tbody) return;
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("urunId", "==", urunId), orderBy("tarih", "desc")));
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;">Bu ürüne ait hareket yok</td></tr>';
            return;
        }
        let html = '';
        let toplamGiris = 0, toplamCikis = 0;
        snap.forEach(d => {
            const h = d.data();
            const id = d.id;
            if (h.tur === 'giris') toplamGiris += h.miktar;
            else toplamCikis += h.miktar;
            const isAdmin = adminMi();
            html += `<tr>
                <td style="font-size:12px;">${h.tarih?.toDate().toLocaleString('tr-TR') || '-'}</td>
                <td style="color:${h.tur === 'giris' ? 'var(--btn-success)' : 'var(--btn-danger)'}"><b>${h.tur === 'giris' ? 'GİRİŞ' : 'ÇIKIŞ'}</b></td>
                <td><b>${h.miktar}</b> ${h.birim || ''}</td>
                <td>
                    ${isAdmin ? `
                        <button onclick="window.hareketDuzenle('${id}')" style="background:var(--btn-warning); color:black; border:none; border-radius:20px; padding:4px 10px; margin-right:4px; cursor:pointer;">✏️</button>
                        <button onclick="window.hareketSil('${id}')" style="background:var(--btn-danger); color:white; border:none; border-radius:20px; padding:4px 10px; cursor:pointer;">🗑️</button>
                    ` : ''}
                </td>
            </tr>`;
        });
        html += `<tr style="background:var(--card-border); font-weight:700; border-top:2px solid var(--text);">
            <td colspan="2" style="padding:10px 12px; color:var(--text);">📊 TOPLAM</td>
            <td style="padding:10px 12px; text-align:center; color:#2ecc71;">+${toplamGiris}</td>
            <td style="padding:10px 12px; text-align:center; color:#e74c3c;">-${toplamCikis}</td>
        </tr>`;
        tbody.innerHTML = html;
    } catch(e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--btn-danger);">Hata oluştu</td></tr>';
    }
}

// ================================================================
// ÖZET FONKSİYONLARI
// ================================================================
async function bugunOzetiniGetir() {
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("tarih", ">=", Timestamp.fromDate(bugun))));
        let toplam = 0;
        snap.forEach(d => { if(d.data().tur === 'giris') toplam += d.data().miktar; });
        const dashBugunGiris = document.getElementById('dashBugunGiris');
        if (dashBugunGiris) dashBugunGiris.innerHTML = `<div>${toplam}</div>`;
    } catch(e) { console.error(e); }
}

async function bugunCikisGetir() {
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    try {
        const snap = await getDocs(collection(db, "hareketler"));
        let toplam = 0;
        snap.forEach(d => {
            const h = d.data();
            if (h.tur !== 'cikis' || !h.tarih) return;
            const tarihMs = h.tarih.toDate ? h.tarih.toDate().getTime() : new Date(h.tarih.seconds * 1000).getTime();
            if (tarihMs >= bugun.getTime()) toplam += Number(h.miktar || 0);
        });
        const dashBugunCikis = document.getElementById('dashBugunCikis');
        if (dashBugunCikis) dashBugunCikis.innerHTML = `<div>${toplam}</div>`;
    } catch(e) { console.error('Bugün çıkış hatası:', e); }
}

async function popularesiGetir() {
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("tur", "==", "cikis"), limit(500)));
        const sayilar = {};
        snap.forEach(d => { const ad = d.data().urun || "Bilinmeyen"; sayilar[ad] = (sayilar[ad] || 0) + (d.data().miktar || 1); });
        let populerAd = "-", max = 0;
        for (let [ad, adet] of Object.entries(sayilar)) {
            if (adet > max) { max = adet; populerAd = ad; }
        }
        const dashPopuler = document.getElementById('dashPopuler');
        if (dashPopuler) dashPopuler.innerText = populerAd !== "-" ? `${populerAd} (${max})` : "-";
    } catch(e) {
        const dashPopuler = document.getElementById('dashPopuler');
        if (dashPopuler) dashPopuler.innerText = "-";
    }
}

async function sonHareketleriGetir() {
    const container = document.getElementById('dashSonHareketler');
    if (!container) return;
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), orderBy("tarih", "desc"), limit(5)));
        if (snap.empty) {
            container.innerHTML = '<div style="color:var(--text-secondary); font-size:13px;">Hareket yok</div>';
            return;
        }
        container.innerHTML = snap.docs.map(d => {
            const h = d.data();
            const saat = h.tarih?.toDate().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}) || '';
            const islem = h.tur === 'giris' ? '📥' : '📤';
            return `<div style="display:flex; justify-content:space-between; font-size:13px; padding:2px 0;">${islem} ${h.urun} <span style="color:var(--text-secondary);">${h.miktar} ${saat}</span></div>`;
        }).join('');
    } catch(e) { console.error('Son hareketler hatası:', e); }
}

async function siparisSayisiniGetir() {
    try {
        const snap = await getDocs(collection(db, "siparisler"));
        const dashSiparisSayisi = document.getElementById('dashSiparisSayisi');
        if (dashSiparisSayisi) dashSiparisSayisi.innerHTML = `<div>${snap.size}</div>`;
    } catch(e) { console.error('Sipariş sayısı hatası:', e); }
}

async function kullaniciSayisiniGetir() {
    try {
        const snap = await getDocs(collection(db, "kullanicilar"));
        const dashKullaniciSayisi = document.getElementById('dashKullaniciSayisi');
        if (dashKullaniciSayisi) dashKullaniciSayisi.innerHTML = `<div>${snap.size}</div>`;
    } catch(e) { console.error('Kullanıcı sayısı hatası:', e); }
}

// ================================================================
// TOPLU ÜRÜN EKLEME (EXCEL)
// ================================================================
async function excelUrunleriYukle() {
    const fileInput = document.getElementById('excelFile');
    const durum = document.getElementById('excelYukleDurum');
    if (!fileInput.files || fileInput.files.length === 0) {
        durum.textContent = '❌ Lütfen bir Excel dosyası seçin.';
        durum.style.color = 'var(--btn-danger)';
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet);
            
            if (rows.length === 0) {
                durum.textContent = '⚠️ Dosyada veri bulunamadı.';
                durum.style.color = 'var(--btn-warning)';
                return;
            }
            
            durum.textContent = `📥 ${rows.length} ürün bulundu, ekleniyor...`;
            durum.style.color = 'var(--text-secondary)';
            
            let eklenen = 0;
            let hatali = 0;
            const batch = writeBatch(db);
            
            for (const row of rows) {
                const ad = row.ürünAdı || row.urunAdi || row.ad || row.Ad || row.ÜrünAdı;
                if (!ad) { hatali++; continue; }
                const barkod = row.barkod || row.Barkod || '';
                const grup = row.grup || row.Grup || 'Genel';
                const kritik = Number(row.kritik || row.Kritik || 5);
                const birim = row.birim || row.Birim || 'Adet';
                
                const docRef = doc(collection(db, "stoklar"));
                batch.set(docRef, {
                    urunAd: ad.trim(),
                    barkod: barkod.trim(),
                    kalan: Number(row.kalan || row.stok || 0),
                    kritik: kritik,
                    grup: grup.trim(),
                    birim: birim,
                    olusturmaTarihi: Timestamp.now()
                });
                eklenen++;
            }
            
            await batch.commit();
            durum.textContent = `✅ ${eklenen} ürün eklendi. ${hatali > 0 ? `(${hatali} satır atlandı)` : ''}`;
            durum.style.color = 'var(--btn-success)';
            fileInput.value = '';
            verileriGetir();
        } catch(err) {
            console.error('Excel yükleme hatası:', err);
            durum.textContent = '❌ Hata: ' + err.message;
            durum.style.color = 'var(--btn-danger)';
        }
    };
    reader.readAsArrayBuffer(file);
}

// ================================================================
// ÜRÜN İŞLEMLERİ
// ================================================================
async function urunEkle() {
    if (!yoneticiMi()) return showToast("Yetkiniz yok!", true);
    const ad = document.getElementById('urunAdi')?.value.trim();
    if (!ad) return showToast("Ürün adı girin!", true);
    const barkod = document.getElementById('urunBarkod')?.value.trim() || "";
    const grup = document.getElementById('urunGrupSelect')?.value || "Genel";
    try {
        await setDoc(doc(collection(db, "stoklar")), {
            urunAd: ad,
            barkod: barkod,
            kalan: 0,
            kritik: 5,
            grup: grup,
            birim: "Adet",
            olusturmaTarihi: Timestamp.now()
        });
        await logEkle('urun_ekle', `${ad} ürünü eklendi`, { urunAd: ad, barkod: barkod });
        showToast("✅ Ürün eklendi");
        document.getElementById('urunAdi').value = "";
        document.getElementById('urunBarkod').value = "";
        const grupSelect = document.getElementById('urunGrupSelect');
        if (grupSelect) grupSelect.value = 'Genel';
        window.sendNotification('📦 Yeni Ürün Eklendi', `${ad} stok sistemine eklendi.`, '/');
    } catch(e) {
        console.error('Ürün ekleme hatası:', e);
        showToast(getFriendlyErrorMessage(e), true);
    }
}

async function stokIslem(tip) {
    const id = document.getElementById('urunSelect')?.value;
    const miktar = Number(document.getElementById('islemMiktar')?.value);
    if (!id) return showToast("Ürün seçin!", true);
    if (!miktar || miktar <= 0) return showToast("Geçerli miktar girin!", true);
    const mevcut = stoklar[id]?.kalan || 0;
    const yeni = tip === 'giris' ? mevcut + miktar : mevcut - miktar;
    if (tip === 'cikis' && yeni < 0) return showToast("Yetersiz stok!", true);
    const urunAd = getUrunAdi(stoklar[id]);

    const tarihInput = document.getElementById('islemTarihi')?.value;
    let islemTarihi = tarihInput ? new Date(tarihInput) : new Date();

    const batch = writeBatch(db);
    batch.update(doc(db, "stoklar", id), { kalan: yeni });
    batch.set(doc(collection(db, "hareketler")), {
        urunId: id,
        urun: urunAd,
        tur: tip,
        miktar: miktar,
        birim: stoklar[id]?.birim || "Adet",
        tarih: Timestamp.fromDate(islemTarihi)
    });
    await batch.commit();
    showToast("İşlem tamam");
    document.getElementById('islemMiktar').value = "";
    const islemMetni = tip === 'giris' ? 'Giriş' : 'Çıkış';
    await logEkle(`stok_${tip}`, `${urunAd} - ${tip}: ${miktar} ${stoklar[id]?.birim || 'Adet'}`, { urunId: id, miktar, tip });
    window.sendNotification(`📊 Stok ${islemMetni}`, `${urunAd} - ${islemMetni}: ${miktar} ${stoklar[id]?.birim || 'Adet'}`, '/');
}

async function urunGuncelle() {
    if (!yoneticiMi()) return showToast("Yetkiniz yok!", true);
    if (!seciliUrunId) return showToast("Ürün seçili değil!", true);
    try {
        await updateDoc(doc(db, "stoklar", seciliUrunId), {
            urunAd: document.getElementById('modalUrunAd').value,
            barkod: document.getElementById('modalBarkod').value,
            kalan: Number(document.getElementById('modalMiktar').value),
            kritik: Number(document.getElementById('modalKritik').value),
            grup: document.getElementById('modalGrup').value
        });
        showToast("✅ Güncellendi");
        await logEkle('urun_guncelle', `${getUrunAdi(stoklar[seciliUrunId])} güncellendi`, { urunId: seciliUrunId });
        kapatModal();
        
        // Detay tab'ındaysak stok listesine geri dön
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'urun-detay') {
            detayGeri();
        }
    } catch(e) { showToast(getFriendlyErrorMessage(e), true); }
}

async function urunSil(id) {
    if (!yoneticiMi()) return showToast("Yetkiniz yok!", true);
    const confirmed = await showConfirm('🗑️ Ürünü Sil', 'Bu ürünü silmek istediğinize emin misiniz?');
    if (!confirmed) return;
    try {
        await deleteDoc(doc(db, "stoklar", id));
        showToast("Silindi");
        await logEkle('urun_sil', `${getUrunAdi(stoklar[id])} silindi`, { urunId: id });
    } catch(e) {
        showToast(getFriendlyErrorMessage(e), true);
    }
}

async function detayGoster(id) {
    seciliUrunId = id;
    const u = stoklar[id];
    if (!u) return showToast("Ürün bulunamadı!", true);
    document.getElementById('modalUrunAd').value = getUrunAdi(u);
    document.getElementById('modalBarkod').value = u.barkod || "";
    document.getElementById('modalMiktar').value = u.kalan || 0;
    document.getElementById('modalKritik').value = u.kritik || 5;
    document.getElementById('modalGrup').value = u.grup || "Genel";
    document.getElementById('detayModal').style.display = 'flex';
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("urunId", "==", id), orderBy("tarih", "desc"), limit(10)));
        document.getElementById('detayIcerik').innerHTML = snap.empty ? "Hareket yok" : snap.docs.map(d => `<div style="padding:8px; border-bottom:1px solid var(--card-border);">${d.data().tarih?.toDate().toLocaleString()} - ${d.data().tur === 'giris' ? '➕' : '➖'} ${d.data().miktar}</div>`).join('');
    } catch(e) { console.error(e); }
}

function kapatModal() {
    document.getElementById('detayModal').style.display = 'none';
}

// ================================================================
// SEPET
// ================================================================
function sepeteEkle() {
    const id = document.getElementById('urunSelect')?.value;
    const m = Number(document.getElementById('islemMiktar')?.value);
    if (!id) return showToast("Ürün seçin!", true);
    if (!m || m <= 0) return showToast("Geçerli miktar!", true);
    sepet.push({ id, ad: getUrunAdi(stoklar[id]), miktar: m });
    sepetiGoster();
    document.getElementById('islemMiktar').value = "";
    showToast("Sepete eklendi");
    sepetiKaydet();
}

function sepetiGoster() {
    const liste = document.getElementById('sepetListesi');
    const butonlar = document.getElementById('sepetButonlar');
    if (!liste) return;
    if (sepet.length === 0) {
        liste.innerHTML = `
            <div class="empty-state" style="padding:20px;">
                <div class="empty-icon">🛒</div>
                <h4>Sepet boş</h4>
                <p>Ürün eklemek için "Sepete Ekle" butonunu kullanın.</p>
            </div>
        `;
        if (butonlar) butonlar.style.display = 'none';
    } else {
        let toplamMiktar = 0;
        let html = sepet.map((u, i) => {
            toplamMiktar += u.miktar;
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--card-border);">
                <span><b>${u.ad}</b> x${u.miktar}</span>
                <button onclick="window.sepetSil(${i})" style="background:var(--btn-danger); color:white; border:none; border-radius:20px; padding:6px 14px;">Sil</button>
            </div>`;
        }).join('');
        html += `
            <div style="display:flex; justify-content:space-between; padding:12px; background:var(--card-border); border-radius:8px; margin-top:8px; font-weight:600; color:var(--text);">
                <span>📊 Toplam</span>
                <span>${sepet.length} ürün çeşidi · ${toplamMiktar} adet</span>
            </div>
        `;
        liste.innerHTML = html;
        if (butonlar) butonlar.style.display = 'flex';
    }
    sepetiKaydet();
}

function sepetiKaydet() {
    try {
        localStorage.setItem('stokSepet', JSON.stringify(sepet));
    } catch (e) {
        console.warn('Sepet kaydedilemedi:', e);
    }
}

function sepetiYukle() {
    try {
        const kayitli = localStorage.getItem('stokSepet');
        if (kayitli) {
            sepet = JSON.parse(kayitli);
        } else {
            sepet = [];
        }
    } catch (e) {
        console.warn('Sepet yüklenemedi, sıfırlanıyor:', e);
        sepet = [];
    }
    sepetiGoster();
}

function sepetSil(i) {
    sepet.splice(i, 1);
    sepetiGoster();
    showToast("Çıkarıldı");
}

async function topluIslem(tip) {
    if (sepet.length === 0) return showToast("Sepet boş!", true);
    
    const tarihInput = document.getElementById('islemTarihi')?.value;
    let islemTarihi = tarihInput ? new Date(tarihInput) : new Date();
    
    showProgress(sepet.length, `Toplu ${tip === 'giris' ? 'Giriş' : 'Çıkış'} işlemi devam ediyor...`);
    
    const batch = writeBatch(db);
    let completed = 0;
    
    for (let item of sepet) {
        const mevcut = stoklar[item.id]?.kalan || 0;
        const yeni = tip === 'giris' ? mevcut + item.miktar : mevcut - item.miktar;
        if (tip === 'cikis' && mevcut < item.miktar) {
            hideProgress();
            return showToast(`${item.ad} için stok yetersiz!`, true);
        }
        batch.update(doc(db, "stoklar", item.id), { kalan: yeni });
        batch.set(doc(collection(db, "hareketler")), {
            urunId: item.id,
            urun: item.ad,
            tur: tip,
            miktar: item.miktar,
            tarih: Timestamp.fromDate(islemTarihi),
            birim: stoklar[item.id]?.birim || "Adet"
        });
        completed++;
        updateProgress(completed);
    }
    
    await batch.commit();
    hideProgress();
    showToast("Toplu işlem tamam");
    sepet = [];
    sepetiGoster();
    sepetiKaydet();
}

// ================================================================
// KAMERA
// ================================================================
function kameraBaslat() {
    const reader = document.getElementById("reader");
    const acBtn = document.getElementById("kameraAcBtn");
    const kapatBtn = document.getElementById("kameraKapatBtn");
    if (kameraAktif) return;
    if (!reader) return showToast("Kamera alanı yok!", true);
    reader.style.display = "block";
    if (acBtn) acBtn.style.display = "none";
    if (kapatBtn) kapatBtn.style.display = "block";
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
            const s = document.getElementById('urunSelect');
            for (let i = 0; i < s.options.length; i++) {
                const opt = s.options[i];
                if (opt.textContent.includes(text) || stoklar[opt.value]?.barkod === text) {
                    s.value = opt.value;
                    showToast("Ürün bulundu: " + opt.textContent);
                    return;
                }
            }
            showToast("Barkod bulunamadı!", true);
        },
        (err) => console.log(err)
    ).then(() => kameraAktif = true).catch(e => {
        showToast("Kamera hatası", true);
        reader.style.display = "none";
        if (acBtn) acBtn.style.display = "block";
        if (kapatBtn) kapatBtn.style.display = "none";
    });
}

function kameraDurdur() {
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    const reader = document.getElementById("reader");
    const acBtn = document.getElementById("kameraAcBtn");
    const kapatBtn = document.getElementById("kameraKapatBtn");
    if (reader) reader.style.display = "none";
    if (acBtn) acBtn.style.display = "block";
    if (kapatBtn) kapatBtn.style.display = "none";
    kameraAktif = false;
}

function yeniUrunKamera() {
    const reader = document.getElementById("reader");
    
    if (!reader) {
        showToast("❌ Kamera alanı bulunamadı!", true);
        return;
    }
    
    if (html5QrCode) {
        html5QrCode.stop().catch(()=>{});
        html5QrCode = null;
    }
    
    reader.innerHTML = '';
    reader.style.display = "block";
    
    showToast("📷 Kamera başlatılıyor...");
    
    try {
        if (typeof Html5Qrcode === 'undefined') {
            showToast("❌ Barkod kütüphanesi yüklenemedi!", true);
            reader.style.display = "none";
            return;
        }
        
        html5QrCode = new Html5Qrcode("reader");
        
        html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (text) => {
                document.getElementById('urunBarkod').value = text;
                showToast("✅ Barkod okundu: " + text);
                kameraDurdur();
            },
            (err) => {}
        ).then(() => {
            showToast("📷 Kamera açıldı, barkodu okutun.");
        }).catch((err) => {
            console.error('Kamera başlatma hatası:', err);
            let hataMesaji = '❌ Kamera açılamadı!';
            if (err.message?.includes('permission')) {
                hataMesaji = '❌ Kamera izni reddedildi! Lütfen tarayıcı ayarlarından izin verin.';
            } else if (err.message?.includes('NotFoundError')) {
                hataMesaji = '❌ Kamera bulunamadı!';
            }
            showToast(hataMesaji, true);
            reader.style.display = "none";
        });
    } catch (e) {
        console.error('Beklenmeyen hata:', e);
        showToast(getFriendlyErrorMessage(e), true);
        reader.style.display = "none";
    }
}

// ================================================================
// RAPORLAMA
// ================================================================
async function raporOlustur() {
    const b = document.getElementById('raporBaslangic')?.value;
    const e = document.getElementById('raporBitis')?.value;
    const filtre = document.getElementById('raporFiltre')?.value || 'hepsi';
    
    let start, end;
    if (b && e) {
        start = new Date(b);
        end = new Date(e);
    } else {
        const bugun = new Date();
        start = new Date(bugun);
        end = new Date(bugun);
    }

    const saatBaslangicSaat = document.getElementById('raporSaatBaslangicSaat')?.value || '00';
    const saatBaslangicDakika = document.getElementById('raporSaatBaslangicDakika')?.value || '00';
    const saatBitisSaat = document.getElementById('raporSaatBitisSaat')?.value || '23';
    const saatBitisDakika = document.getElementById('raporSaatBitisDakika')?.value || '59';

    const [startSaat, startDakika] = [Number(saatBaslangicSaat), Number(saatBaslangicDakika)];
    const [endSaat, endDakika] = [Number(saatBitisSaat), Number(saatBitisDakika)];

    start.setHours(startSaat || 0, startDakika || 0, 0, 0);
    end.setHours(endSaat || 23, endDakika || 59, 59, 999);

    const sonucDiv = document.getElementById('raporSonuc');
    if (!sonucDiv) {
        showToast("Rapor alanı bulunamadı!", true);
        return;
    }
    sonucDiv.style.display = 'block';

    const tbody = document.getElementById('raporTabloGovde');
    if (!tbody) {
        showToast("❌ Tablo alanı bulunamadı! Sayfayı yenileyin.", true);
        sonucDiv.style.display = 'none';
        return;
    }

    let baslikEl = document.getElementById('raporBaslik');
    if (!baslikEl) {
        baslikEl = document.createElement('h2');
        baslikEl.id = 'raporBaslik';
        baslikEl.style.textAlign = 'center';
        baslikEl.style.marginBottom = '8px';
        sonucDiv.prepend(baslikEl);
    }

    let altBilgiEl = document.getElementById('raporAltBilgi');
    if (!altBilgiEl) {
        altBilgiEl = document.createElement('p');
        altBilgiEl.id = 'raporAltBilgi';
        altBilgiEl.style.textAlign = 'right';
        altBilgiEl.style.fontSize = '12px';
        altBilgiEl.style.color = '#888';
        altBilgiEl.style.marginTop = '12px';
        sonucDiv.appendChild(altBilgiEl);
    }

    const formatDate = (date) => {
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const startStr = formatDate(start);
    const endStr = formatDate(end);
    const isSameDay = startStr === endStr;

    baslikEl.textContent = '📊 Stok Raporu';

    let tarihBilgiEl = document.getElementById('raporTarihBilgi');
    if (!tarihBilgiEl) {
        tarihBilgiEl = document.createElement('p');
        tarihBilgiEl.id = 'raporTarihBilgi';
        tarihBilgiEl.style.textAlign = 'center';
        tarihBilgiEl.style.fontWeight = '500';
        tarihBilgiEl.style.marginBottom = '16px';
        tarihBilgiEl.style.color = 'var(--text-secondary)';
        baslikEl.insertAdjacentElement('afterend', tarihBilgiEl);
    }

    if (isSameDay) {
        tarihBilgiEl.textContent = `📅 Rapor Tarihi: ${startStr} · Saat Aralığı: ${String(startSaat).padStart(2,'0')}:${String(startDakika).padStart(2,'0')} - ${String(endSaat).padStart(2,'0')}:${String(endDakika).padStart(2,'0')}`;
    } else {
        tarihBilgiEl.textContent = `📅 Rapor Aralığı: ${startStr} - ${endStr} · Saat Aralığı: ${String(startSaat).padStart(2,'0')}:${String(startDakika).padStart(2,'0')} - ${String(endSaat).padStart(2,'0')}:${String(endDakika).padStart(2,'0')}`;
    }
    tarihBilgiEl.style.display = 'block';

    altBilgiEl.textContent = `Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888; padding:20px;">⏳ Veriler yükleniyor...</td></tr>';
    showLoading('Rapor hazırlanıyor...');

    try {
        const snap = await getDocs(query(
            collection(db, "hareketler"),
            where("tarih", ">=", Timestamp.fromDate(start)),
            where("tarih", "<=", Timestamp.fromDate(end))
        ));

        if (snap.empty) {
            tbody.innerHTML = `
                <tr><td colspan="5">
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <h4>Bu tarih aralığında hareket yok</h4>
                        <p>Farklı bir tarih aralığı deneyin.</p>
                    </div>
                </td></tr>
            `;
            hideLoading();
            return;
        }

        const gruplar_temp = {};
        snap.forEach(doc => {
            const h = doc.data();
            const tarihObj = h.tarih?.toDate();
            if (!tarihObj) return;
            const gunKey = tarihObj.toDateString();
            if (!gruplar_temp[gunKey]) gruplar_temp[gunKey] = { giris: [], cikis: [] };
            if (h.tur === 'giris') {
                gruplar_temp[gunKey].giris.push(h);
            } else {
                gruplar_temp[gunKey].cikis.push(h);
            }
        });

        const sortedKeys = Object.keys(gruplar_temp).sort((a, b) => new Date(a) - new Date(b));

        let html = '';
        let genelToplamGiris = 0;
        let genelToplamCikis = 0;

        sortedKeys.forEach(gun => {
            const gunVerisi = gruplar_temp[gun];
            const gunAdi = new Date(gun).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            html += `
                <tr style="background:var(--bg-secondary); border-top:2px solid var(--border);">
                    <td colspan="5" style="padding:8px 12px; font-weight:700; color:var(--text);">
                        📅 ${gunAdi}
                    </td>
                </tr>
            `;

            if (filtre === 'hepsi' || filtre === 'giris') {
                const girisler = gunVerisi.giris;
                if (girisler.length > 0) {
                    html += `
                        <tr style="background:var(--bg-card);">
                            <td colspan="5" style="padding:4px 12px; font-weight:600; color:#2ecc71;">📥 GİRİŞLER</td>
                        </tr>
                    `;
                    let gunGirisToplam = 0;
                    girisler.forEach(h => {
                        const saat = h.tarih?.toDate().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) || '';
                        gunGirisToplam += h.miktar || 0;
                        html += `
                            <tr>
                                <td style="font-size:12px;">${saat}</td>
                                <td>${h.urun || '-'}</td>
                                <td style="color:#2ecc71; font-weight:600; text-align:center;">📥 Giriş</td>
                                <td style="text-align:center;">${h.miktar || 0}</td>
                                <td></td>
                            </tr>
                        `;
                    });
                    genelToplamGiris += gunGirisToplam;
                    html += `
                        <tr style="background:var(--border);">
                            <td colspan="3" style="padding:4px 12px; font-weight:600; text-align:right;">Günlük Giriş Toplamı:</td>
                            <td style="text-align:center; font-weight:700; color:#2ecc71;">${gunGirisToplam}</td>
                            <td></td>
                        </tr>
                    `;
                }
            }

            if (filtre === 'hepsi' || filtre === 'cikis') {
                const cikisler = gunVerisi.cikis;
                if (cikisler.length > 0) {
                    html += `
                        <tr style="background:var(--bg-card);">
                            <td colspan="5" style="padding:4px 12px; font-weight:600; color:#e74c3c;">📤 ÇIKIŞLAR</td>
                        </tr>
                    `;
                    let gunCikisToplam = 0;
                    cikisler.forEach(h => {
                        const saat = h.tarih?.toDate().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) || '';
                        gunCikisToplam += h.miktar || 0;
                        html += `
                            <tr>
                                <td style="font-size:12px;">${saat}</td>
                                <td>${h.urun || '-'}</td>
                                <td style="color:#e74c3c; font-weight:600; text-align:center;">📤 Çıkış</td>
                                <td style="text-align:center;">${h.miktar || 0}</td>
                                <td></td>
                            </tr>
                        `;
                    });
                    genelToplamCikis += gunCikisToplam;
                    html += `
                        <tr style="background:var(--border);">
                            <td colspan="3" style="padding:4px 12px; font-weight:600; text-align:right;">Günlük Çıkış Toplamı:</td>
                            <td style="text-align:center; font-weight:700; color:#e74c3c;">${gunCikisToplam}</td>
                            <td></td>
                        </tr>
                    `;
                }
            }
        });

        if (filtre === 'hepsi' || filtre === 'giris') {
            html += `
                <tr style="background:var(--bg-secondary); border-top:2px solid var(--text); font-weight:700;">
                    <td colspan="3" style="padding:10px 12px; text-align:right; color:var(--text);">📊 GENEL TOPLAM GİRİŞ</td>
                    <td style="text-align:center; color:#2ecc71; font-size:18px;">${genelToplamGiris}</td>
                    <td></td>
                </tr>
            `;
        }
        if (filtre === 'hepsi' || filtre === 'cikis') {
            html += `
                <tr style="background:var(--bg-secondary); border-top:2px solid var(--text); font-weight:700;">
                    <td colspan="3" style="padding:10px 12px; text-align:right; color:var(--text);">📊 GENEL TOPLAM ÇIKIŞ</td>
                    <td style="text-align:center; color:#e74c3c; font-size:18px;">${genelToplamCikis}</td>
                    <td></td>
                </tr>
            `;
        }

        tbody.innerHTML = html;
        showToast(`✅ Rapor hazır (${snap.size} hareket)`);
        hideLoading();
    } catch (error) {
        console.error('Rapor hatası:', error);
        showToast(getFriendlyErrorMessage(error), true);
        sonucDiv.style.display = 'none';
        hideLoading();
    }
}

function populateTimeSelects() {
    const saatIds = ['raporSaatBaslangicSaat', 'raporSaatBitisSaat'];
    const dakikaIds = ['raporSaatBaslangicDakika', 'raporSaatBitisDakika'];

    saatIds.forEach((id, index) => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const opt = document.createElement('option');
            opt.value = String(i).padStart(2, '0');
            opt.textContent = String(i).padStart(2, '0');
            if ((index === 0 && i === 0) || (index === 1 && i === 23)) {
                opt.selected = true;
            }
            select.appendChild(opt);
        }
    });

    dakikaIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '';
        for (let i = 0; i < 60; i++) {
            const opt = document.createElement('option');
            opt.value = String(i).padStart(2, '0');
            opt.textContent = String(i).padStart(2, '0');
            if (i === 0) opt.selected = true;
            select.appendChild(opt);
        }
    });
}

populateTimeSelects();

function excelIndir() {
    const tablo = document.getElementById('raporTablo');
    if (!tablo) {
        showToast("❌ Tablo bulunamadı! Önce rapor oluşturun.", true);
        return;
    }

    const baslik = document.getElementById('raporBaslik')?.textContent || 'Stok Raporu';
    const tarihBilgi = document.getElementById('raporTarihBilgi')?.textContent || '';
    const altBilgi = document.getElementById('raporAltBilgi')?.textContent || '';

    const tabloClone = tablo.cloneNode(true);
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: #fff; color: #1e293b; }
    .rapor-container { max-width: 1100px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 25px; }
    .header h1 { font-size: 28px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; margin:0; }
    .header .tarih { font-size: 14px; color: #64748b; background: #f1f5f9; padding: 6px 16px; border-radius: 20px; }
    .rapor-tarih { text-align: center; font-size: 15px; font-weight: 500; color: #475569; margin-bottom: 25px; background: #f8fafc; padding: 10px; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 10px; }
    th { background: #1e293b; color: #ffffff; font-weight: 600; padding: 12px 15px; text-align: center; border: 1px solid #1e293b; }
    td { padding: 10px 15px; border: 1px solid #e2e8f0; text-align: center; vertical-align: middle; }
    td:first-child, td:nth-child(2) { text-align: left; }
    .grup-baslik td { background: #f1f5f9 !important; font-weight: 700; font-size: 15px; text-align: left !important; padding: 8px 15px; border: 1px solid #e2e8f0; color: #0f172a; }
    .grup-baslik-giris td { border-left: 4px solid #22c55e; }
    .grup-baslik-cikis td { border-left: 4px solid #ef4444; }
    .giris-row td { background: #f0fdf4; }
    .cikis-row td { background: #fef2f2; }
    .toplam-satir td { background: #f8fafc !important; font-weight: 700; font-size: 15px; border-top: 2px solid #0f172a; }
    .toplam-giris td { color: #16a34a; }
    .toplam-cikis td { color: #dc2626; }
    .genel-toplam td { background: #e2e8f0 !important; font-weight: 800; font-size: 16px; border-top: 3px solid #0f172a; }
    .footer { margin-top: 30px; text-align: right; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .footer span { background: #f1f5f9; padding: 4px 12px; border-radius: 12px; }
</style>
</head>
<body>
<div class="rapor-container">
    <div class="header">
        <h1>${baslik}</h1>
        <div class="tarih">📅 ${new Date().toLocaleDateString('tr-TR')}</div>
    </div>
    ${tarihBilgi ? `<div class="rapor-tarih">${tarihBilgi}</div>` : ''}
    ${tabloClone.outerHTML}
    <div class="footer"><span>${altBilgi}</span></div>
</div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapor_${new Date().toISOString().slice(0,10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("📊 Excel indiriliyor (stiller korunarak)");
}

function pdfIndir() {
    const tablo = document.getElementById('raporTablo');
    if (!tablo) {
        showToast("❌ Tablo bulunamadı! Önce rapor oluşturun.", true);
        return;
    }
    
    const baslik = document.getElementById('raporBaslik')?.textContent || 'Stok Raporu';
    const tarihBilgi = document.getElementById('raporTarihBilgi')?.textContent || '';
    const altBilgi = document.getElementById('raporAltBilgi')?.textContent || '';
    
    const tabloClone = tablo.cloneNode(true);
    
    const w = window.open('', '_blank');
    w.document.write(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Stok Raporu</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', 'Arial', sans-serif; padding: 40px 30px; background: #f5f7fa; color: #1e293b; }
    .rapor-container { max-width: 1100px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); padding: 40px 35px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 25px; }
    .header h1 { font-size: 28px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; }
    .header .tarih { font-size: 14px; color: #64748b; background: #f1f5f9; padding: 6px 16px; border-radius: 20px; }
    .rapor-tarih { text-align: center; font-size: 15px; font-weight: 500; color: #475569; margin-bottom: 25px; background: #f8fafc; padding: 10px; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 10px; }
    th { background: #1e293b; color: #ffffff; font-weight: 600; padding: 12px 15px; text-align: center; border: 1px solid #1e293b; }
    td { padding: 10px 15px; border: 1px solid #e2e8f0; text-align: center; vertical-align: middle; }
    td:first-child, td:nth-child(2) { text-align: left; }
    .grup-baslik td { background: #f1f5f9 !important; font-weight: 700; font-size: 15px; text-align: left !important; padding: 8px 15px; border: 1px solid #e2e8f0; color: #0f172a; }
    .grup-baslik-giris td { border-left: 4px solid #22c55e; }
    .grup-baslik-cikis td { border-left: 4px solid #ef4444; }
    .giris-row td { background: #f0fdf4; }
    .cikis-row td { background: #fef2f2; }
    .toplam-satir td { background: #f8fafc !important; font-weight: 700; font-size: 15px; border-top: 2px solid #0f172a; }
    .toplam-giris td { color: #16a34a; }
    .toplam-cikis td { color: #dc2626; }
    .genel-toplam td { background: #e2e8f0 !important; font-weight: 800; font-size: 16px; border-top: 3px solid #0f172a; }
    .footer { margin-top: 30px; text-align: right; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .footer span { background: #f1f5f9; padding: 4px 12px; border-radius: 12px; }
    @media print { body { background: #fff; padding: 20px; } .rapor-container { box-shadow: none; padding: 20px; } .header { border-bottom-color: #333; } th { background: #333 !important; color: #fff !important; } .grup-baslik td { background: #f0f0f0 !important; } .giris-row td { background: #f0fdf4 !important; } .cikis-row td { background: #fef2f2 !important; } .toplam-satir td { background: #f8fafc !important; } .genel-toplam td { background: #e2e8f0 !important; } }
</style>
</head>
<body>
<div class="rapor-container">
    <div class="header">
        <h1>${baslik}</h1>
        <div class="tarih">📅 ${new Date().toLocaleDateString('tr-TR')}</div>
    </div>
    ${tarihBilgi ? `<div class="rapor-tarih">${tarihBilgi}</div>` : ''}
    ${tabloClone.outerHTML}
    <div class="footer"><span>${altBilgi}</span></div>
</div>
</body>
</html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
}

// ================================================================
// GERİ BİLDİRİM
// ================================================================
async function feedbackGonder() {
    const konu = document.getElementById('feedbackKonu').value.trim();
    const mesaj = document.getElementById('feedbackMesaj').value.trim();
    if (!mesaj) {
        showToast('❌ Lütfen mesaj girin!', true);
        return;
    }
    try {
        await addDoc(collection(db, "feedback"), {
            kullanici: mevcutKullanici?.email || 'Anonim',
            konu: konu || 'Genel',
            mesaj: mesaj,
            tarih: Timestamp.now(),
            durum: 'okunmadı'
        });
        showToast('✅ Geri bildiriminiz gönderildi! Teşekkürler.');
        document.getElementById('feedbackKonu').value = '';
        document.getElementById('feedbackMesaj').value = '';
        document.getElementById('feedbackDurum').innerHTML = '';
    } catch(e) {
        showToast(getFriendlyErrorMessage(e), true);
    }
}

async function feedbackListele() {
    const tbody = document.getElementById('feedbackListesi');
    if (!tbody) return;
    try {
        showLoading('Geri bildirimler yükleniyor...');
        const snap = await getDocs(query(collection(db, "feedback"), orderBy("tarih", "desc")));
        if (snap.empty) {
            tbody.innerHTML = `
                <tr><td colspan="6">
                    <div class="empty-state">
                        <div class="empty-icon">📬</div>
                        <h4>Henüz geri bildirim yok</h4>
                        <p>Kullanıcılardan gelen geri bildirimler burada görünecek.</p>
                    </div>
                </td></tr>
            `;
            hideLoading();
            return;
        }
        let html = '';
        snap.forEach(d => {
            const f = d.data();
            const id = d.id;
            const tarih = f.tarih?.toDate().toLocaleString('tr-TR') || '-';
            const durum = f.durum || 'okunmadı';
            const durumText = durum === 'okunmadı' ? '🔴 Okunmadı' : 
                              durum === 'okundu' ? '🟡 Okundu' : 
                              durum === 'islemde' ? '🟠 İşlemde' : '🟢 Tamamlandı';
            html += `
                <tr>
                    <td>${f.kullanici || 'Anonim'}</td>
                    <td><strong>${f.konu || 'Genel'}</strong></td>
                    <td style="max-width:200px; word-break:break-word;">${f.mesaj}</td>
                    <td style="font-size:12px;">${tarih}</td>
                    <td>
                        <select onchange="window.feedbackDurumGuncelle('${id}', this.value)" style="background:transparent; color:var(--text); border:1px solid var(--border); border-radius:var(--radius-sm); padding:4px 8px; font-size:12px; font-weight:600;">
                            <option value="okunmadı" ${durum === 'okunmadı' ? 'selected' : ''}>🔴 Okunmadı</option>
                            <option value="okundu" ${durum === 'okundu' ? 'selected' : ''}>🟡 Okundu</option>
                            <option value="islemde" ${durum === 'islemde' ? 'selected' : ''}>🟠 İşlemde</option>
                            <option value="tamamlandi" ${durum === 'tamamlandi' ? 'selected' : ''}>🟢 Tamamlandı</option>
                        </select>
                    </td>
                    <td>
                        <button onclick="window.feedbackSil('${id}')" style="background:var(--danger); color:white; border:none; border-radius:var(--radius-full); padding:4px 12px; cursor:pointer; font-size:12px;">🗑️</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        hideLoading();
    } catch(e) {
        console.error('Feedback listeleme hatası:', e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger); padding:20px;">❌ Yüklenirken hata oluştu</td></tr>';
        hideLoading();
    }
}

async function feedbackDurumGuncelle(id, yeniDurum) {
    if (!adminMi()) return showToast('❌ Yetkiniz yok!', true);
    try {
        await updateDoc(doc(db, "feedback", id), { durum: yeniDurum });
        showToast('✅ Durum güncellendi');
        feedbackListele();
    } catch(e) {
        showToast(getFriendlyErrorMessage(e), true);
    }
}

async function feedbackSil(id) {
    if (!adminMi()) return showToast('❌ Yetkiniz yok!', true);
    const confirmed = await showConfirm('🗑️ Geri Bildirimi Sil', 'Bu geri bildirimi silmek istediğinize emin misiniz?');
    if (!confirmed) return;
    try {
        await deleteDoc(doc(db, "feedback", id));
        showToast('✅ Silindi');
        feedbackListele();
    } catch(e) {
        showToast(getFriendlyErrorMessage(e), true);
    }
}

// ================================================================
// SİPARİŞ / İHTİYAÇ LİSTESİ
// ================================================================
async function sonSiparisNumarasiAl() {
    try {
        const snap = await getDocs(query(collection(db, "siparisler"), orderBy("siparisNo", "desc"), limit(1)));
        if (snap.empty) return "SIP-001";
        const son = snap.docs[0].data().siparisNo;
        const num = parseInt(son.split('-')[1]) + 1;
        return `SIP-${String(num).padStart(3, '0')}`;
    } catch(e) {
        console.error("Sipariş numarası alma hatası:", e);
        return "SIP-001";
    }
}

async function siparisleriListele() {
    const tbody = document.getElementById('siparislerTablo');
    if (!tbody) return;
    try {
        showLoading('Siparişler yükleniyor...');
        const snap = await getDocs(query(collection(db, "siparisler"), orderBy("siparisNo", "desc")));
        if (snap.empty) {
            tbody.innerHTML = `
                <tr><td colspan="6">
                    <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <h4>Henüz ihtiyaç listesi yok</h4>
                        <p>"Yeni İhtiyaç Listesi" butonuna tıklayarak oluşturabilirsiniz.</p>
                    </div>
                </td></tr>
            `;
            hideLoading();
            return;
        }
        let toplamSiparis = 0;
        let toplamUrun = 0;
        let html = '';
        snap.forEach(d => {
            const s = d.data();
            const id = d.id;
            toplamSiparis++;
            const urunSayisi = s.urunler ? s.urunler.length : 0;
            toplamUrun += urunSayisi;
            const siparisNo = s.siparisNo || 'SIP-XXX';
            const tarih = s.tarih?.toDate().toLocaleString('tr-TR') || "-";
            let urunOzet = s.urunler?.map(u => `${u.urunAd} (${u.miktar} ${u.birim || 'Adet'})`).join(', ') || '-';
            if (urunOzet.length > 50) urunOzet = urunOzet.slice(0, 50) + '...';
            const durum = s.durum || 'bekliyor';
            const durumClass = `durum-${durum}`;
            const durumText = durum === 'bekliyor' ? 'Bekliyor' : 
                              durum === 'siparis_verildi' ? 'Sipariş Verildi' :
                              durum === 'tamamlandi' ? 'Tamamlandı' : 'İptal';
            html += `
                <tr>
                    <td><strong>${siparisNo}</strong></td>
                    <td style="font-size:12px;">${tarih}</td>
                    <td>${urunOzet}</td>
                    <td>${s.tedarikci || '-'}</td>
                    <td><span class="${durumClass}">${durumText}</span></td>
                    <td>
                        <button onclick="window.siparisDetayGoster('${id}')" style="background:var(--btn-primary); color:white; border:none; border-radius:20px; padding:4px 10px; margin-right:4px;">👁️</button>
                        <button onclick="window.siparisDuzenle('${id}')" style="background:var(--btn-warning); color:black; border:none; border-radius:20px; padding:4px 10px; margin-right:4px;">✏️</button>
                        <button onclick="window.siparisSepeteEkle('${id}')" style="background:#f39c12; color:white; border:none; border-radius:20px; padding:4px 10px; margin-right:4px;">🛒</button>
                        <button onclick="window.ihtiyacListesiYazdir('tek', '${id}')" style="background:var(--btn-dark); color:white; border:none; border-radius:20px; padding:4px 10px; margin-right:4px;">🖨️</button>
                        <select onchange="window.siparisDurumGuncelle('${id}', this.value)" style="padding:4px 8px; border-radius:16px; background:var(--input-bg); color:var(--text); border:1px solid var(--card-border); font-size:12px; margin-right:4px;">
                            <option value="bekliyor" ${durum === 'bekliyor' ? 'selected' : ''}>Bekliyor</option>
                            <option value="siparis_verildi" ${durum === 'siparis_verildi' ? 'selected' : ''}>Sipariş Verildi</option>
                            <option value="tamamlandi" ${durum === 'tamamlandi' ? 'selected' : ''}>Tamamlandı</option>
                            <option value="iptal" ${durum === 'iptal' ? 'selected' : ''}>İptal</option>
                        </select>
                        <button onclick="window.siparisSil('${id}')" style="background:var(--btn-danger); color:white; border:none; border-radius:20px; padding:4px 10px;">🗑️</button>
                    </td>
                </tr>
            `;
        });
        html += `
            <tr style="background:var(--card-border); font-weight:700; border-top:2px solid var(--text);">
                <td colspan="2" style="padding:10px 12px; color:var(--text);">📊 TOPLAM (${toplamSiparis} sipariş)</td>
                <td style="padding:10px 12px; text-align:center; color:var(--text);">${toplamUrun} ürün</td>
                <td colspan="3"></td>
            </tr>
        `;
        tbody.innerHTML = html;
        hideLoading();
    } catch(e) { 
        console.error("Sipariş listeleme hatası:", e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--btn-danger); padding:20px;">❌ Yüklenirken hata oluştu</td></tr>';
        hideLoading();
    }
}

function siparisleriFiltrele() {
    const arama = document.getElementById('siparisArama')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#siparislerTablo tr');
    rows.forEach(row => {
        if (row.cells && row.cells.length > 0) {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(arama) ? '' : 'none';
        }
    });
}

function siparisFormuGoster(editId = null) {
    const modal = document.getElementById('siparisModal');
    const baslik = document.getElementById('siparisModalBaslik');
    const duzenleId = document.getElementById('siparisDuzenleId');
    if (editId) {
        baslik.textContent = '✏️ Sipariş Düzenle';
        duzenleId.value = editId;
        siparisVerileriniGetir(editId);
    } else {
        baslik.textContent = '📦 Yeni İhtiyaç Siparişi';
        duzenleId.value = '';
        document.getElementById('siparisUrunListesi').innerHTML = '';
        document.getElementById('siparisTedarikci').value = '';
        document.getElementById('siparisNot').value = '';
        siparisUrunSatirEkle();
    }
    modal.style.display = 'flex';
}

async function siparisVerileriniGetir(id) {
    try {
        const docSnap = await getDoc(doc(db, "siparisler", id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('siparisTedarikci').value = data.tedarikci || '';
            document.getElementById('siparisNot').value = data.not || '';
            const liste = document.getElementById('siparisUrunListesi');
            liste.innerHTML = '';
            if (data.urunler && data.urunler.length > 0) {
                data.urunler.forEach(u => siparisUrunSatirEkle(u.urunId, u.urunAd, u.miktar));
            } else {
                siparisUrunSatirEkle();
            }
        }
    } catch(e) { showToast(getFriendlyErrorMessage(e), true); }
}

function siparisUrunSatirEkle(urunId = '', urunAd = '', miktar = '') {
    const liste = document.getElementById('siparisUrunListesi');
    const satir = document.createElement('div');
    satir.className = 'siparis-urun-satir';
    satir.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:8px;';
    satir.innerHTML = `
        <select class="siparisUrunSelect" style="flex:2; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--bg-input); color:var(--text);">
            <option value="">Ürün Seçin</option>
        </select>
        <input type="number" class="siparisUrunMiktar" placeholder="İhtiyaç" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--bg-input); color:var(--text);" min="1" value="${miktar}">
        <button onclick="this.parentElement.remove()" style="background:var(--btn-danger); color:white; border:none; border-radius:20px; padding:0 12px; height:40px; cursor:pointer;">✖</button>
    `;
    liste.appendChild(satir);
    const select = satir.querySelector('.siparisUrunSelect');
    for (let [id, u] of Object.entries(stoklar)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = getUrunAdi(u);
        if (id === urunId) opt.selected = true;
        select.appendChild(opt);
    }
    if (urunAd && !urunId) {
        for (let opt of select.options) {
            if (opt.textContent === urunAd) { opt.selected = true; break; }
        }
    }
}

async function siparisKaydet() {
    const duzenleId = document.getElementById('siparisDuzenleId').value;
    const satirlar = document.querySelectorAll('.siparis-urun-satir');
    const urunler = [];
    satirlar.forEach(satir => {
        const select = satir.querySelector('.siparisUrunSelect');
        const miktar = satir.querySelector('.siparisUrunMiktar').value;
        if (select.value && miktar && Number(miktar) > 0) {
            const urunAd = select.options[select.selectedIndex].text;
            urunler.push({
                urunId: select.value,
                urunAd: urunAd,
                miktar: Number(miktar),
                birim: stoklar[select.value]?.birim || 'Adet'
            });
        }
    });
    if (urunler.length === 0) return showToast("En az bir ürün ekleyin!", true);
    const tedarikci = document.getElementById('siparisTedarikci').value.trim();
    const not = document.getElementById('siparisNot').value.trim();
    const data = { 
        urunler, 
        tedarikci, 
        not, 
        olusturan: mevcutKullanici?.email || 'Sistem',
        durum: 'bekliyor',
        tarih: Timestamp.now()
    };
    try {
        let siparisNo = '';
        if (duzenleId) {
            await updateDoc(doc(db, "siparisler", duzenleId), data);
            showToast("Sipariş güncellendi");
        } else {
            siparisNo = await sonSiparisNumarasiAl();
            data.siparisNo = siparisNo;
            await addDoc(collection(db, "siparisler"), data);
            showToast(`İhtiyaç siparişi oluşturuldu (${siparisNo})`);
            const urunAdlari = urunler.map(u => u.urunAd).join(', ');
            window.sendNotification(
                '📋 Yeni İhtiyaç Listesi',
                `${siparisNo} - ${urunler.length} ürün: ${urunAdlari.substring(0, 50)}${urunAdlari.length > 50 ? '...' : ''}`,
                '/'
            );
        }
        siparisModalKapat();
        siparisleriListele();
    } catch(e) { showToast(getFriendlyErrorMessage(e), true); }
}

function siparisModalKapat() {
    const confirmed = confirm('İhtiyaç listesini kapatmak istediğinize emin misiniz? Kaydedilmemiş değişiklikler kaybolacak.');
    if (confirmed) {
        document.getElementById('siparisModal').style.display = 'none';
    }
}

async function siparisDetayGoster(id) {
    window._siparisDetayId = id;
    try {
        const docSnap = await getDoc(doc(db, "siparisler", id));
        if (!docSnap.exists()) return showToast("Sipariş bulunamadı!", true);
        const s = docSnap.data();
        const siparisNo = s.siparisNo || 'SIP-XXX';
        const tarih = s.tarih?.toDate().toLocaleString('tr-TR') || '-';
        let urunHtml = s.urunler?.map(u => `<div>• ${u.urunAd} - ${u.miktar} ${u.birim || 'Adet'}</div>`).join('') || 'Ürün yok';
        const durumText = s.durum === 'bekliyor' ? 'Bekliyor' : 
                          s.durum === 'siparis_verildi' ? 'Sipariş Verildi' :
                          s.durum === 'tamamlandi' ? 'Tamamlandı' : 'İptal';
        document.getElementById('siparisDetayIcerik').innerHTML = `
            <p><strong>Sipariş No:</strong> ${siparisNo}</p>
            <p><strong>Tarih:</strong> ${tarih}</p>
            <p><strong>Durum:</strong> ${durumText}</p>
            <p><strong>Tedarikçi:</strong> ${s.tedarikci || '-'}</p>
            <p><strong>Not:</strong> ${s.not || '-'}</p>
            <p><strong>Oluşturan:</strong> ${s.olusturan || '-'}</p>
            <hr><h4>📦 İhtiyaç Listesi</h4>${urunHtml}
            <div style="margin-top:16px; display:flex; gap:10px;">
                <button onclick="window.siparisDuzenle('${id}'); window.siparisDetayKapat();" style="flex:1; background:var(--btn-warning); color:black; border:none; border-radius:40px; padding:12px; font-weight:700; cursor:pointer;">
                    ✏️ Düzenle
                </button>
                <button onclick="window.ihtiyacDetayYazdir()" style="flex:1; background:#2c3e50; color:white; border:none; border-radius:40px; padding:12px; font-weight:700; cursor:pointer;">
                    🖨️ Yazdır
                </button>
                <button onclick="window.siparisDetayKapat()" style="flex:1; background:var(--border); color:var(--text); border:none; border-radius:40px; padding:12px; font-weight:600; cursor:pointer;">
                    Kapat
                </button>
            </div>
        `;
        document.getElementById('siparisDetayModal').style.display = 'flex';
    } catch(e) { showToast(getFriendlyErrorMessage(e), true); }
}

function siparisDetayKapat() {
    document.getElementById('siparisDetayModal').style.display = 'none';
}

async function siparisDurumGuncelle(id, yeniDurum) {
    try {
        await updateDoc(doc(db, "siparisler", id), { durum: yeniDurum });
        showToast("Durum güncellendi");
        siparisleriListele();
        const durumText = yeniDurum === 'bekliyor' ? 'Bekliyor' : 
                          yeniDurum === 'siparis_verildi' ? 'Sipariş Verildi' :
                          yeniDurum === 'tamamlandi' ? 'Tamamlandı' : 'İptal';
        window.sendNotification(
            '📋 Sipariş Durumu Güncellendi',
            `${id} numaralı sipariş durumu: ${durumText}`,
            '/'
        );
    } catch(e) { showToast(getFriendlyErrorMessage(e), true); }
}

async function siparisSil(id) {
    const confirmed = await showConfirm('🗑️ Siparişi Sil', 'Bu siparişi silmek istediğinize emin misiniz?');
    if (!confirmed) return;
    try {
        await deleteDoc(doc(db, "siparisler", id));
        showToast("Sipariş silindi");
        siparisleriListele();
    } catch(e) { showToast(getFriendlyErrorMessage(e), true); }
}

function siparisDuzenle(id) {
    siparisFormuGoster(id);
}

async function kritikStoktanSiparisOlustur() {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (kritikler.length === 0) return showToast("Kritik stokta ürün yok!", true);
    
    siparisFormuGoster();
    
    const liste = document.getElementById('siparisUrunListesi');
    if (!liste) return;
    liste.innerHTML = '';
    
    kritikler.forEach(u => {
        const satir = document.createElement('div');
        satir.className = 'siparis-urun-satir';
        satir.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:8px;';
        const onerilenMiktar = Math.max(1, (u.kritik || 5) * 2 - (u.kalan || 0));
        satir.innerHTML = `
            <select class="siparisUrunSelect" style="flex:2; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--bg-input); color:var(--text);">
                <option value="${u.id}" selected>${getUrunAdi(u)} (Stok: ${u.kalan})</option>
            </select>
            <input type="number" class="siparisUrunMiktar" placeholder="İhtiyaç" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--bg-input); color:var(--text);" min="1" value="${onerilenMiktar}">
            <button onclick="this.parentElement.remove()" style="background:var(--btn-danger); color:white; border:none; border-radius:20px; padding:0 12px; height:40px; cursor:pointer;">✖</button>
        `;
        liste.appendChild(satir);
    });
    
    document.querySelectorAll('.siparisUrunSelect').forEach(select => {
        for (let [id, u] of Object.entries(stoklar)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = getUrunAdi(u);
            if (id === select.value) opt.selected = true;
            select.appendChild(opt);
        }
    });
    
    showToast(`📋 ${kritikler.length} kritik ürün eklendi`);
}

async function ihtiyacListesiYazdir(tip, siparisId = null) {
    let siparisler = [];
    
    if (tip === 'tek' && siparisId) {
        const docSnap = await getDoc(doc(db, "siparisler", siparisId));
        if (docSnap.exists()) {
            siparisler = [{ id: siparisId, ...docSnap.data() }];
        } else {
            showToast("Sipariş bulunamadı!", true);
            return;
        }
    } else {
        const snap = await getDocs(query(collection(db, "siparisler"), orderBy("tarih", "desc")));
        siparisler = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    
    if (siparisler.length === 0) {
        showToast("Yazdırılacak sipariş yok!", true);
        return;
    }
    
    const w = window.open('', '_blank');
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>İhtiyaç Listesi</title>
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; background: #fff; color: #1e293b; }
                .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 25px; }
                .header h1 { font-size: 28px; color: #0f172a; }
                .header p { color: #64748b; font-size: 14px; margin-top: 4px; }
                .siparis { background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0; page-break-inside: avoid; }
                .siparis-baslik { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                .siparis-baslik h3 { font-size: 18px; color: #0f172a; }
                .siparis-baslik .durum { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
                .durum-bekliyor { background: #fef3c7; color: #92400e; }
                .durum-siparis_verildi { background: #dbeafe; color: #1e40af; }
                .durum-tamamlandi { background: #d1fae5; color: #065f46; }
                .durum-iptal { background: #fee2e2; color: #991b1b; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
                th { background: #1e293b; color: #fff; padding: 10px 14px; text-align: left; }
                td { padding: 8px 14px; border-bottom: 1px solid #e2e8f0; }
                .bilgi { font-size: 13px; color: #64748b; margin-top: 8px; }
                .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
                @media print { body { padding: 15px; } .siparis { break-inside: avoid; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📋 İhtiyaç Listesi</h1>
                <p>Oluşturulma: ${new Date().toLocaleString('tr-TR')}</p>
            </div>
    `;
    
    siparisler.forEach(s => {
        const durumClass = `durum-${s.durum || 'bekliyor'}`;
        const durumText = s.durum === 'bekliyor' ? 'Bekliyor' : 
                          s.durum === 'siparis_verildi' ? 'Sipariş Verildi' :
                          s.durum === 'tamamlandi' ? 'Tamamlandı' : 'İptal';
        const siparisNo = s.siparisNo || 'SIP-XXX';
        const tarih = s.tarih?.toDate().toLocaleString('tr-TR') || '-';
        
        html += `
            <div class="siparis">
                <div class="siparis-baslik">
                    <h3>${siparisNo}</h3>
                    <span class="durum ${durumClass}">${durumText}</span>
                </div>
                <div class="bilgi">📅 ${tarih} ${s.tedarikci ? '· 🏢 ' + s.tedarikci : ''}</div>
                <table>
                    <thead>
                        <tr><th>Ürün</th><th style="text-align:center;">Miktar</th><th style="text-align:center;">Birim</th></tr>
                    </thead>
                    <tbody>
        `;
        if (s.urunler && s.urunler.length > 0) {
            s.urunler.forEach(u => {
                html += `<tr><td>${u.urunAd}</td><td style="text-align:center; font-weight:600;">${u.miktar}</td><td style="text-align:center;">${u.birim || 'Adet'}</td></tr>`;
            });
        } else {
            html += `<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Ürün yok</td></tr>`;
        }
        html += `</tbody></table>`;
        if (s.not) html += `<div class="bilgi" style="margin-top:8px;">📝 Not: ${s.not}</div>`;
        html += `</div>`;
    });
    
    html += `
            <div class="footer">Stok Takip Pro · ${new Date().toLocaleDateString('tr-TR')}</div>
        </body>
        </html>
    `;
    
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
}

function ihtiyacDetayYazdir() {
    const id = window._siparisDetayId;
    if (id) ihtiyacListesiYazdir('tek', id);
}

async function siparisSepeteEkle(id) {
    try {
        const docSnap = await getDoc(doc(db, "siparisler", id));
        if (!docSnap.exists()) return showToast("Sipariş bulunamadı!", true);
        const data = docSnap.data();
        if (!data.urunler || data.urunler.length === 0) {
            return showToast("Bu siparişte ürün yok!", true);
        }
        
        let eklendi = 0;
        data.urunler.forEach(u => {
            const existing = sepet.find(item => item.id === u.urunId);
            if (existing) {
                existing.miktar += u.miktar;
            } else {
                sepet.push({
                    id: u.urunId,
                    ad: u.urunAd,
                    miktar: u.miktar
                });
            }
            eklendi++;
        });
        
        sepetiGoster();
        sepetiKaydet();
        showToast(`✅ ${eklendi} ürün sepete eklendi!`);
        
        await updateDoc(doc(db, "siparisler", id), { 
            durum: 'siparis_verildi',
            sepeteEklendi: Timestamp.now()
        });
        siparisleriListele();
        
    } catch(e) {
        console.error('Sepete ekleme hatası:', e);
        showToast(getFriendlyErrorMessage(e), true);
    }
}

// ================================================================
// FİLTRE, GRUP TOGGLE, TABLAR
// ================================================================
function tabloFiltrele() {
    const f = document.getElementById('aramaKutusu')?.value.toLowerCase() || "";
    document.querySelectorAll('#tablo tr').forEach(r => {
        if (r.classList.length === 0 || r.classList[0]?.startsWith('grup-')) r.style.display = '';
        else r.style.display = r.innerText.toLowerCase().includes(f) ? '' : 'none';
    });
}

function grupToggle(id) {
    document.querySelectorAll(`.${id}`).forEach(r => { r.style.display = r.style.display === 'none' ? 'table-row' : 'none'; });
}

// ================================================================
// TAB GEÇİŞLERİ
// ================================================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.quick-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    document.getElementById('mobileMenu')?.classList.remove('open');
    
    if (history.pushState) {
        history.pushState(null, '', '#' + tabId);
    }
}

// ================================================================
// DASHBOARD WIDGET YÖNETİMİ
// ================================================================
function dashboardWidgetlariYukle() {
    try {
        const kayitli = localStorage.getItem('dashboardWidgets');
        if (kayitli) {
            dashboardWidgets = JSON.parse(kayitli);
        } else {
            dashboardWidgets = ['toplamStok', 'kritik', 'bugunGiris', 'populer'];
        }
    } catch(e) {
        dashboardWidgets = ['toplamStok', 'kritik', 'bugunGiris', 'populer'];
    }
    dashboardWidgetlariGoster();
}

function dashboardWidgetlariGoster() {
    const container = document.getElementById('dashboardWidgets');
    if (!container) return;
    
    if (dashboardWidgets.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="flex:1;">
                <div class="empty-icon">📊</div>
                <h4>Henüz widget eklenmemiş</h4>
                <p>"Düzenle" butonuna tıklayarak widget ekleyin.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    dashboardWidgets.forEach(widgetId => {
        const widget = WIDGET_OPTIONS[widgetId];
        if (!widget) return;
        html += `
            <div class="dash-card" data-widget="${widgetId}">
                <small>${widget.title}</small>
                <div id="dash${widgetId.charAt(0).toUpperCase() + widgetId.slice(1)}">
                    <span style="font-size:16px; opacity:0.5;">⏳</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    
    dashboardWidgetVerileriniGuncelle();
}

function dashboardWidgetVerileriniGuncelle() {
    const toplam = Object.values(stoklar).reduce((sum, u) => sum + (u.kalan || 0), 0);
    const dashToplamStok = document.getElementById('dashToplamStok');
    if (dashToplamStok) dashToplamStok.innerHTML = `<div>${toplam}</div>`;
    
    const kritikSay = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5)).length;
    const dashKritik = document.getElementById('dashKritik');
    if (dashKritik) dashKritik.innerHTML = `<div>${kritikSay}</div>`;
    
    bugunOzetiniGetir();
    popularesiGetir();
    kritikListeWidgetGuncelle();
    sonHareketleriGetir();
    siparisSayisiniGetir();
    kullaniciSayisiniGetir();
    
    const dashGrupSayisi = document.getElementById('dashGrupSayisi');
    if (dashGrupSayisi) dashGrupSayisi.innerHTML = `<div>${Object.keys(gruplar).length}</div>`;
    const dashToplamUrunCesidi = document.getElementById('dashToplamUrunCesidi');
    if (dashToplamUrunCesidi) dashToplamUrunCesidi.innerHTML = `<div>${Object.keys(stoklar).length}</div>`;
    bugunCikisGetir();
}
// ================================================================
// DASHBOARD WIDGET YÖNETİMİ - EKLEME VE ÇIKARMA
// ================================================================

// Dashboard düzenleme modunu aç/kapat
window.dashboardDuzenleModu = function() {
    const panel = document.getElementById('widgetEklePanel');
    const widgets = document.querySelectorAll('#dashboardWidgets .dash-card');
    
    if (panel) {
        // Panel açık/kapa
        const isOpen = panel.style.display === 'block';
        panel.style.display = isOpen ? 'none' : 'block';
        
        // Widget'lara silme butonu ekle/çıkar
        widgets.forEach(card => {
            const widgetId = card.dataset.widget;
            const existingBtn = card.querySelector('.widget-sil-btn');
            
            if (!isOpen) {
                // Silme butonu ekle
                if (!existingBtn) {
                    const silBtn = document.createElement('button');
                    silBtn.className = 'widget-sil-btn';
                    silBtn.innerHTML = '✖';
                    silBtn.title = 'Widget\'ı kaldır';
                    silBtn.style.cssText = `
                        position: absolute;
                        top: 4px;
                        right: 4px;
                        background: var(--btn-danger);
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        font-size: 12px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0.8;
                        transition: all 0.2s;
                    `;
                    silBtn.onmouseover = () => silBtn.style.opacity = '1';
                    silBtn.onmouseout = () => silBtn.style.opacity = '0.8';
                    silBtn.onclick = function(e) {
                        e.stopPropagation();
                        widgetKaldir(widgetId);
                    };
                    card.style.position = 'relative';
                    card.appendChild(silBtn);
                }
            } else {
                // Silme butonunu kaldır
                if (existingBtn) {
                    existingBtn.remove();
                }
            }
        });
    }
};

// Widget kaldırma fonksiyonu
function widgetKaldir(widgetId) {
    const confirmed = confirm(`"${WIDGET_OPTIONS[widgetId]?.title || widgetId}" widget'ını kaldırmak istediğinize emin misiniz?`);
    if (!confirmed) return;
    
    // Widget listesinden çıkar
    dashboardWidgets = dashboardWidgets.filter(id => id !== widgetId);
    localStorage.setItem('dashboardWidgets', JSON.stringify(dashboardWidgets));
    
    // Widget'ı DOM'dan kaldır
    const card = document.querySelector(`#dashboardWidgets .dash-card[data-widget="${widgetId}"]`);
    if (card) {
        card.remove();
    }
    
    showToast('✅ Widget kaldırıldı');
    
    // Eğer hiç widget kalmadıysa boş mesaj göster
    if (dashboardWidgets.length === 0) {
        const container = document.getElementById('dashboardWidgets');
        if (container) {
            container.innerHTML = `
                <div class="empty-state" style="flex:1;">
                    <div class="empty-icon">📊</div>
                    <h4>Henüz widget eklenmemiş</h4>
                    <p>"Düzenle" butonuna tıklayarak widget ekleyin.</p>
                </div>
            `;
        }
    }
}

// Widget ekleme (mevcut fonksiyonu güncelle)
window.widgetEkle = function(widgetId) {
    if (!dashboardWidgets.includes(widgetId)) {
        dashboardWidgets.push(widgetId);
        localStorage.setItem('dashboardWidgets', JSON.stringify(dashboardWidgets));
        
        // Widget'ı DOM'a ekle
        const container = document.getElementById('dashboardWidgets');
        if (container) {
            // Boş durum mesajını kaldır
            const emptyState = container.querySelector('.empty-state');
            if (emptyState) emptyState.remove();
            
            const widget = WIDGET_OPTIONS[widgetId];
            if (widget) {
                const card = document.createElement('div');
                card.className = 'dash-card';
                card.dataset.widget = widgetId;
                card.innerHTML = `
                    <small>${widget.title}</small>
                    <div id="dash${widgetId.charAt(0).toUpperCase() + widgetId.slice(1)}">
                        <span style="font-size:16px; opacity:0.5;">⏳</span>
                    </div>
                `;
                container.appendChild(card);
                
                // Widget verilerini güncelle
                dashboardWidgetVerileriniGuncelle();
                showToast('✅ Widget eklendi');
            }
        }
    } else {
        showToast('ℹ️ Bu widget zaten ekli', true);
    }
};

// Dashboard widget'larını göster (güncellenmiş)
window.dashboardWidgetlariGoster = function() {
    const container = document.getElementById('dashboardWidgets');
    if (!container) return;
    
    if (dashboardWidgets.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="flex:1;">
                <div class="empty-icon">📊</div>
                <h4>Henüz widget eklenmemiş</h4>
                <p>"Düzenle" butonuna tıklayarak widget ekleyin.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    dashboardWidgets.forEach(widgetId => {
        const widget = WIDGET_OPTIONS[widgetId];
        if (!widget) return;
        html += `
            <div class="dash-card" data-widget="${widgetId}">
                <small>${widget.title}</small>
                <div id="dash${widgetId.charAt(0).toUpperCase() + widgetId.slice(1)}">
                    <span style="font-size:16px; opacity:0.5;">⏳</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    
    dashboardWidgetVerileriniGuncelle();
};

// Widget kaldırma butonlarını güncelle (düzenleme modu kapandığında temizle)
// Dashboard widget'larını yeniden gösterirken silme butonlarını temizle
const originalGoster = window.dashboardWidgetlariGoster;
window.dashboardWidgetlariGoster = function() {
    originalGoster();
    // Düzenleme modu kapalıysa silme butonlarını temizle
    const panel = document.getElementById('widgetEklePanel');
    if (panel && panel.style.display !== 'block') {
        document.querySelectorAll('#dashboardWidgets .dash-card .widget-sil-btn').forEach(btn => btn.remove());
    }
};
function widgetEkle(widgetId) {
    if (!dashboardWidgets.includes(widgetId)) {
        dashboardWidgets.push(widgetId);
        localStorage.setItem('dashboardWidgets', JSON.stringify(dashboardWidgets));
        dashboardWidgetlariGoster();
        showToast('✅ Widget eklendi');
    } else {
        showToast('ℹ️ Bu widget zaten ekli', true);
    }
}
// ================================================================
// WIDGET KALDIRMA İŞLEVİ (DÜZELTİLMİŞ)
// ================================================================

// ================================================================
// WIDGET KALDIRMA - ÇALIŞAN SÜRÜM
// ================================================================

window.widgetKaldir = function(widgetId) {
    const widgetTitle = WIDGET_OPTIONS[widgetId]?.title || widgetId;
    if (!confirm(`"${widgetTitle}" widget'ını kaldırmak istediğinize emin misiniz?`)) return;
    
    dashboardWidgets = dashboardWidgets.filter(id => id !== widgetId);
    localStorage.setItem('dashboardWidgets', JSON.stringify(dashboardWidgets));
    
    const card = document.querySelector(`#dashboardWidgets .dash-card[data-widget="${widgetId}"]`);
    if (card) card.remove();
    
    showToast('✅ Widget kaldırıldı');
    
    if (dashboardWidgets.length === 0) {
        const container = document.getElementById('dashboardWidgets');
        if (container) {
            container.innerHTML = `
                <div class="empty-state" style="flex:1;">
                    <div class="empty-icon">📊</div>
                    <h4>Henüz widget eklenmemiş</h4>
                    <p>"Düzenle" butonuna tıklayarak widget ekleyin.</p>
                </div>
            `;
        }
    }
    
    // Düzenleme modunu kapat
    document.getElementById('widgetEklePanel').style.display = 'none';
    document.querySelectorAll('#dashboardWidgets .dash-card .widget-sil-btn').forEach(btn => btn.remove());
};

window.dashboardDuzenleModu = function() {
    const panel = document.getElementById('widgetEklePanel');
    const widgets = document.querySelectorAll('#dashboardWidgets .dash-card');
    
    if (!panel) return;
    
    // Panel durumunu değiştir
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    
    // Widget'lara silme butonu ekle/çıkar
    widgets.forEach(card => {
        const widgetId = card.dataset.widget;
        if (!widgetId) return;
        
        const existingBtn = card.querySelector('.widget-sil-btn');
        
        if (!isOpen) {
            // Silme butonu ekle (zaten yoksa)
            if (!existingBtn) {
                const silBtn = document.createElement('button');
                silBtn.className = 'widget-sil-btn';
                silBtn.innerHTML = '✖';
                silBtn.title = 'Widget\'ı kaldır';
                silBtn.style.cssText = `
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 28px;
                    height: 28px;
                    background: #e74c3c;
                    color: white;
                    border: 2px solid white;
                    border-radius: 50%;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    z-index: 999;
                    transition: transform 0.2s;
                `;
                silBtn.onmouseover = () => silBtn.style.transform = 'scale(1.15)';
                silBtn.onmouseout = () => silBtn.style.transform = 'scale(1)';
                silBtn.onclick = function(e) {
                    e.stopPropagation();
                    window.widgetKaldir(widgetId);
                };
                card.style.position = 'relative';
                card.appendChild(silBtn);
                console.log('✅ Silme butonu eklendi:', widgetId);
            }
        } else {
            if (existingBtn) existingBtn.remove();
        }
    });
};
// ================================================================
// QUICK NAV YÖNETİMİ
// ================================================================
function toggleQuickNavSettings() {
    const modal = document.getElementById('quickNavSettingsModal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
        return;
    }
    
    const list = document.getElementById('quickNavSettingsList');
    if (!list) return;
    
    list.innerHTML = '';
    const menuItems = document.querySelectorAll('.quick-nav-btn');
    menuItems.forEach(btn => {
        const id = btn.dataset.tab;
        const icon = btn.querySelector('.nav-icon')?.textContent || '📄';
        const label = btn.querySelector('.nav-label')?.textContent || id;
        const checked = btn.style.display !== 'none';
        
        const item = document.createElement('div');
        item.className = 'quick-nav-settings-item';
        item.innerHTML = `
            <input type="checkbox" id="qnav-${id}" ${checked ? 'checked' : ''}>
            <label for="qnav-${id}">${icon} ${label}</label>
            <span class="drag-handle">⠿</span>
        `;
        item.querySelector('input').addEventListener('change', function() {
            const targetBtn = document.querySelector(`.quick-nav-btn[data-tab="${id}"]`);
            if (targetBtn) {
                targetBtn.style.display = this.checked ? 'flex' : 'none';
            }
        });
        list.appendChild(item);
    });
    
    modal.style.display = 'flex';
}

function closeQuickNavSettings() {
    document.getElementById('quickNavSettingsModal').style.display = 'none';
}

function saveQuickNavSettings() {
    const items = document.querySelectorAll('#quickNavSettingsList .quick-nav-settings-item');
    const settings = {};
    items.forEach(item => {
        const checkbox = item.querySelector('input');
        const label = item.querySelector('label');
        const id = checkbox.id.replace('qnav-', '');
        settings[id] = checkbox.checked;
    });
    localStorage.setItem('quickNavSettings', JSON.stringify(settings));
    closeQuickNavSettings();
    showToast('✅ Menü ayarları kaydedildi');
}

function toggleQuickNavPosition() {
    const nav = document.getElementById('quickNav');
    if (!nav) return;
    if (nav.classList.contains('bottom')) {
        nav.classList.remove('bottom');
        quickNavPosition = 'top';
    } else {
        nav.classList.add('bottom');
        quickNavPosition = 'bottom';
    }
    localStorage.setItem('quickNavPosition', quickNavPosition);
    showToast(`Menü ${quickNavPosition === 'top' ? 'üste' : 'alta'} taşındı`);
}

function loadQuickNavPosition() {
    const saved = localStorage.getItem('quickNavPosition');
    if (saved === 'bottom') {
        document.getElementById('quickNav')?.classList.add('bottom');
        quickNavPosition = 'bottom';
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu) {
        menu.classList.toggle('open');
    }
}

// ================================================================
// YEDEKLEME
// ================================================================
async function verileriYedekle(format = 'json') {
    const durum = document.getElementById('yedekleDurum');
    if (durum) durum.textContent = '⏳ Veriler hazırlanıyor...';
    
    try {
        const [stokSnap, hareketSnap, siparisSnap, kullaniciSnap] = await Promise.all([
            getDocs(collection(db, "stoklar")),
            getDocs(query(collection(db, "hareketler"), limit(1000))),
            getDocs(collection(db, "siparisler")),
            getDocs(collection(db, "kullanicilar"))
        ]);
        
        const data = {
            stoklar: stokSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            hareketler: hareketSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            siparisler: siparisSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            kullanicilar: kullaniciSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            yedekTarihi: new Date().toISOString()
        };
        
        let blob, dosyaAdi;
        if (format === 'csv') {
            const rows = data.stoklar.map(u => `${u.urunAd},${u.barkod || ''},${u.kalan || 0},${u.kritik || 5},${u.grup || 'Genel'}`);
            const csv = 'Ürün Adı,Barkod,Stok,Kritik,Grup\n' + rows.join('\n');
            blob = new Blob([csv], { type: 'text/csv' });
            dosyaAdi = `yedek_${new Date().toISOString().slice(0,10)}.csv`;
        } else {
            blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            dosyaAdi = `yedek_${new Date().toISOString().slice(0,10)}.json`;
        }
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = dosyaAdi;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (durum) durum.textContent = `✅ ${format.toUpperCase()} yedek indirildi! (${data.stoklar.length} ürün, ${data.hareketler.length} hareket)`;
        showToast(`📥 Yedek indiriliyor (${format.toUpperCase()})`);
        
    } catch(e) {
        console.error('Yedekleme hatası:', e);
        if (durum) durum.textContent = '❌ Hata: ' + e.message;
        showToast(getFriendlyErrorMessage(e), true);
    }
}

// ================================================================
// SİTE VERİLERİNİ TEMİZLE
// ================================================================
async function clearSiteData() {
    const confirmed = await showConfirm('🗑️ Depolama Alanını Temizle', 
        'Bu işlem tüm yerel verileri (önbellek, localStorage, indexedDB) temizleyecek. Devam etmek istediğinize emin misiniz?');
    if (!confirmed) return;
    
    try {
        localStorage.clear();
        
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
        
        try {
            const dbs = await indexedDB.databases?.() || [];
            await Promise.all(dbs.map(db => indexedDB.deleteDatabase(db.name)));
        } catch(e) { console.warn('IndexedDB temizlenemedi:', e); }
        
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.update();
        }
        
        showToast('✅ Tüm yerel veriler temizlendi! Sayfa yenileniyor...');
        setTimeout(() => window.location.reload(), 1500);
    } catch(e) {
        console.error('Temizleme hatası:', e);
        showToast('❌ Bazı veriler temizlenemedi: ' + e.message, true);
    }
}

// ================================================================
// SİPARİS PDF
// ================================================================
function siparisPDF() {
    const k = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (!k.length) return showToast("Kritik ürün yok!", true);
    const w = window.open('', '_blank');
    w.document.write(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Sipariş</title>
            <style>
                body { font-family: system-ui; padding: 20px; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                th { background: #e74c3c; color: white; }
            </style>
        </head>
        <body>
            <h1>Sipariş Listesi</h1>
            <p>${new Date().toLocaleString('tr-TR')}</p>
            <table>
                <thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead>
                <tbody>
                    ${k.map(u => `<tr><td>${getUrunAdi(u)}</td><td>${u.kalan}</td><td>${u.kritik}</td><td>${Math.max(0,(u.kritik*2)-u.kalan)}</td></tr>`).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `);
    w.document.close();
    w.print();
}

function siparisYazdir() {
    const k = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (!k.length) return showToast("Kritik ürün yok!", true);
    const w = window.open('', '_blank');
    w.document.write(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Sipariş</title>
            <style>
                body { font-family: system-ui; padding: 20px; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                th { background: #e74c3c; color: white; }
            </style>
        </head>
        <body>
            <h1>Sipariş Listesi</h1>
            <p>${new Date().toLocaleString('tr-TR')}</p>
            <table>
                <thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead>
                <tbody>
                    ${k.map(u => `<tr><td>${getUrunAdi(u)}</td><td>${u.kalan}</td><td>${u.kritik}</td><td>${Math.max(0,(u.kritik*2)-u.kalan)}</td></tr>`).join('')}
                </tbody>
            </table>
            <script>window.print();</script>
        </body>
        </html>
    `);
    w.document.close();
}

document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('quickNavContainer');
    const mobileMenu = document.getElementById('mobileMenu');
    if (!container) return;

    // ANA BUTONLAR (her zaman görünür - 5 tane)
    const primaryTabs = [
        { id: 'hizli-islem', icon: '⚡', label: 'Hızlı' },
        { id: 'stok-listesi', icon: '📋', label: 'Stok' },
        { id: 'hareketler', icon: '🕒', label: 'Hareket' },
        { id: 'rapor', icon: '📊', label: 'Rapor' },
        { id: 'siparisler', icon: '📦', label: 'Sipariş' }
    ];

    // İKİNCİL BUTONLAR ("Daha Fazla" menüsünde)
    const secondaryTabs = [
        { id: 'yeni-urun', icon: '➕', label: 'Yeni Ürün Ekle' },
        { id: 'gruplar', icon: '📁', label: 'Gruplar' },
        { id: 'kullanicilar', icon: '👥', label: 'Kullanıcılar' },
        { id: 'loglar', icon: '📋', label: 'Loglar' },
        { id: 'feedback', icon: '💬', label: 'Geri Bildirim Gönder' },
        { id: 'feedback-list', icon: '📬', label: 'Geri Bildirimler' },
        { id: 'yedekle', icon: '💾', label: 'Yedekleme' }
    ];

    // Ana butonları oluştur
    primaryTabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.className = 'quick-nav-btn';
        btn.dataset.tab = tab.id;
        btn.innerHTML = `<span class="nav-icon">${tab.icon}</span><span class="nav-label">${tab.label}</span>`;
        btn.addEventListener('click', () => switchTab(tab.id));
        container.appendChild(btn);
    });

    // "Daha Fazla" butonu
    const moreBtn = document.createElement('button');
    moreBtn.className = 'quick-nav-btn more-btn';
    moreBtn.innerHTML = `<span class="nav-icon">⋮</span><span class="nav-label">Daha</span>`;
    moreBtn.onclick = () => toggleMoreMenu();
    container.appendChild(moreBtn);

    // Mobil menüye (Daha Fazla açılır menüsü) TÜM sekmeleri ekle
    if (mobileMenu) {
        mobileMenu.innerHTML = '';
        [...primaryTabs, ...secondaryTabs].forEach(tab => {
            const a = document.createElement('a');
            a.href = '#' + tab.id;
            a.textContent = tab.icon + ' ' + tab.label;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(tab.id);
                mobileMenu.classList.remove('open');
            });
            mobileMenu.appendChild(a);
        });
    }

    const defaultTab = window.location.hash?.replace('#', '') || 'hizli-islem';
    setTimeout(() => switchTab(defaultTab), 100);
});

// YENİ: Daha Fazla menüsünü aç/kapa
function toggleMoreMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu) menu.classList.toggle('open');
}

// ================================================================
// GLOBAL FONKSİYONLARI WINDOW OBJESİNE EKLE (EXPORT)
// ================================================================
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showProgress = showProgress;
window.updateProgress = updateProgress;
window.hideProgress = hideProgress;
window.showConfirm = showConfirm;
window.getFriendlyErrorMessage = getFriendlyErrorMessage;
window.getUrunAdi = getUrunAdi;
window.adminMi = adminMi;
window.yoneticiMi = yoneticiMi;

// Auth
window.kullaniciGiris = kullaniciGiris;
window.kullaniciKayit = kullaniciKayit;
window.kullaniciCikis = kullaniciCikis;
window.switchLoginTab = switchLoginTab;

// Şifre sıfırlama
window.sifreSifirlamaFormuGoster = sifreSifirlamaFormuGoster;
window.sifreSifirlamaModalKapat = sifreSifirlamaModalKapat;
window.sifreSifirlamaGonder = sifreSifirlamaGonder;

// Stok işlemleri
window.stokIslem = stokIslem;
window.urunEkle = urunEkle;
window.urunGuncelle = urunGuncelle;
window.urunSil = urunSil;
window.detayGoster = detayGoster;
window.kapatModal = kapatModal;
window.urunDetayGoster = urunDetayGoster;

// Sepet
window.sepeteEkle = sepeteEkle;
window.sepetSil = sepetSil;
window.topluIslem = topluIslem;
window.sepetiGoster = sepetiGoster;
window.sepetiKaydet = sepetiKaydet;
window.sepetiYukle = sepetiYukle;

// Kamera
window.kameraBaslat = kameraBaslat;
window.kameraDurdur = kameraDurdur;
window.yeniUrunKamera = yeniUrunKamera;

// Rapor
window.raporOlustur = raporOlustur;
window.excelIndir = excelIndir;
window.pdfIndir = pdfIndir;

// Siparişler
window.siparisFormuGoster = siparisFormuGoster;
window.siparisModalKapat = siparisModalKapat;
window.siparisUrunSatirEkle = siparisUrunSatirEkle;
window.siparisKaydet = siparisKaydet;
window.siparisDetayGoster = siparisDetayGoster;
window.siparisDetayKapat = siparisDetayKapat;
window.siparisDurumGuncelle = siparisDurumGuncelle;
window.siparisSil = siparisSil;
window.siparisDuzenle = siparisDuzenle;
window.siparisleriFiltrele = siparisleriFiltrele;
window.kritikStoktanSiparisOlustur = kritikStoktanSiparisOlustur;
window.ihtiyacListesiYazdir = ihtiyacListesiYazdir;
window.ihtiyacDetayYazdir = ihtiyacDetayYazdir;
window.siparisSepeteEkle = siparisSepeteEkle;
window.siparisPDF = siparisPDF;
window.siparisYazdir = siparisYazdir;
window.siparisleriListele = siparisleriListele;
window.sonSiparisNumarasiAl = sonSiparisNumarasiAl;
window.siparisVerileriniGetir = siparisVerileriniGetir;

// Grup
window.grupEkleFormuGoster = grupEkleFormuGoster;
window.grupDuzenle = grupDuzenle;
window.grupModalKapat = grupModalKapat;
window.grupKaydet = grupKaydet;
window.grupSil = grupSil;
window.gruplariFiltrele = gruplariFiltrele;
window.gruplariGetir = gruplariGetir;
window.grupListesiniGoster = grupListesiniGoster;
window.grupSelectleriGuncelle = grupSelectleriGuncelle;
window.grupSelectleriDoldur = grupSelectleriDoldur;

// Hareketler
window.hareketleriFiltrele = hareketleriFiltrele;
window.hareketleriTemizle = hareketleriTemizle;
window.hareketSil = hareketSil;
window.hareketDuzenle = hareketDuzenle;
window.hareketDuzenleKapat = hareketDuzenleKapat;
window.hareketDuzenleKaydet = hareketDuzenleKaydet;
window.hareketleriListele = hareketleriListele;

// Kullanıcı
window.adminKullaniciOnayla = adminKullaniciOnayla;
window.adminKullaniciEkle = adminKullaniciEkle;
window.kullaniciListesiniGetir = kullaniciListesiniGetir;

// Log
window.loglariGetir = loglariGetir;
window.loglariFiltrele = loglariFiltrele;
window.logSayfaDegistir = logSayfaDegistir;
window.loglariTemizle = loglariTemizle;

// Feedback
window.feedbackGonder = feedbackGonder;
window.feedbackDurumGuncelle = feedbackDurumGuncelle;
window.feedbackSil = feedbackSil;
window.feedbackListele = feedbackListele;

// Widget
window.widgetEkle = widgetEkle;
window.dashboardDuzenleModu = dashboardDuzenleModu;
window.dashboardWidgetlariYukle = dashboardWidgetlariYukle;
window.dashboardWidgetlariGoster = dashboardWidgetlariGoster;
window.dashboardWidgetVerileriniGuncelle = dashboardWidgetVerileriniGuncelle;

// Quick Nav
window.toggleQuickNavSettings = toggleQuickNavSettings;
window.closeQuickNavSettings = closeQuickNavSettings;
window.saveQuickNavSettings = saveQuickNavSettings;
window.toggleQuickNavPosition = toggleQuickNavPosition;
window.toggleMobileMenu = toggleMobileMenu;
window.loadQuickNavPosition = loadQuickNavPosition;

// Yedekleme
window.verileriYedekle = verileriYedekle;

// Site Temizleme
window.clearSiteData = clearSiteData;

// Arama
window.gelişmişArama = gelişmişArama;
window.aramaTemizle = aramaTemizle;
window.tabloFiltrele = tabloFiltrele;
window.grupToggle = grupToggle;
window.switchTab = switchTab;

// Excel
window.excelUrunleriYukle = excelUrunleriYukle;

// Bildirim
window.requestNotificationPermission = window.requestNotificationPermission;
window.sendNotification = window.sendNotification;
window.debounceSearch = window.debounceSearch;

// Özet
window.bugunOzetiniGetir = bugunOzetiniGetir;
window.bugunCikisGetir = bugunCikisGetir;
window.popularesiGetir = popularesiGetir;
window.sonHareketleriGetir = sonHareketleriGetir;
window.siparisSayisiniGetir = siparisSayisiniGetir;
window.kullaniciSayisiniGetir = kullaniciSayisiniGetir;

// Diğer
window.grafikGuncelle = grafikGuncelle;
window.badgeGuncelle = badgeGuncelle;
window.kritikListeWidgetGuncelle = kritikListeWidgetGuncelle;
window.kritikKontrol = kritikKontrol;
window.stoklariListele = stoklariListele;
window.oturumZamanAsimiBaslat = oturumZamanAsimiBaslat;
window.oturumZamanAsimiSifirla = oturumZamanAsimiSifirla;
window.populateTimeSelects = populateTimeSelects;

// Widget fonksiyonlarını window'a ekle (eksikse)
window.widgetKaldir = window.widgetKaldir || widgetKaldir;
window.dashboardDuzenleModu = window.dashboardDuzenleModu || dashboardDuzenleModu;
window.widgetEkle = window.widgetEkle || widgetEkle;
window.dashboardWidgetlariGoster = window.dashboardWidgetlariGoster || dashboardWidgetlariGoster;
window.dashboardWidgetVerileriniGuncelle = window.dashboardWidgetVerileriniGuncelle;
// ========== EKSİK EXPORT'LAR (DÜZELTME) ==========
window.toggleMoreMenu = toggleMoreMenu;
window.detayGeri = detayGeri;

// ========== DEBOUNCE SEARCH (eksik fonksiyon) ==========
const _debouncedFunctions = {};
function debounceSearch(inputId, callback) {
    if (!_debouncedFunctions[inputId]) {
        _debouncedFunctions[inputId] = debounce(callback, 300);
    }
    _debouncedFunctions[inputId]();
}
window.debounceSearch = debounceSearch;

console.log('✅ Tüm fonksiyonlar global olarak tanımlandı!');