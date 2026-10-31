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
let sadeceKritikGoster = false;
let secilenHareketler = new Set();
let aktifHareketFiltreleri = {};
let stokTahminleri = {};
let bekleyenEfaturaUrunleri = []; // Eşleşmeyen fatura ürünlerini tutar
let aktifEfaturaTarihi = Timestamp.now(); // XML'den okunan fatura tarihini tutar

// TÜM MENÜLERİN LİSTESİ (Hem yatay hem dikey menü için)
const ALL_TABS = [
    { id: 'genel-bakis',  icon: '📊', label: 'Genel Bakış', adminOnly: false },
    { id: 'hizli-islem',  icon: '⚡', label: 'Hızlı',       adminOnly: false },
    { id: 'stok-listesi', icon: '📋', label: 'Stok',         adminOnly: false },
    { id: 'hareketler',   icon: '🕒', label: 'Hareket',      adminOnly: false },
    { id: 'rapor',        icon: '📊', label: 'Rapor',        adminOnly: false },
    { id: 'siparisler',   icon: '📦', label: 'Sipariş',      adminOnly: false },
    { id: 'fatura-arsivi',icon: '🧾', label: 'Fatura Arşivi',adminOnly: false },
    { id: 'yeni-urun',    icon: '➕', label: 'Ürün/Veri Ekle',adminOnly: false },
    { id: 'gruplar',      icon: '📁', label: 'Gruplar',      adminOnly: false },
    { id: 'feedback',     icon: '💬', label: 'Geri Bildirim',adminOnly: false },
    { id: 'kullanicilar', icon: '👥', label: 'Kullanıcılar', adminOnly: true },
    { id: 'loglar',       icon: '📋', label: 'Loglar',       adminOnly: true },
    { id: 'feedback-list',icon: '📬', label: 'Geri Bildirimler', adminOnly: true },
    { id: 'yedekle',      icon: '💾', label: 'Yedekleme',    adminOnly: true }
];

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
    bugunCikis: { id: 'bugunCikis', title: '📤 Bugün Çıkış', icon: '📤' },
    tahminiTukenenler: { id: 'tahminiTukenenler', title: '⏳ Hızlı Tükenenler', icon: '⏳' } // YENİ EKLENDİ
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
    if (!mevcutKullanici) {
        console.warn("⚠️ Log atlanıyor: Kullanıcı oturumu yok.");
        return;
    }
    try {
        console.log(`📝 Log ekleniyor: [${islem}] - ${detay}`);
        const docRef = await addDoc(collection(db, "logs"), {
            kullanici: mevcutKullanici.email,
            islem: islem,
            detay: detay,
            tarih: Timestamp.now(),
            ...ekstra
        });
        console.log(`✅ Log başarıyla kaydedildi. ID: ${docRef.id}`);
    } catch(e) {
        console.error('❌ Log eklenemedi:', e);
        showToast('Log kaydedilemedi! Konsolu (F12) kontrol edin.', true);
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
// Şifre Göster / Gizle Fonksiyonu
window.sifreGosterGizle = function(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconElement.textContent = '🙈'; // Gizle ikonu
    } else {
        input.type = 'password';
        iconElement.textContent = '👁️'; // Göster ikonu
    }
};
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

        buildQuickNav();
        oturumZamanAsimiBaslat();
        checkForUpdates();
        if (adminMi()) kullaniciListesiniGetir();
        await birimDonusumleriniYukle();
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

              setTimeout(async () => {
            try {
                await logEkle('giris', 'Kullanıcı giriş yaptı');
            } catch (e) {
                console.warn('Giriş logu eklenemedi:', e.message);
            }
        }, 1500); // 1.5 saniye bekle

        } else {
        // ÖNCE log at (mevcutKullanici henüz null olmadığı için)
        if (mevcutKullanici) {
            try {
                await logEkle('cikis', 'Kullanıcı çıkış yaptı');
            } catch (e) {
                console.warn('Çıkış logu eklenemedi:', e.message);
            }
        }
        
        // SONRA kullanıcıyı sıfırla
        mevcutKullanici = null;
        mevcutRol = null;
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
        if (inaktiviteTimeout) clearTimeout(inaktiviteTimeout);
        loadRememberMe();
    }
});

// ================================================================
// LOG GÖSTERİMİ
// ================================================================
async function loglariGetir() {
    console.log("🚀 loglariGetir fonksiyonu tetiklendi! Veriler isteniyor...");
    const tbody = document.getElementById('logTabloGovde');
    if (!tbody) {
        console.error("❌ HATA: logTabloGovde elementi bulunamadı!");
        return;
    }
    try {
        showLoading('Loglar yükleniyor...');
        console.log("📡 Firebase'e sorgu atılıyor: logFiltre =", logFiltre);
        // ... geri kalan kod aynı ...
        let q;
        // Filtre yoksa sadece orderBy kullan (Index gerektirmez)
        if (logFiltre === 'hepsi') {
            q = query(collection(db, "logs"), orderBy("tarih", "desc"), limit(LOG_LIMIT));
        } else {
            // Filtre varsa where + orderBy (Index gerekebilir)
            q = query(collection(db, "logs"), where("islem", "==", logFiltre), orderBy("tarih", "desc"), limit(LOG_LIMIT));
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
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--btn-danger); padding:20px;">
            ❌ Loglar yüklenirken hata oluştu.<br>
            <small>${e.message}</small>
        </td></tr>`;
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
window.kritikFiltreToggle = function() {
    sadeceKritikGoster = !sadeceKritikGoster;
    const btn = document.getElementById('kritikFiltreBtn');
    if (btn) {
        if (sadeceKritikGoster) {
            btn.style.background = 'var(--danger)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'var(--card-border)';
            btn.style.color = 'var(--text)';
        }
    }
    stoklariListele();
};

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
        // Kritik filtresi açıksa, o gruptaki kritik olmayan ürünleri gizle
        const urunler = gruplar_temp[grup].filter(u => !sadeceKritikGoster || ((u.kalan || 0) <= (u.kritik || 5)));
        
        if (urunler.length === 0) return; // Grupta gösterilecek ürün kalmadıysa grubu atla

        const grupId = `grup-${idx}`;
        html += `<tr onclick="window.grupToggle('${grupId}')" style="background:var(--btn-warning); cursor:pointer;">
                    <td colspan="3"><b>📂 ${grup}</b></td>
                 </tr>`;
                urunler.forEach(u => {
            const m = u.kalan || 0, k = u.kritik || 5;
            toplam += m;
            if (m <= k) kritikSay++;
            
            // Tahmin verisini al
            const tahmin = stokTahminleri[u.id];
            let tahminHtml = '';
            if (tahmin && tahmin.gun !== Infinity && m > 0) {
                let renk = tahmin.durum === 'kritik' ? 'var(--danger)' : (tahmin.durum === 'uyari' ? 'var(--warning)' : 'var(--text-secondary)');
                tahminHtml = `<br><small style="color:${renk}; font-weight:600;">⏳ ~${tahmin.gun} günlük stok</small>`;
            } else if (m === 0) {
                tahminHtml = `<br><small style="color:var(--danger); font-weight:600;">🚨 Stok Bitti</small>`;
            }

            html += `<tr class="${grupId}" onclick="window.urunDetayGoster('${u.id}')" style="display:none; cursor:pointer;">
                        <td style="padding-left:20px;">${getUrunAdi(u)}${tahminHtml}<br><small style="color:#888">${u.barkod || '-'}</small></td>
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
// ========== STOK TÜKENME TAHMİNİ ==========
async function stokTahminleriniHesapla() {
    try {
        // Son 30 günün tarihini al
        const son30Gun = new Date();
        son30Gun.setDate(son30Gun.getDate() - 30);
        son30Gun.setHours(0, 0, 0, 0);

        // Son 30 gündeki çıkışları çek
        const snap = await getDocs(query(
            collection(db, "hareketler"),
            where("tarih", ">=", Timestamp.fromDate(son30Gun)),
            where("tur", "==", "cikis")
        ));

        const urunCikislari = {};
        snap.forEach(d => {
            const h = d.data();
            if (h.urunId) {
                urunCikislari[h.urunId] = (urunCikislari[h.urunId] || 0) + Number(h.miktar || 0);
            }
        });

        stokTahminleri = {};

        Object.values(stoklar).forEach(u => {
            const toplamCikis = urunCikislari[u.id] || 0;
            const gunlukOrtalama = toplamCikis / 30;
            const mevcutStok = u.kalan || 0;

            if (gunlukOrtalama > 0) {
                const kalanGun = Math.floor(mevcutStok / gunlukOrtalama);
                stokTahminleri[u.id] = {
                    gun: kalanGun,
                    ortalama: gunlukOrtalama.toFixed(1),
                    durum: kalanGun <= 7 ? 'kritik' : (kalanGun <= 15 ? 'uyari' : 'normal')
                };
            } else {
                // Eğer son 30 günde hiç çıkış yoksa tükenmez (Infinity)
                stokTahminleri[u.id] = { gun: Infinity, ortalama: 0, durum: 'normal' };
            }
        });

        // Ekranı güncelle
        stoklariListele(); 
        tahminiTukenenlerWidgetGuncelle();
        
    } catch(e) {
        console.error('Tahmin hesaplama hatası:', e);
    }
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
        stokTahminleriniHesapla(); // Tahminleri hesapla
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
async function hareketleriListele(filters = null) {
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
                const isChecked = secilenHareketler.has(id) ? 'checked' : '';
                
                html += `<tr>
                    <td style="text-align: center;">
                        ${isAdmin ? `<input type="checkbox" class="hareket-checkbox" value="${id}" ${isChecked} onchange="hareketSec('${id}', this.checked)">` : ''}
                    </td>
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
                <td></td>
                <td colspan="2" style="padding:10px 12px; color:var(--text);">📊 TOPLAM</td>
                <td style="padding:10px 12px; text-align:center; color:#2ecc71;">+${toplamGiris}</td>
                <td style="padding:10px 12px; text-align:center; color:#e74c3c;">-${toplamCikis}</td>
                <td></td>
            </tr>`;
            tbody.innerHTML = html;
            
            guncelleTopluSilBtn();
            
            const selectAllCb = document.getElementById('selectAllHareketler');
            if (selectAllCb) {
                const checkboxes = document.querySelectorAll('.hareket-checkbox');
                selectAllCb.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
            }
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
    secilenHareketler.clear(); // Filtre değişince seçimleri temizle
    hareketleriListele({ baslangic, bitis, urunFiltre });
}

function hareketleriTemizle() {
    document.getElementById('hareketBaslangic').value = '';
    document.getElementById('hareketBitis').value = '';
    document.getElementById('hareketUrunFiltre').value = '';
    secilenHareketler.clear();
    hareketleriListele({});
}

window.hareketSec = function(id, checked) {
    if (checked) secilenHareketler.add(id);
    else secilenHareketler.delete(id);
    guncelleTopluSilBtn();
};

window.tumHareketleriSec = function(checked) {
    const checkboxes = document.querySelectorAll('.hareket-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) secilenHareketler.add(cb.value);
        else secilenHareketler.delete(cb.value);
    });
    guncelleTopluSilBtn();
};

function guncelleTopluSilBtn() {
    const btn = document.getElementById('topluHareketSilBtn');
    if (btn) {
        btn.style.display = secilenHareketler.size > 0 ? 'inline-block' : 'none';
        btn.innerHTML = `🗑️ Seçilenleri Sil (${secilenHareketler.size})`;
    }
}

window.topluHareketSil = async function() {
    if (!adminMi()) return showToast("❌ Bu işlem için admin yetkisi gerekli!", true);
    if (secilenHareketler.size === 0) return showToast("Hiç hareket seçilmedi!", true);

    const confirmed = await showConfirm('🗑️ Toplu Hareket Sil', `${secilenHareketler.size} adet hareketi silmek istediğinize emin misiniz?\n\nBu işlem stok miktarlarını da geriye alacaktır!`);
    if (!confirmed) return;

    showLoading('Hareketler siliniyor ve stoklar güncelleniyor...');

    try {
        const batch = writeBatch(db);
        let etkilenenStoklar = {}; 

        const ids = Array.from(secilenHareketler);
        for (const id of ids) {
            const hSnap = await getDoc(doc(db, "hareketler", id));
            if (hSnap.exists()) {
                const h = hSnap.data();
                if (h.urunId) {
                    if (!etkilenenStoklar[h.urunId]) {
                        const stokSnap = await getDoc(doc(db, "stoklar", h.urunId));
                        if (stokSnap.exists()) {
                            etkilenenStoklar[h.urunId] = { kalan: Number(stokSnap.data().kalan || 0), degisim: 0 };
                        }
                    }
                    if (etkilenenStoklar[h.urunId]) {
                        if (h.tur === 'giris') etkilenenStoklar[h.urunId].degisim -= Number(h.miktar || 0);
                        else etkilenenStoklar[h.urunId].degisim += Number(h.miktar || 0);
                    }
                }
                batch.delete(doc(db, "hareketler", id));
            }
        }

        for (const [urunId, data] of Object.entries(etkilenenStoklar)) {
            const yeniStok = data.kalan + data.degisim;
            if (yeniStok < 0) {
                hideLoading();
                return showToast(`❌ İşlem iptal edildi: Silme sonucunda bir ürünün stoğu negatife düşüyor!`, true);
            }
            batch.update(doc(db, "stoklar", urunId), { kalan: yeniStok });
        }

        await batch.commit();
        hideLoading();
        showToast(`✅ ${secilenHareketler.size} hareket başarıyla silindi.`);
        
        secilenHareketler.clear();
        guncelleTopluSilBtn();
        hareketleriListele(); // Filtreyi koruyarak yenile
        
        const selectAllCb = document.getElementById('selectAllHareketler');
        if (selectAllCb) selectAllCb.checked = false;
        
    } catch(e) {
        hideLoading();
        console.error('Toplu silme hatası:', e);
        showToast(getFriendlyErrorMessage(e), true);
    }
};
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
                await logEkle('hareket_sil', `Hareket silindi: ${hareket.urun || '-'} (${hareket.miktar} ${hareket.birim || 'Adet'} ${hareket.tur === 'giris' ? 'Giriş' : 'Çıkış'})`);
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
            await logEkle('hareket_guncelle', `Hareket güncellendi. Eski: ${eski.miktar} ${eski.tur === 'giris' ? 'Giriş' : 'Çıkış'} -> Yeni: ${yeniMiktar} ${yeniTur === 'giris' ? 'Giriş' : 'Çıkış'}`);
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
            
            durum.textContent = `📥 ${rows.length} satır okundu, kontrol ediliyor...`;
            durum.style.color = 'var(--text-secondary)';
            
            const validRows = [];
            let hatali = 0;
            
            // Önce verileri doğrula ve listeye al
            for (const row of rows) {
                const ad = row.ürünAdı || row.urunAdi || row.ad || row.Ad || row.ÜrünAdı;
                if (!ad) { hatali++; continue; }
                
                validRows.push({
                    urunAd: ad.trim(),
                    barkod: (row.barkod || row.Barkod || '').trim(),
                    kalan: Number(row.kalan || row.stok || 0),
                    kritik: Number(row.kritik || row.Kritik || 5),
                    grup: (row.grup || row.Grup || 'Genel').trim(),
                    birim: row.birim || row.Birim || 'Adet',
                    olusturmaTarihi: Timestamp.now()
                });
            }
            
            if (validRows.length === 0) {
                durum.textContent = '❌ Geçerli ürün bulunamadı.';
                durum.style.color = 'var(--btn-danger)';
                return;
            }

            // 500 limitini aşmamak için 400'lük parçalar halinde yükle
            let eklenen = 0;
            const CHUNK_SIZE = 400;
            
            for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
                const chunk = validRows.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);
                
                chunk.forEach(item => {
                    const docRef = doc(collection(db, "stoklar"));
                    batch.set(docRef, item);
                });
                
                await batch.commit();
                eklenen += chunk.length;
                durum.textContent = `⏳ Yükleniyor: ${eklenen} / ${validRows.length} ürün...`;
            }
            
            durum.textContent = `✅ Başarılı! ${eklenen} ürün eklendi. ${hatali > 0 ? `(${hatali} satır atlandı)` : ''}`;
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
    
    const eskiUrun = stoklar[seciliUrunId];
    const yeniMiktar = Number(document.getElementById('modalMiktar').value);
    const eskiMiktar = eskiUrun?.kalan || 0;
    const fark = yeniMiktar - eskiMiktar;

    try {
        const batch = writeBatch(db);
        
        // 1. Ürünü güncelle
        batch.update(doc(db, "stoklar", seciliUrunId), {
            urunAd: document.getElementById('modalUrunAd').value,
            barkod: document.getElementById('modalBarkod').value,
            kalan: yeniMiktar,
            kritik: Number(document.getElementById('modalKritik').value),
            grup: document.getElementById('modalGrup').value
        });

        // 2. Eğer stok miktarı değiştiyse, otomatik hareket kaydı oluştur
        if (fark !== 0) {
            const hareketRef = doc(collection(db, "hareketler"));
            batch.set(hareketRef, {
                urunId: seciliUrunId,
                urun: document.getElementById('modalUrunAd').value,
                tur: fark > 0 ? 'giris' : 'cikis',
                miktar: Math.abs(fark),
                birim: eskiUrun?.birim || 'Adet',
                tarih: Timestamp.now(),
                aciklama: 'Manuel stok düzeltmesi (Ürün Güncelleme Ekranı)'
            });
        }

        await batch.commit();
        
        showToast(fark !== 0 ? `✅ Güncellendi. Stok ${fark > 0 ? '+' : ''}${fark}` : "✅ Güncellendi");
        await logEkle('urun_guncelle', `${getUrunAdi(stoklar[seciliUrunId])} güncellendi`, { urunId: seciliUrunId });
        
        kapatModal();
        
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'urun-detay') {
            detayGeri();
        }
    } catch(e) { 
        showToast(getFriendlyErrorMessage(e), true); 
    }
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
    await logEkle(`toplu_${tip}`, `Sepetten toplu ${tip === 'giris' ? 'Giriş' : 'Çıkış'} yapıldı. Toplam ${sepet.length} çeşit ürün işlendi.`);
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
        await logEkle('siparis_ekle', `Yeni sipariş oluşturuldu: ${duzenleId ? 'Düzenlendi' : (data.siparisNo || 'Yeni')} - ${urunler.length} kalem ürün`);
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
        await logEkle('siparis_durum', `Sipariş durumu güncellendi: ${id} -> ${yeniDurum}`);
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
        await logEkle('siparis_sil', `Sipariş silindi (ID: ${id})`);
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

    // YENİ EKLENEN KISIM: Arşiv sekmesine geçişte listeyi güncelle
    if (tabId === 'fatura-arsivi') {
        faturaArsiviniListele();
    }

    // YENİ EKLENEN KISIM: Loglar sekmesine geçişte logları getir
    if (tabId === 'loglar') {
        loglariGetir();
    }
    
    if (history.pushState) {
        history.pushState(null, '', '#' + tabId);
    }
}

// ================================================================
// DASHBOARD WIDGET YÖNETİMİ (TEMİZ SÜRÜM)
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
    window.dashboardWidgetlariGoster();
}

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
    
    window.dashboardWidgetVerileriniGuncelle();
};

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
    tahminiTukenenlerWidgetGuncelle();

    const dashGrupSayisi = document.getElementById('dashGrupSayisi');
    if (dashGrupSayisi) dashGrupSayisi.innerHTML = `<div>${Object.keys(gruplar).length}</div>`;
    const dashToplamUrunCesidi = document.getElementById('dashToplamUrunCesidi');
    if (dashToplamUrunCesidi) dashToplamUrunCesidi.innerHTML = `<div>${Object.keys(stoklar).length}</div>`;
    bugunCikisGetir();
}

window.dashboardDuzenleModu = function() {
    const panel = document.getElementById('widgetEklePanel');
    if (!panel) return;
    
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    
    document.querySelectorAll('#dashboardWidgets .dash-card').forEach(card => {
        const widgetId = card.dataset.widget;
        if (!widgetId) return;
        
        const existingBtn = card.querySelector('.widget-sil-btn');
        
        if (!isOpen) {
            if (!existingBtn) {
                const silBtn = document.createElement('button');
                silBtn.className = 'widget-sil-btn';
                silBtn.innerHTML = '✖';
                silBtn.title = 'Widget\'ı kaldır';
                silBtn.onclick = function(e) {
                    e.stopPropagation();
                    window.widgetKaldir(widgetId);
                };
                card.style.position = 'relative';
                card.appendChild(silBtn);
            }
        } else {
            if (existingBtn) existingBtn.remove();
        }
    });
};

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
            container.innerHTML = `<div class="empty-state" style="flex:1;"><div class="empty-icon">📊</div><h4>Henüz widget eklenmemiş</h4><p>"Düzenle" butonuna tıklayarak widget ekleyin.</p></div>`;
        }
    }
    
    const panel = document.getElementById('widgetEklePanel');
    if (panel) panel.style.display = 'none';
    document.querySelectorAll('#dashboardWidgets .dash-card .widget-sil-btn').forEach(btn => btn.remove());
};

window.widgetEkle = function(widgetId) {
    if (!dashboardWidgets.includes(widgetId)) {
        dashboardWidgets.push(widgetId);
        localStorage.setItem('dashboardWidgets', JSON.stringify(dashboardWidgets));
        
        const container = document.getElementById('dashboardWidgets');
        if (container) {
            const emptyState = container.querySelector('.empty-state');
            if (emptyState) emptyState.remove();
            
            const widget = WIDGET_OPTIONS[widgetId];
            if (widget) {
                const card = document.createElement('div');
                card.className = 'dash-card';
                card.dataset.widget = widgetId;
                card.innerHTML = `<small>${widget.title}</small><div id="dash${widgetId.charAt(0).toUpperCase() + widgetId.slice(1)}"><span style="font-size:16px; opacity:0.5;">⏳</span></div>`;
                container.appendChild(card);
                
                window.dashboardWidgetVerileriniGuncelle();
                showToast('✅ Widget eklendi');
                
                if (document.getElementById('widgetEklePanel').style.display === 'block') {
                    window.dashboardDuzenleModu(); 
                    window.dashboardDuzenleModu(); 
                }
            }
        }
    } else {
        showToast('ℹ️ Bu widget zaten ekli', true);
    }
};
function tahminiTukenenlerWidgetGuncelle() {
    const container = document.getElementById('dashTahminiTukenenler');
    if (!container) return;

    // Tüm tahminleri al, süreye göre sırala (slice kaldırıldı)
    const tahminliUrunler = Object.values(stoklar)
        .filter(u => stokTahminleri[u.id] && stokTahminleri[u.id].gun !== Infinity && u.kalan > 0)
        .map(u => ({ ...u, tahmin: stokTahminleri[u.id] }))
        .sort((a, b) => a.tahmin.gun - b.tahmin.gun);

    if (tahminliUrunler.length === 0) {
        container.innerHTML = '<div style="color:var(--text-secondary); font-size:13px;">✅ Tükenme riski yok</div>';
        return;
    }

    // Kaydırılabilir liste oluştur
    let html = '<div style="max-height: 180px; overflow-y: auto; padding-right: 4px;">';
    html += tahminliUrunler.map(u => {
        let renk = u.tahmin.durum === 'kritik' ? 'var(--danger)' : (u.tahmin.durum === 'uyari' ? 'var(--warning)' : 'var(--text)');
        return `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:13px; border-bottom:1px solid var(--border);">
            <span>${getUrunAdi(u)}</span>
            <span style="color:${renk}; font-weight:600;">${u.tahmin.gun} gün</span>
        </div>`;
    }).join('');
    html += '</div>';
    
    // Alt bilgi (kaç ürün olduğunu gösterir)
    html += `<div style="font-size:11px; color:var(--text-secondary); margin-top:6px; text-align:right;">
        Toplam ${tahminliUrunler.length} ürün
    </div>`;
    
    container.innerHTML = html;
}
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
    
    // Tüm sekmeleri dön
    ALL_TABS.forEach(tab => {
        // Butonun yatay menüde olup olmadığını kontrol et
        const existingBtn = document.querySelector(`#quickNavContainer .quick-nav-btn[data-tab="${tab.id}"]`);
        const isVisible = existingBtn && existingBtn.style.display !== 'none';
        
        const item = document.createElement('div');
        item.className = 'quick-nav-settings-item';
        item.innerHTML = `
            <input type="checkbox" id="qnav-${tab.id}" ${isVisible ? 'checked' : ''}>
            <label for="qnav-${tab.id}">${tab.icon} ${tab.label}</label>
        `;
        
        item.querySelector('input').addEventListener('change', function() {
            const isChecked = this.checked;
            let btn = document.querySelector(`#quickNavContainer .quick-nav-btn[data-tab="${tab.id}"]`);
            
            if (isChecked) {
                if (!btn) {
                    // Buton yatay menüde yoksa oluştur ve ekle
                    btn = document.createElement('button');
                    btn.className = 'quick-nav-btn';
                    btn.dataset.tab = tab.id;
                    btn.innerHTML = `<span class="nav-icon">${tab.icon}</span><span class="nav-label">${tab.label}</span>`;
                    btn.addEventListener('click', () => switchTab(tab.id));
                    
                    const moreBtn = document.querySelector('#quickNavContainer .more-btn');
                    if (moreBtn) {
                        document.getElementById('quickNavContainer').insertBefore(btn, moreBtn);
                    } else {
                        document.getElementById('quickNavContainer').appendChild(btn);
                    }
                } else {
                    btn.style.display = 'flex';
                }
            } else {
                if (btn) {
                    btn.style.display = 'none';
                }
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
// UBL-TR Birim Kodlarını Türkçe'ye Çevirir
function unitCodeToText(code) {
    const birimler = {
        'C62': 'Adet', 'PA': 'Paket', 'BX': 'Koli', 'KGM': 'Kg', 
        'LTR': 'Litre', 'GRM': 'Gram', 'MTR': 'Metre', 'SET': 'Set', 'DZN': 'Düzine'
    };
    return birimler[code] || code || 'Adet';
}
window.unitCodeToText = unitCodeToText;
// ================================================================
// E-FATURA (XML) İLE OTOMATİK STOK EKLEME VE ÖĞRENME
// ================================================================
async function efaturaIleStokEkle() {
    const fileInput = document.getElementById('efaturaFile');
    const durum = document.getElementById('efaturaDurum');

    if (!fileInput.files || fileInput.files.length === 0) {
        durum.textContent = '❌ Lütfen bir XML dosyası seçin.';
        durum.style.color = 'var(--btn-danger)';
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        try {
            showLoading('Fatura okunuyor...');
            durum.textContent = '⏳ Fatura ayrıştırılıyor...';
            durum.style.color = 'var(--text-secondary)';

            const xmlText = e.target.result;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            const cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
            const cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

            // --- 1. FATURA TEMEL BİLGİLERİNİ OKU ---
            const uuidNode = xmlDoc.getElementsByTagNameNS(cbc, "UUID")[0];
            const invoiceIdNode = xmlDoc.getElementsByTagNameNS(cbc, "ID")[0];
            const issueDateNode = xmlDoc.getElementsByTagNameNS(cbc, "IssueDate")[0];
            const issueTimeNode = xmlDoc.getElementsByTagNameNS(cbc, "IssueTime")[0];
            
            const supplierNode = xmlDoc.getElementsByTagNameNS(cac, "AccountingSupplierParty")[0]
                                    ?.getElementsByTagNameNS(cac, "Party")[0]
                                    ?.getElementsByTagNameNS(cac, "PartyName")[0]
                                    ?.getElementsByTagNameNS(cbc, "Name")[0];
            
            const payableAmountNode = xmlDoc.getElementsByTagNameNS(cac, "LegalMonetaryTotal")[0]
                                    ?.getElementsByTagNameNS(cbc, "PayableAmount")[0];

            const ettn = uuidNode ? uuidNode.textContent.trim() : "";
            const faturaNo = invoiceIdNode ? invoiceIdNode.textContent.trim() : "Bilinmeyen";
            const tedarikciAdi = supplierNode ? supplierNode.textContent.trim() : "Bilinmeyen Tedarikçi";
            const faturaTutari = payableAmountNode ? Number(payableAmountNode.textContent) : 0;

            if (!ettn) throw new Error("Faturada ETTN (UUID) numarası bulunamadı. Mükerrer kontrolü yapılamaz.");

            // --- 2. MÜKERRER (ÇİFT) YÜKLEME KONTROLÜ ---
            durum.textContent = '🔍 Mükerrer fatura kontrolü yapılıyor...';
            const arsivKontrol = await getDoc(doc(db, "fatura_arsivi", ettn));
            if (arsivKontrol.exists()) {
                throw new Error(`Bu fatura (No: ${faturaNo}) daha önce sisteme yüklenmiş! İşlem iptal edildi.`);
            }

            // Tarih İşleme
            const faturaTarihiStr = issueDateNode ? issueDateNode.textContent.trim() : "";
            const faturaSaatiStr = issueTimeNode ? issueTimeNode.textContent.trim() : "00:00:00";
            let faturaDateObj = new Date();
            if (faturaTarihiStr) {
                faturaDateObj = new Date(`${faturaTarihiStr}T${faturaSaatiStr}`);
                if (isNaN(faturaDateObj.getTime())) faturaDateObj = new Date(faturaTarihiStr);
                if (isNaN(faturaDateObj.getTime())) faturaDateObj = new Date();
            }
            aktifEfaturaTarihi = Timestamp.fromDate(faturaDateObj);
            const tarihBilgi = faturaDateObj.toLocaleDateString('tr-TR');

            const lines = xmlDoc.getElementsByTagNameNS(cac, "InvoiceLine");
            if (lines.length === 0) throw new Error("Faturada ürün bulunamadı.");

            // Kayıtlı eşleştirmeleri ve birim dönüşümlerini çek
            const eslestirmelerSnap = await getDocs(collection(db, "fatura_eslestirmeleri"));
            const kayitliEslestirmeler = {};
            eslestirmelerSnap.forEach(d => {
                const data = d.data();
                if (data.faturaUrunKodu) kayitliEslestirmeler[`KOD_${data.faturaUrunKodu.toLowerCase()}`] = { stokId: data.stokId, carpan: data.carpan || 1 };
                if (data.faturaUrunAdi) kayitliEslestirmeler[`AD_${data.faturaUrunAdi.toLowerCase()}`] = { stokId: data.stokId, carpan: data.carpan || 1 };
            });

            const batch = writeBatch(db);
            let eklenenUrunSayisi = 0;
            bekleyenEfaturaUrunleri = [];
            const stokDizisi = Object.values(stoklar);

            // --- 3. ÜRÜNLERİ İŞLE ---
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                const nameNode = line.getElementsByTagNameNS(cac, "Item")[0]?.getElementsByTagNameNS(cbc, "Name")[0];
                const urunAdi = nameNode ? nameNode.textContent.trim() : "";
                
                const sellerIdNode = line.getElementsByTagNameNS(cac, "SellersItemIdentification")[0]?.getElementsByTagNameNS(cbc, "ID")[0];
                const urunKodu = sellerIdNode ? sellerIdNode.textContent.trim() : "";

                const qtyNode = line.getElementsByTagNameNS(cbc, "InvoicedQuantity")[0];
                const miktar = qtyNode ? Number(qtyNode.textContent) : 0;
                const birimKodu = qtyNode ? qtyNode.getAttribute("unitCode") : "C62";
                const faturaBirimi = unitCodeToText(birimKodu);

                if (miktar <= 0) continue;

                let eslesenUrunId = null;
                let carpan = 1;

                if (urunKodu && kayitliEslestirmeler[`KOD_${urunKodu.toLowerCase()}`]) {
                    eslesenUrunId = kayitliEslestirmeler[`KOD_${urunKodu.toLowerCase()}`].stokId;
                    carpan = kayitliEslestirmeler[`KOD_${urunKodu.toLowerCase()}`].carpan;
                } else if (urunAdi && kayitliEslestirmeler[`AD_${urunAdi.toLowerCase()}`]) {
                    eslesenUrunId = kayitliEslestirmeler[`AD_${urunAdi.toLowerCase()}`].stokId;
                    carpan = kayitliEslestirmeler[`AD_${urunAdi.toLowerCase()}`].carpan;
                }

                if (!eslesenUrunId && urunKodu) {
                    const bulunan = stokDizisi.find(u => u.barkod && u.barkod.toLowerCase() === urunKodu.toLowerCase());
                    if (bulunan) eslesenUrunId = bulunan.id;
                }

                if (!eslesenUrunId && urunAdi) {
                    const bulunan = stokDizisi.find(u => getUrunAdi(u).toLowerCase() === urunAdi.toLowerCase());
                    if (bulunan) eslesenUrunId = bulunan.id;
                }

                if (birimDonusumleri[faturaBirimi.toUpperCase()]) {
                    carpan = birimDonusumleri[faturaBirimi.toUpperCase()].carpan;
                }

                if (eslesenUrunId) {
                    const urun = stoklar[eslesenUrunId];
                    const sistemBirimi = urun.birim || 'Adet';
                    
                    if (faturaBirimi.toLowerCase() !== sistemBirimi.toLowerCase() && carpan === 1) {
                        bekleyenEfaturaUrunleri.push({
                            urunAdi: urunAdi, urunKodu: urunKodu, miktar: miktar, 
                            birim: faturaBirimi, eslesenUrunId: eslesenUrunId, sistemBirimi: sistemBirimi
                        });
                        continue;
                    }

                    const yeniStok = (urun.kalan || 0) + (miktar * carpan);
                    batch.update(doc(db, "stoklar", eslesenUrunId), { kalan: yeniStok });
                    
                    const hareketRef = doc(collection(db, "hareketler"));
                    batch.set(hareketRef, {
                        urunId: eslesenUrunId, urun: getUrunAdi(urun), tur: 'giris',
                        miktar: miktar * carpan, birim: urun.birim || 'Adet',
                        tarih: aktifEfaturaTarihi, aciklama: `e-Fatura ile stok girişi (${miktar} ${faturaBirimi})`
                    });
                    eklenenUrunSayisi++;
                } else {
                    bekleyenEfaturaUrunleri.push({
                        urunAdi: urunAdi, urunKodu: urunKodu, miktar: miktar, 
                        birim: faturaBirimi, eslesenUrunId: null, sistemBirimi: null
                    });
                }
            }

            // --- 4. ARŞİVE KAYDET VE BATCH'İ UYGULA ---
            // Eşleşmeyen ürün olsa bile faturayı arşive kaydediyoruz ki bir daha yüklenemesin.
            const arsivRef = doc(db, "fatura_arsivi", ettn);
            batch.set(arsivRef, {
                ettn: ettn,
                faturaNo: faturaNo,
                tedarikci: tedarikciAdi,
                faturaTarihi: aktifEfaturaTarihi,
                tutar: faturaTutari,
                yuklemeTarihi: Timestamp.now(),
                yukleyen: mevcutKullanici?.email || 'Sistem',
                urunSayisi: lines.length
            });

            await batch.commit();
            await logEkle('efatura_stok', `${faturaNo} nolu e-fatura işlendi. (${eklenenUrunSayisi} ürün eklendi)`, { faturaNo: faturaNo });

            hideLoading();
            fileInput.value = '';

            if (bekleyenEfaturaUrunleri.length > 0) {
                durum.innerHTML = `✅ ${eklenenUrunSayisi} ürün eklendi. ⚠️ ${bekleyenEfaturaUrunleri.length} ürün için eşleştirme/birim kontrolü gerekiyor.`;
                durum.style.color = 'var(--btn-warning)';
                efaturaEslestirmeModalGoster();
            } else {
                durum.innerHTML = `✅ Başarılı! Faturadaki ${eklenenUrunSayisi} ürünün tamamı stoğa eklendi. (Tarih: ${tarihBilgi})`;
                durum.style.color = 'var(--btn-success)';
            }

        } catch(err) {
            hideLoading();
            console.error('E-Fatura yükleme hatası:', err);
            durum.textContent = '❌ Hata: ' + err.message;
            durum.style.color = 'var(--btn-danger)';
        }
    };
    reader.readAsText(file, "UTF-8");
}

window.efaturaIleStokEkle = efaturaIleStokEkle;

// Modal'ı açar ve eşleşmeyen ürünleri listeler
function efaturaEslestirmeModalGoster() {
    const tbody = document.getElementById('efaturaEslestirmeListesi');
    tbody.innerHTML = '';
    const stokDizisi = Object.values(stoklar).sort((a,b) => getUrunAdi(a).localeCompare(getUrunAdi(b)));

    bekleyenEfaturaUrunleri.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        
        let optionsHtml = '<option value="">-- Seçiniz --</option>';
        stokDizisi.forEach(u => {
            const selected = (item.eslesenUrunId === u.id) ? 'selected' : '';
            optionsHtml += `<option value="${u.id}" ${selected}>${getUrunAdi(u)} (${u.birim || 'Adet'})</option>`;
        });

        tr.innerHTML = `
            <td style="padding:8px;">
                <strong>${item.urunAdi}</strong><br>
                <small style="color:var(--text-secondary);">Kod: ${item.urunKodu || '-'}</small>
            </td>
            <td style="padding:8px; text-align:center; font-weight:bold; color:var(--btn-success);">
                ${item.miktar} <br><small>${item.birim}</small>
            </td>
            <td style="padding:8px;">
                <select id="efatura-select-${index}" onchange="efaturaBirimGuncelle(${index})" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border); background:var(--bg-input); color:var(--text); font-size:13px;">
                    ${optionsHtml}
                </select>
                <div id="efatura-sistem-birim-${index}" style="font-size:11px; color:var(--text-secondary); margin-top:4px;"></div>
            </td>
            <td style="padding:8px;">
                <input type="number" id="efatura-carpan-${index}" value="1" min="0.01" step="0.01" style="width:70px; padding:6px; border-radius:6px; border:1px solid var(--border); background:var(--bg-input); color:var(--text);">
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('efaturaEslestirmeModal').style.display = 'flex';
    bekleyenEfaturaUrunleri.forEach((_, index) => efaturaBirimGuncelle(index));
}

function efaturaBirimGuncelle(index) {
    const select = document.getElementById(`efatura-select-${index}`);
    const birimDiv = document.getElementById(`efatura-sistem-birim-${index}`);
    const carpanInput = document.getElementById(`efatura-carpan-${index}`);
    
    if (select.value && stoklar[select.value]) {
        const urun = stoklar[select.value];
        const faturaBirimi = bekleyenEfaturaUrunleri[index].birim;
        const sistemBirimi = urun.birim || 'Adet';
        
        if (faturaBirimi.toLowerCase() !== sistemBirimi.toLowerCase()) {
            birimDiv.innerHTML = `Sistem Birimi: <strong>${sistemBirimi}</strong> (Lütfen çarpanı girin)`;
            birimDiv.style.color = 'var(--btn-warning)';
            carpanInput.disabled = false;
        } else {
            birimDiv.innerHTML = `Sistem Birimi: <strong>${sistemBirimi}</strong> (Birimler aynı)`;
            birimDiv.style.color = 'var(--text-secondary)';
            carpanInput.disabled = true;
            carpanInput.value = 1;
        }
    } else {
        birimDiv.innerHTML = '';
        carpanInput.disabled = false;
    }
}

async function efaturaEslestirmeyiKaydetVeEkle() {
    showLoading('Eşleştirmeler kaydediliyor ve stoklar güncelleniyor...');
    const batch = writeBatch(db);
    let eklenen = 0;
    let hata = false;

    for (let i = 0; i < bekleyenEfaturaUrunleri.length; i++) {
        const select = document.getElementById(`efatura-select-${i}`);
        const carpanInput = document.getElementById(`efatura-carpan-${i}`);
        const secilenStokId = select.value;
        const item = bekleyenEfaturaUrunleri[i];

        if (secilenStokId) {
            const urun = stoklar[secilenStokId];
            if (!urun) continue;
            
           let carpan = Number(carpanInput.value);
           if (isNaN(carpan) || carpan <= 0) carpan = 1; // Negatif veya sıfır girilirse 1 kabul et
            const eklenecekMiktar = item.miktar * carpan;

            // Eşleştirmeyi kaydet (öğrenme)
            const eslestirmeRef = doc(collection(db, "fatura_eslestirmeleri"));
            batch.set(eslestirmeRef, {
                faturaUrunAdi: item.urunAdi,
                faturaUrunKodu: item.urunKodu,
                stokId: secilenStokId,
                carpan: carpan,
                kayitTarihi: Timestamp.now()
            });

            // Stoğu güncelle
            const yeniStok = (urun.kalan || 0) + eklenecekMiktar;
            batch.update(doc(db, "stoklar", secilenStokId), { kalan: yeniStok });

            // Hareket ekle
            const hareketRef = doc(collection(db, "hareketler"));
            batch.set(hareketRef, {
                urunId: secilenStokId, urun: getUrunAdi(urun), tur: 'giris',
                miktar: eklenecekMiktar, birim: urun.birim || 'Adet', tarih: aktifEfaturaTarihi,
                aciklama: `e-Fatura eşleştirme (Fatura: ${item.miktar} ${item.birim} x ${carpan} = ${eklenecekMiktar} ${urun.birim || 'Adet'})`
            });
            eklenen++;
        } else {
            hata = true;
        }
    }

    if (hata) {
        hideLoading();
        showToast('⚠️ Lütfen eşleştirme yapılmadan geçmek istediğiniz ürünleri işaretleyin veya seçim yapın.', true);
        return;
    }

    try {
        await batch.commit();
        hideLoading();
        showToast(`✅ ${eklenen} ürün için eşleştirme kaydedildi, birim dönüşümleri uygulandı ve stoğa eklendi.`);
        await logEkle('efatura_eslestirme', `${eklenen} ürün için fatura eşleştirmesi ve birim dönüşümü yapıldı.`);
        
        efaturaEslestirmeKapat();
        document.getElementById('efaturaDurum').innerHTML = `✅ Başarılı! ${eklenen} ürün stoğa eklendi.`;
        document.getElementById('efaturaDurum').style.color = 'var(--btn-success)';
    } catch(err) {
        hideLoading();
        console.error('Eşleştirme kaydetme hatası:', err);
        showToast('❌ Eşleştirmeler kaydedilirken hata oluştu.', true);
    }
}

window.efaturaBirimGuncelle = efaturaBirimGuncelle;
window.efaturaEslestirmeyiKaydetVeEkle = efaturaEslestirmeyiKaydetVeEkle;

// Sekmeleri yetkiye göre kur (giriş sonrası çağrılır)
function buildQuickNav() {
    const container = document.getElementById('quickNavContainer');
    const mobileMenu = document.getElementById('mobileMenu');
    if (!container) return;

    let settings = {};
    try {
        const kayitli = localStorage.getItem('quickNavSettings');
        if (kayitli) settings = JSON.parse(kayitli);
    } catch(e) {}

    if (Object.keys(settings).length === 0) {
        settings = {
            'genel-bakis': true,
            'hizli-islem': true,
            'stok-listesi': true,
            'hareketler': true,
            'rapor': true
        };
    }

    container.innerHTML = '';

    ALL_TABS.forEach(tab => {
        if (tab.adminOnly && !adminMi()) return;   // 🔒 yetki filtresi
        if (!settings[tab.id]) return;             // 👁️ kullanıcı tercihi

        const btn = document.createElement('button');
        btn.className = 'quick-nav-btn';
        btn.dataset.tab = tab.id;
        btn.innerHTML = `<span class="nav-icon">${tab.icon}</span><span class="nav-label">${tab.label}</span>`;
        btn.addEventListener('click', () => switchTab(tab.id));
        container.appendChild(btn);
    });

    const moreBtn = document.createElement('button');
    moreBtn.className = 'quick-nav-btn more-btn';
    moreBtn.innerHTML = `<span class="nav-icon">⋮</span><span class="nav-label">Daha</span>`;
    moreBtn.onclick = () => toggleMoreMenu();
    container.appendChild(moreBtn);

    if (mobileMenu) {
        mobileMenu.innerHTML = '';
        ALL_TABS.forEach(tab => {
            if (tab.adminOnly && !adminMi()) return; // 🔒
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

    const defaultTab = window.location.hash?.replace('#', '') || 'genel-bakis';
    setTimeout(() => switchTab(defaultTab), 100);
}

// YENİ: Daha Fazla menüsünü aç/kapa
function toggleMoreMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu) menu.classList.toggle('open');
}
// ================================================================
// BİRİM DÖNÜŞÜM YÖNETİMİ
// ================================================================
let birimDonusumleri = {}; // { 'PA': { sistemBirimi: 'Adet', carpan: 12 } }

async function birimDonusumleriniYukle() {
    try {
        const snap = await getDocs(collection(db, "birim_donusumleri"));
        birimDonusumleri = {};
        snap.forEach(d => {
            const data = d.data();
            birimDonusumleri[data.faturaBirimi.toUpperCase()] = {
                id: d.id,
                sistemBirimi: data.sistemBirimi,
                carpan: data.carpan
            };
        });
    } catch(e) { console.warn('Birim dönüşümleri yüklenemedi:', e); }
}

function birimDonusumModalGoster() {
    document.getElementById('birimDonusumModal').style.display = 'flex';
    birimDonusumListesiniGuncelle();
}

function birimDonusumModalKapat() {
    document.getElementById('birimDonusumModal').style.display = 'none';
}

async function birimDonusumListesiniGuncelle() {
    await birimDonusumleriniYukle();
    const list = document.getElementById('birimDonusumListesi');
    const keys = Object.keys(birimDonusumleri);
    
    if (keys.length === 0) {
        list.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-secondary);">Henüz birim dönüşümü tanımlanmamış.</div>';
        return;
    }
    
    list.innerHTML = keys.map(key => {
        const d = birimDonusumleri[key];
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:1px solid var(--border);">
            <span><strong>${key}</strong> (Fatura) → <strong>${d.sistemBirimi}</strong> <span style="color:var(--btn-warning);">×${d.carpan}</span></span>
            <button onclick="birimDonusumuSil('${d.id}')" style="background:var(--btn-danger); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; font-size:12px;">✖</button>
        </div>`;
    }).join('');
}

async function birimDonusumuEkle() {
    const faturaBirimi = document.getElementById('faturaBirimKodu').value.trim().toUpperCase();
    const sistemBirimi = document.getElementById('sistemBirimAdi').value.trim();
    const carpan = Number(document.getElementById('birimCarpan').value) || 1;
    
    if (!faturaBirimi || !sistemBirimi) return showToast('Lütfen tüm alanları doldurun!', true);
    if (carpan <= 0) return showToast('Çarpan 0 veya negatif olamaz!', true);
    
    try {
        await addDoc(collection(db, "birim_donusumleri"), {
            faturaBirimi: faturaBirimi,
            sistemBirimi: sistemBirimi,
            carpan: carpan
        });
        showToast(`✅ ${faturaBirimi} → ${sistemBirimi} (×${carpan}) eklendi.`);
        document.getElementById('faturaBirimKodu').value = '';
        document.getElementById('sistemBirimAdi').value = '';
        document.getElementById('birimCarpan').value = '1';
        birimDonusumListesiniGuncelle();
    } catch(e) { showToast(getFriendlyErrorMessage(e), true); }
}

async function birimDonusumuSil(id) {
    if (!confirm('Bu birim dönüşümünü silmek istediğinize emin misiniz?')) return;
    try {
        await deleteDoc(doc(db, "birim_donusumleri", id));
        showToast('✅ Silindi');
        birimDonusumListesiniGuncelle();
    } catch(e) { showToast(getFriendlyErrorMessage(e), true); }
}

window.birimDonusumModalGoster = birimDonusumModalGoster;
window.birimDonusumModalKapat = birimDonusumModalKapat;
window.birimDonusumuEkle = birimDonusumuEkle;
window.birimDonusumuSil = birimDonusumuSil;

// ================================================================
// FATURA ARŞİVİ LİSTELEME
// ================================================================
async function faturaArsiviniListele() {
    const tbody = document.getElementById('faturaArsiviTablo');
    if (!tbody) return;
    
    try {
        showLoading('Fatura arşivi yükleniyor...');
        const snap = await getDocs(query(collection(db, "fatura_arsivi"), orderBy("yuklemeTarihi", "desc")));
        
        if (snap.empty) {
            tbody.innerHTML = `
                <tr><td colspan="6">
                    <div class="empty-state">
                        <div class="empty-icon">🧾</div>
                        <h4>Henüz yüklenmiş fatura yok</h4>
                        <p>E-fatura yüklediğinizde burada listelenecektir.</p>
                    </div>
                </td></tr>
            `;
            hideLoading();
            return;
        }

        let html = '';
        snap.forEach(d => {
            const f = d.data();
            const faturaTarihi = f.faturaTarihi?.toDate().toLocaleDateString('tr-TR') || '-';
            const yuklemeTarihi = f.yuklemeTarihi?.toDate().toLocaleString('tr-TR') || '-';
            const tutarStr = Number(f.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            
            html += `
                <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:10px;"><strong>${f.faturaNo || '-'}</strong><br><small style="color:#888;">ETTN: ${f.ettn.substring(0,8)}...</small></td>
                    <td style="padding:10px;">${f.tedarikci || '-'}</td>
                    <td style="padding:10px; text-align:center;">${faturaTarihi}</td>
                    <td style="padding:10px; text-align:right; font-weight:600; color:var(--text);">${tutarStr} ₺</td>
                    <td style="padding:10px; text-align:center;">${f.urunSayisi || 0} kalem</td>
                    <td style="padding:10px; text-align:center;">
                        <button onclick="window.faturaArsivDetay('${f.ettn}')" style="background:var(--btn-primary); color:white; border:none; border-radius:20px; padding:4px 10px; cursor:pointer; font-size:12px;">Detay</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        hideLoading();
    } catch(e) {
        console.error('Arşiv listeleme hatası:', e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger); padding:20px;">❌ Arşiv yüklenirken hata oluştu</td></tr>';
        hideLoading();
    }
}

// Sekmeye tıklandığında arşivi yükle
window.faturaArsivDetay = function(ettn) {
    // İleride buraya detay modalı eklenebilir.
    showToast("Fatura ETTN: " + ettn);
};

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

// ========== YEREL BİLDİRİM GÖNDERME FONKSİYONU ==========
function sendNotification(title, body, url = '/') {
    // Eğer tarayıcı bildirimleri desteklemiyorsa toast göster
    if (!('Notification' in window)) {
        showToast(`${title}: ${body}`);
        return;
    }

    if (Notification.permission === 'granted') {
        // Service worker üzerinden bildirim göster (Arka planda ve mobilde daha stabil çalışır)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    body: body,
                    icon: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
                    badge: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
                    vibrate: [200, 100, 200],
                    data: { url: url }
                });
            }).catch(err => {
                console.warn('SW bildirim hatası, varsayılan deneniyor:', err);
                new Notification(title, { body: body, icon: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png' });
            });
        } else {
            // Service worker yoksa direkt göster
            new Notification(title, {
                body: body,
                icon: 'https://cdn-icons-png.flaticon.com/512/2897/2897785.png'
            });
        }
    } else {
        // İzin verilmemişse sadece uygulama içi toast göster
        showToast(`${title}: ${body}`);
    }
}
// ========== ÇEVRİMDIŞI (OFFLINE) UYARISI ==========
function updateOnlineStatus() {
    const banner = document.getElementById('offlineBanner');
    if (!banner) return;
    
    if (navigator.onLine) {
        banner.style.display = 'none'; // İnternet varsa gizle
    } else {
        banner.style.display = 'block'; // İnternet yoksa göster
    }
}

// İnternet durumunu dinle
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
// Sayfa ilk açıldığında kontrol et
updateOnlineStatus();

// Global'e ekle
window.sendNotification = sendNotification;
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