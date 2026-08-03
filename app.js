// --- FIREBASE MODÜLLERİ ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, query, where, Timestamp,
    onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc, orderBy, limit, addDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signOut, onAuthStateChanged, sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// --- DEĞİŞKENLER ---
let stoklar = {};
let sepet = [];
let html5QrCode = null;
let seciliUrunId = "";
let mevcutKullanici = null;
let mevcutRol = null;
let mevcutDurum = null;

// --- YARDIMCI ---
function getUrunAdi(urun) {
    if (!urun) return "Bilinmeyen";
    return urun.urunAd || urun.ad || urun.isim || urun.name || urun.id || "Bilinmeyen";
}

function adminMi() { return mevcutRol === 'admin'; }
function yoneticiMi() { return mevcutRol === 'admin' || mevcutRol === 'yonetici'; }

// ========== TOAST BİLDİRİM ==========
function showToast(msg, err = false) {
    const t = document.getElementById('toastMessage');
    if (!t) return;
    t.textContent = msg;
    t.style.background = err ? '#e74c3c' : '#2c3e50';
    t.classList.add('show');
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove('show'), 3000);
}

// ========== GİRİŞ / KAYIT ==========
window.kullaniciGiris = async () => {
    const email = document.getElementById('loginEmail')?.value;
    const sifre = document.getElementById('loginPassword')?.value;
    if (!email || !sifre) return showToast("E-posta ve şifre girin!", true);
    try {
        await signInWithEmailAndPassword(auth, email, sifre);
    } catch (e) {
        showToast("Giriş hatası: " + e.message, true);
    }
};

window.kullaniciKayit = async () => {
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
        showToast("Kayıt hatası: " + e.message, true);
    }
};

window.kullaniciCikis = async () => {
    await signOut(auth);
    window.location.reload();
};

window.switchLoginTab = (tab) => {
    const tabs = document.querySelectorAll('.login-tab');
    const forms = document.querySelectorAll('.login-form');
    tabs.forEach(btn => btn.classList.remove('active'));
    forms.forEach(form => form.classList.remove('active'));
    if (tab === 'giris') {
        const girisTab = document.querySelector('.login-tab:first-child');
        if (girisTab) girisTab.classList.add('active');
        const girisForm = document.getElementById('girisForm');
        if (girisForm) girisForm.classList.add('active');
    } else {
        const kayitTab = document.querySelector('.login-tab:last-child');
        if (kayitTab) kayitTab.classList.add('active');
        const kayitForm = document.getElementById('kayitForm');
        if (kayitForm) kayitForm.classList.add('active');
    }
};

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
        // Yetkiye göre tabları göster/gizle
        const yeniUrunTab = document.querySelector('.tab-btn[data-tab="yeni-urun"]');
        const kullaniciTab = document.querySelector('.tab-btn[data-tab="kullanicilar"]');
        if (yeniUrunTab) yeniUrunTab.style.display = yoneticiMi() ? 'block' : 'none';
        if (kullaniciTab) kullaniciTab.style.display = adminMi() ? 'block' : 'none';
        if (adminMi()) kullaniciListesiniGetir();
        verileriGetir();
        siparisleriListele();
    } else {
        mevcutKullanici = null;
        mevcutRol = null;
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
});

// ========== VERİLER ==========
function verileriGetir() {
    onSnapshot(collection(db, "stoklar"), (snap) => {
        stoklar = {};
        const select = document.getElementById("urunSelect");
        if (select) select.innerHTML = '<option value="">Ürün Seçin</option>';
        snap.forEach(d => {
            const v = d.data();
            stoklar[d.id] = { id: d.id, ...v, kalan: v.kalan || 0, kritik: v.kritik || 5 };
            if (select) {
                const opt = document.createElement("option");
                opt.value = d.id;
                opt.textContent = `${getUrunAdi(v)}${v.barkod ? ' ('+v.barkod+')' : ''}`;
                select.appendChild(opt);
            }
        });
        stoklariListele();
        hareketleriListele();
        kritikKontrol();
        bugunOzetiniGetir();
        popularesiGetir();
    });
}

// ========== STOK LİSTESİ (GRUPLU) ==========
function stoklariListele() {
    const tbody = document.getElementById('tablo');
    if (!tbody) return;
    let html = "", toplam = 0, kritikSay = 0;
    let gruplar = {};
    Object.values(stoklar).forEach(u => {
        const g = u.grup || "Genel";
        if (!gruplar[g]) gruplar[g] = [];
        gruplar[g].push(u);
    });
    Object.keys(gruplar).sort().forEach((grup, idx) => {
        const grupId = `grup-${idx}`;
        html += `<tr onclick="grupToggle('${grupId}')" style="background:#f1c40f; cursor:pointer;">
                    <td colspan="3"><b>📂 ${grup}</b></td>
                 </tr>`;
        gruplar[grup].forEach(u => {
            const m = u.kalan || 0, k = u.kritik || 5;
            toplam += m;
            if (m <= k) kritikSay++;
            html += `<tr class="${grupId}" onclick="detayGoster('${u.id}')" style="display:none; cursor:pointer;">
                        <td style="padding-left:20px;">${getUrunAdi(u)}<br><small style="color:#888">${u.barkod || '-'}</small></td>
                        <td style="color:${m <= k ? '#ff6b6b' : ''}"><b>${m}</b> ${u.birim || 'Adet'}</td>
                        <td>${yoneticiMi() ? `<button onclick="event.stopPropagation(); urunSil('${u.id}')" style="background:#ff3b30; color:white; border:none; border-radius:20px; padding:6px 12px;">✖</button>` : ''}</td>
                    </tr>`;
        });
    });
    tbody.innerHTML = html;
    document.getElementById('dashToplam').innerText = toplam;
    document.getElementById('dashKritik').innerText = kritikSay;
}

// ========== KRİTİK KONTROL ==========
function kritikKontrol() {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    const panel = document.getElementById('kritikPanel');
    const liste = document.getElementById('kritikListe');
    if (kritikler.length > 0) {
        if (panel) panel.style.display = 'block';
        if (liste) liste.innerHTML = kritikler.map(u => `<li><strong>${getUrunAdi(u)}</strong>: Stok ${u.kalan} ${u.birim || 'Adet'} / Kritik ${u.kritik}</li>`).join('');
    } else {
        if (panel) panel.style.display = 'none';
    }
}

// ========== HAREKETLER ==========
async function hareketleriListele() {
    const tbody = document.getElementById('hareketlerTablo');
    if (!tbody) return;
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), orderBy("tarih", "desc"), limit(100)));
        tbody.innerHTML = "";
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#666;">Henüz hareket yok</td></tr>';
            return;
        }
        snap.forEach(d => {
            const h = d.data();
            tbody.innerHTML += `<tr>
                <td style="font-size:12px;">${h.tarih?.toDate().toLocaleString('tr-TR') || '-'}</td>
                <td>${h.urun || '-'}</td>
                <td><b>${h.miktar}</b> ${h.birim || ''}</td>
                <td style="color:${h.tur === 'giris' ? '#00c853' : '#ff3b30'}"><b>${h.tur === 'giris' ? 'GİRİŞ' : 'ÇIKIŞ'}</b></td>
            </tr>`;
        });
    } catch(e) { console.error(e); }
}

// ========== ÖZET ==========
async function bugunOzetiniGetir() {
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("tarih", ">=", Timestamp.fromDate(bugun))));
        let toplam = 0;
        snap.forEach(d => { if(d.data().tur === 'giris') toplam += d.data().miktar; });
        document.getElementById('dashGiris').innerText = toplam;
    } catch(e) { console.error(e); }
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
        document.getElementById('dashPopuler').innerText = populerAd !== "-" ? `${populerAd} (${max})` : "-";
    } catch(e) { document.getElementById('dashPopuler').innerText = "-"; }
}

// ========== ÜRÜN İŞLEMLERİ ==========
window.urunEkle = async () => {
    if (!yoneticiMi()) return showToast("Yetkiniz yok!", true);
    const ad = document.getElementById('urunAdi')?.value.trim();
    if (!ad) return showToast("Ürün adı girin!", true);
    const barkod = document.getElementById('urunBarkod')?.value.trim() || "";
    try {
        await setDoc(doc(collection(db, "stoklar")), {
            urunAd: ad,
            barkod: barkod,
            kalan: 0,
            kritik: 5,
            grup: "Genel",
            birim: "Adet",
            olusturmaTarihi: Timestamp.now()
        });
        showToast("Ürün eklendi");
        document.getElementById('urunAdi').value = "";
        document.getElementById('urunBarkod').value = "";
    } catch(e) { showToast("Hata: "+e.message, true); }
};

window.stokIslem = async (tip) => {
    const id = document.getElementById('urunSelect')?.value;
    const miktar = Number(document.getElementById('islemMiktar')?.value);
    if (!id) return showToast("Ürün seçin!", true);
    if (!miktar || miktar <= 0) return showToast("Geçerli miktar girin!", true);
    const mevcut = stoklar[id]?.kalan || 0;
    const yeni = tip === 'giris' ? mevcut + miktar : mevcut - miktar;
    if (tip === 'cikis' && yeni < 0) return showToast("Yetersiz stok!", true);
    const batch = writeBatch(db);
    batch.update(doc(db, "stoklar", id), { kalan: yeni });
    batch.set(doc(collection(db, "hareketler")), {
        urunId: id,
        urun: getUrunAdi(stoklar[id]),
        tur: tip,
        miktar: miktar,
        birim: stoklar[id]?.birim || "Adet",
        tarih: Timestamp.now()
    });
    await batch.commit();
    showToast("İşlem tamam");
    document.getElementById('islemMiktar').value = "";
};

window.urunGuncelle = async () => {
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
        showToast("Güncellendi");
        kapatModal();
    } catch(e) { showToast("Hata: "+e.message, true); }
};

window.urunSil = async (id) => {
    if (!yoneticiMi()) return showToast("Yetkiniz yok!", true);
    if (confirm("Ürün silinsin mi?")) {
        await deleteDoc(doc(db, "stoklar", id));
        showToast("Silindi");
    }
};

window.detayGoster = async (id) => {
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
        document.getElementById('detayIcerik').innerHTML = snap.empty ? "Hareket yok" : snap.docs.map(d => `<div style="padding:8px; border-bottom:1px solid #2a2a2a;">${d.data().tarih?.toDate().toLocaleString()} - ${d.data().tur === 'giris' ? '➕' : '➖'} ${d.data().miktar}</div>`).join('');
    } catch(e) { console.error(e); }
};

window.kapatModal = () => document.getElementById('detayModal').style.display = 'none';

// ========== SEPET ==========
window.sepeteEkle = () => {
    const id = document.getElementById('urunSelect')?.value;
    const m = Number(document.getElementById('islemMiktar')?.value);
    if (!id) return showToast("Ürün seçin!", true);
    if (!m || m <= 0) return showToast("Geçerli miktar!", true);
    sepet.push({ id, ad: getUrunAdi(stoklar[id]), miktar: m });
    sepetiGoster();
    document.getElementById('islemMiktar').value = "";
    showToast("Sepete eklendi");
};

function sepetiGoster() {
    const liste = document.getElementById('sepetListesi');
    const butonlar = document.getElementById('sepetButonlar');
    if (!liste) return;
    if (sepet.length === 0) {
        liste.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">📭 Sepet boş</div>';
        if (butonlar) butonlar.style.display = 'none';
    } else {
        liste.innerHTML = sepet.map((u, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #2a2a2a;">
                <span><b>${u.ad}</b> x${u.miktar}</span>
                <button onclick="sepetSil(${i})" style="background:#ff3b30; color:white; border:none; border-radius:20px; padding:6px 14px;">Sil</button>
            </div>
        `).join('');
        if (butonlar) butonlar.style.display = 'flex';
    }
}

window.sepetSil = (i) => { sepet.splice(i, 1); sepetiGoster(); showToast("Çıkarıldı"); };

window.topluIslem = async (tip) => {
    if (sepet.length === 0) return showToast("Sepet boş!", true);
    const batch = writeBatch(db);
    for (let item of sepet) {
        const mevcut = stoklar[item.id]?.kalan || 0;
        const yeni = tip === 'giris' ? mevcut + item.miktar : mevcut - item.miktar;
        if (tip === 'cikis' && mevcut < item.miktar) return showToast(`${item.ad} için stok yetersiz!`, true);
        batch.update(doc(db, "stoklar", item.id), { kalan: yeni });
        batch.set(doc(collection(db, "hareketler")), {
            urunId: item.id,
            urun: item.ad,
            tur: tip,
            miktar: item.miktar,
            tarih: Timestamp.now(),
            birim: stoklar[item.id]?.birim || "Adet"
        });
    }
    await batch.commit();
    showToast("Toplu işlem tamam");
    sepet = [];
    sepetiGoster();
};

// ========== KAMERA ==========
let kameraAktif = false;
window.kameraBaslat = () => {
    const reader = document.getElementById("reader");
    const ac = document.getElementById("kameraAcBtn");
    const kapat = document.getElementById("kameraKapatBtn");
    if (kameraAktif) return;
    if (!reader) return showToast("Kamera alanı yok!", true);
    reader.style.display = "block";
    if (ac) ac.style.display = "none";
    if (kapat) kapat.style.display = "block";
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
    ).then(() => kameraAktif = true).catch(e => { showToast("Kamera hatası", true); reader.style.display = "none"; if(ac) ac.style.display = "block"; if(kapat) kapat.style.display = "none"; });
};

window.kameraDurdur = () => {
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    const r = document.getElementById("reader");
    const ac = document.getElementById("kameraAcBtn");
    const kp = document.getElementById("kameraKapatBtn");
    if (r) r.style.display = "none";
    if (ac) ac.style.display = "block";
    if (kp) kp.style.display = "none";
    kameraAktif = false;
};

window.yeniUrunKamera = () => {
    const reader = document.getElementById("reader");
    const ac = document.getElementById("kameraAcBtn");
    const kapat = document.getElementById("kameraKapatBtn");
    if (!reader) return;
    reader.style.display = "block";
    if (ac) ac.style.display = "none";
    if (kapat) kapat.style.display = "block";
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => { document.getElementById('urunBarkod').value = text; showToast("Barkod okundu"); window.kameraDurdur(); },
        (err) => {}
    ).catch(e => { showToast("Kamera hatası", true); reader.style.display = "none"; if(ac) ac.style.display = "block"; if(kapat) kapat.style.display = "none"; });
};

document.getElementById("kameraAcBtn")?.addEventListener("click", window.kameraBaslat);
document.getElementById("kameraKapatBtn")?.addEventListener("click", window.kameraDurdur);
document.getElementById("yeniUrunKameraBtn")?.addEventListener("click", window.yeniUrunKamera);

// ========== RAPORLAMA ==========
window.raporOlustur = async () => {
    const b = document.getElementById('raporBaslangic')?.value;
    const e = document.getElementById('raporBitis')?.value;
    if (!b || !e) return showToast("Tarih seçin!", true);
    const start = new Date(b); start.setHours(0,0,0,0);
    const end = new Date(e); end.setHours(23,59,59,999);
    const filtre = document.getElementById('raporFiltre')?.value || 'hepsi';
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("tarih", ">=", Timestamp.fromDate(start)), where("tarih", "<=", Timestamp.fromDate(end))));
        const data = {};
        snap.forEach(d => {
            const item = d.data();
            if (filtre !== "hepsi" && item.tur !== filtre) return;
            if (!data[item.urun]) data[item.urun] = { giris: 0, cikis: 0 };
            if (item.tur === 'giris') data[item.urun].giris += item.miktar;
            else data[item.urun].cikis += item.miktar;
        });
        const tbody = document.getElementById('raporTabloGovde');
        tbody.innerHTML = "";
        if (Object.keys(data).length === 0) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#666;">Veri yok</td></tr>';
        else Object.entries(data).sort().forEach(([urun, val]) => tbody.innerHTML += `<tr><td>${urun}</td><td style="text-align:center">${val.giris}</td><td style="text-align:center">${val.cikis}</td></tr>`);
        document.getElementById('raporSonuc').style.display = 'block';
        showToast("Rapor hazır");
    } catch(e) { showToast(e.message, true); }
};

window.excelIndir = () => {
    const ws = XLSX.utils.table_to_sheet(document.getElementById('raporTablo'));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `rapor_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast("Excel indiriliyor");
};

window.pdfIndir = () => {
    const tablo = document.getElementById('raporTablo').cloneNode(true);
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Rapor</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#333;color:white}</style></head><body><h1>Stok Raporu</h1><p>${new Date().toLocaleString('tr-TR')}</p>${tablo.outerHTML}</body></html>`);
    w.document.close();
    w.print();
};

window.siparisPDF = () => {
    const k = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (!k.length) return showToast("Kritik ürün yok!", true);
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Sipariş</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#ff3b30;color:white}</style></head><body><h1>Sipariş Listesi</h1><p>${new Date().toLocaleString('tr-TR')}</p><table><thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead><tbody>${k.map(u => `<tr><td>${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0,(u.kritik*2)-u.kalan)}</td></tr>`).join('')}</tbody></table></body></html>`);
    w.document.close(); w.print();
};

window.siparisYazdir = () => {
    const k = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (!k.length) return showToast("Kritik ürün yok!", true);
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Sipariş</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#ff3b30;color:white}</style></head><body><h1>Sipariş Listesi</h1><p>${new Date().toLocaleString('tr-TR')}</p><table><thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead><tbody>${k.map(u => `<tr><td>${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0,(u.kritik*2)-u.kalan)}</td></tr>`).join('')}</tbody></table><script>window.print();</script></body></html>`);
    w.document.close();
};

// ========== FİLTRE, GRUP TOGGLE, TABLAR ==========
window.tabloFiltrele = () => {
    const f = document.getElementById('aramaKutusu')?.value.toLowerCase() || "";
    document.querySelectorAll('#tablo tr').forEach(r => {
        if (r.classList.length === 0 || r.classList[0]?.startsWith('grup-')) r.style.display = '';
        else r.style.display = r.innerText.toLowerCase().includes(f) ? '' : 'none';
    });
};

window.grupToggle = (id) => {
    document.querySelectorAll(`.${id}`).forEach(r => { r.style.display = r.style.display === 'none' ? 'table-row' : 'none'; });
};

// Sekmeler
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const tab = document.getElementById(this.dataset.tab);
        if (tab) tab.classList.add('active');
        this.classList.add('active');
    });
});

// ========== KULLANICI YÖNETİMİ ==========
window.adminKullaniciOnayla = async (userId, yeniDurum, yeniRol = null) => {
    if (!adminMi()) return showToast("Admin yetkisi gerekli!", true);
    const guncelleme = { durum: yeniDurum };
    if (yeniRol) guncelleme.rol = yeniRol;
    await updateDoc(doc(db, "kullanicilar", userId), guncelleme);
    showToast("Kullanıcı durumu güncellendi");
    kullaniciListesiniGetir();
};

window.adminKullaniciEkle = async () => {
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
        console.log("✅ Firebase Auth kullanıcı oluşturuldu:", user.uid);
        await sendEmailVerification(user);
        console.log("✅ Email doğrulama maili gönderildi.");
        const userData = {
            email: email,
            rol: rol,
            durum: "aktif",
            kayitTarihi: Timestamp.now(),
            createdBy: mevcutKullanici?.email || 'Admin'
        };
        await setDoc(doc(db, "kullanicilar", user.uid), userData);
        console.log("✅ Firestore'a kullanıcı kaydedildi:", userData);
        showToast(`✅ ${email} başarıyla eklendi! Doğrulama maili gönderildi.`);
        await kullaniciListesiniGetir();
        emailInput.value = "";
        sifreInput.value = "";
        rolSelect.value = "personel";
    } catch (e) {
        console.error("❌ Admin kullanıcı ekleme hatası:", e);
        let hataMesaji = e.message;
        if (e.code === 'auth/email-already-in-use') {
            hataMesaji = 'Bu e-posta zaten kullanılıyor.';
        } else if (e.code === 'auth/invalid-email') {
            hataMesaji = 'Geçersiz e-posta adresi.';
        } else if (e.code === 'auth/weak-password') {
            hataMesaji = 'Şifre çok zayıf (en az 6 karakter).';
        } else if (e.code === 'auth/network-request-failed') {
            hataMesaji = 'İnternet bağlantısı yok.';
        }
        showToast("❌ " + hataMesaji, true);
    }
};

async function kullaniciListesiniGetir() {
    if (!adminMi()) return;
    const listeDiv = document.getElementById('kullaniciListesi');
    if (!listeDiv) return;
    try {
        const snap = await getDocs(collection(db, "kullanicilar"));
        if (snap.empty) {
            listeDiv.innerHTML = '<p style="color:#666; padding:20px; text-align:center;">Henüz kayıtlı kullanıcı yok.</p>';
            return;
        }
        let html = `
            <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:13px;">
                <thead>
                    <tr style="border-bottom:2px solid #2a2a2a;">
                        <th style="text-align:left; padding:8px;">E-posta</th>
                        <th style="text-align:left; padding:8px;">Rol</th>
                        <th style="text-align:left; padding:8px;">Durum</th>
                        <th style="text-align:left; padding:8px;">İşlem</th>
                    </tr>
                </thead>
                <tbody>
        `;
        snap.forEach(d => {
            const data = d.data();
            const durumRenk = data.durum === 'aktif' ? '#27ae60' : (data.durum === 'beklemede' ? '#f39c12' : '#e74c3c');
            const durumText = data.durum === 'beklemede' ? '⏳ Beklemede' : (data.durum === 'aktif' ? '✅ Aktif' : '🚫 Engelli');
            html += `
                <tr style="border-bottom:1px solid #1a1a1a;">
                    <td style="padding:8px;">${data.email}</td>
                    <td style="padding:8px;">
                        <span style="background:#3498db; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">${data.rol}</span>
                    </td>
                    <td style="padding:8px; color:${durumRenk}; font-weight:bold;">${durumText}</td>
                    <td style="padding:8px;">
                        ${data.durum === 'beklemede' ? `
                            <button onclick="adminKullaniciOnayla('${d.id}', 'aktif', 'personel')" style="background:#27ae60; color:white; border:none; border-radius:5px; padding:5px 10px; margin-right:5px; cursor:pointer;">✅ Onayla</button>
                            <button onclick="adminKullaniciOnayla('${d.id}', 'reddedildi')" style="background:#e74c3c; color:white; border:none; border-radius:5px; padding:5px 10px; cursor:pointer;">❌ Reddet</button>
                        ` : ''}
                        ${data.durum === 'aktif' ? `
                            <button onclick="adminKullaniciOnayla('${d.id}', 'engelli')" style="background:#e74c3c; color:white; border:none; border-radius:5px; padding:5px 10px; margin-right:5px; cursor:pointer;">🚫 Engelle</button>
                        ` : ''}
                        ${data.durum === 'engelli' ? `
                            <button onclick="adminKullaniciOnayla('${d.id}', 'aktif')" style="background:#27ae60; color:white; border:none; border-radius:5px; padding:5px 10px; margin-right:5px; cursor:pointer;">🔓 Aktif Et</button>
                        ` : ''}
                        <select onchange="adminKullaniciOnayla('${d.id}', 'aktif', this.value)" style="padding:4px 8px; border-radius:4px; background:#1a1a1a; color:white; border:1px solid #2a2a2a; margin-top:5px; cursor:pointer;">
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
        listeDiv.innerHTML = html;
    } catch(e) {
        console.error("Kullanıcı listesi getirme hatası:", e);
        listeDiv.innerHTML = '<p style="color:#e74c3c;">Liste yüklenirken hata oluştu.</p>';
    }
}

// ========== SİPARİŞ / İHTİYAÇ LİSTESİ ==========

// Otomatik sipariş numarası üretme fonksiyonu
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

// Siparişleri listele (düzeltilmiş)
async function siparisleriListele() {
    const tbody = document.getElementById('siparislerTablo');
    if (!tbody) return;
    try {
        const snap = await getDocs(query(collection(db, "siparisler"), orderBy("siparisNo", "desc")));
        tbody.innerHTML = "";
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#666;">Henüz ihtiyaç listesi yok</td></tr>';
            return;
        }
        snap.forEach(d => {
            const s = d.data();
            const id = d.id;
            const siparisNo = s.siparisNo || 'SIP-XXX';
            const tarih = s.tarih?.toDate().toLocaleString('tr-TR') || "-";
            let urunOzet = s.urunler?.map(u => `${u.urunAd} (${u.miktar} ${u.birim || 'Adet'})`).join(', ') || '-';
            if (urunOzet.length > 50) urunOzet = urunOzet.slice(0, 50) + '...';
            const durum = s.durum || 'bekliyor';
            const durumClass = `durum-${durum}`;
            const durumText = durum === 'bekliyor' ? 'Bekliyor' : 
                              durum === 'siparis_verildi' ? 'Sipariş Verildi' :
                              durum === 'tamamlandi' ? 'Tamamlandı' : 'İptal';
            tbody.innerHTML += `
                <tr>
                    <td><strong>${siparisNo}</strong></td>
                    <td style="font-size:12px;">${tarih}</td>
                    <td>${urunOzet}</td>
                    <td>${s.tedarikci || '-'}</td>
                    <td><span class="${durumClass}">${durumText}</span></td>
                    <td>
                        <button onclick="siparisDetayGoster('${id}')" style="background:#3498db; color:white; border:none; border-radius:20px; padding:4px 10px; margin-right:4px;">👁️</button>
                        <button onclick="ihtiyacListesiYazdir('tek', '${id}')" style="background:#2c3e50; color:white; border:none; border-radius:20px; padding:4px 10px; margin-right:4px;">🖨️</button>
                        <select onchange="siparisDurumGuncelle('${id}', this.value)" style="padding:4px 8px; border-radius:16px; background:#1a1a1a; color:white; border:1px solid #2a2a2a; font-size:12px; margin-right:4px;">
                            <option value="bekliyor" ${durum === 'bekliyor' ? 'selected' : ''}>Bekliyor</option>
                            <option value="siparis_verildi" ${durum === 'siparis_verildi' ? 'selected' : ''}>Sipariş Verildi</option>
                            <option value="tamamlandi" ${durum === 'tamamlandi' ? 'selected' : ''}>Tamamlandı</option>
                            <option value="iptal" ${durum === 'iptal' ? 'selected' : ''}>İptal</option>
                        </select>
                        <button onclick="siparisSil('${id}')" style="background:#e74c3c; color:white; border:none; border-radius:20px; padding:4px 10px;">🗑️</button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error("Sipariş listeleme hatası:", e); }
}

window.siparisFormuGoster = (editId = null) => {
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
};

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
    } catch(e) { showToast("Veri getirme hatası", true); }
}

window.siparisUrunSatirEkle = (urunId = '', urunAd = '', miktar = '') => {
    const liste = document.getElementById('siparisUrunListesi');
    const satir = document.createElement('div');
    satir.className = 'siparis-urun-satir';
    satir.innerHTML = `
        <select class="siparisUrunSelect" style="flex:2;">
            <option value="">Ürün Seçin</option>
        </select>
        <input type="number" class="siparisUrunMiktar" placeholder="İhtiyaç Miktarı" style="flex:1;" min="1" value="${miktar}">
        <button onclick="this.parentElement.remove()" style="background:#e74c3c; color:white; border:none; border-radius:20px; padding:0 12px;">✖</button>
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
};

window.siparisKaydet = async () => {
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
        if (duzenleId) {
            await updateDoc(doc(db, "siparisler", duzenleId), data);
            showToast("Sipariş güncellendi");
        } else {
            // Otomatik sipariş numarası ata
            const siparisNo = await sonSiparisNumarasiAl();
            data.siparisNo = siparisNo;
            await addDoc(collection(db, "siparisler"), data);
            showToast(`İhtiyaç siparişi oluşturuldu (${siparisNo})`);
        }
        siparisModalKapat();
        siparisleriListele();
    } catch(e) { showToast("Hata: " + e.message, true); }
};

window.siparisModalKapat = () => document.getElementById('siparisModal').style.display = 'none';

window.siparisDetayGoster = async (id) => {
    window._siparisDetayId = id; // yazdırma için global ID
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
        `;
        document.getElementById('siparisDetayModal').style.display = 'flex';
    } catch(e) { showToast("Detay hatası", true); }
};

window.siparisDetayKapat = () => document.getElementById('siparisDetayModal').style.display = 'none';

window.siparisDurumGuncelle = async (id, yeniDurum) => {
    try {
        await updateDoc(doc(db, "siparisler", id), { durum: yeniDurum });
        showToast("Durum güncellendi");
        siparisleriListele();
    } catch(e) { showToast("Durum güncelleme hatası", true); }
};

window.siparisSil = async (id) => {
    if (!confirm("Bu sipariş silinsin mi?")) return;
    try {
        await deleteDoc(doc(db, "siparisler", id));
        showToast("Sipariş silindi");
        siparisleriListele();
    } catch(e) { showToast("Silme hatası", true); }
};

window.kritikStoktanSiparisOlustur = async () => {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (kritikler.length === 0) return showToast("Kritik stokta ürün yok!", true);
    siparisFormuGoster();
    const liste = document.getElementById('siparisUrunListesi');
    liste.innerHTML = '';
    kritikler.forEach(u => {
        const satir = document.createElement('div');
        satir.className = 'siparis-urun-satir';
        const onerilenMiktar = Math.max(1, (u.kritik || 5) * 2 - (u.kalan || 0));
        satir.innerHTML = `
            <select class="siparisUrunSelect" style="flex:2;">
                <option value="${u.id}" selected>${getUrunAdi(u)}</option>
            </select>
            <input type="number" class="siparisUrunMiktar" placeholder="Miktar" style="flex:1;" min="1" value="${onerilenMiktar}">
            <button onclick="this.parentElement.remove()" style="background:#e74c3c; color:white; border:none; border-radius:20px; padding:0 12px;">✖</button>
        `;
        liste.appendChild(satir);
    });
    document.querySelectorAll('.siparisUrunSelect').forEach(sel => {
        for (let [id, u] of Object.entries(stoklar)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = getUrunAdi(u);
            sel.appendChild(opt);
        }
    });
    showToast(`${kritikler.length} kritik ürün ihtiyaç listesine eklendi`);
};

// ========== 🖨️ İHTİYAÇ LİSTESİ YAZDIRMA (YENİ – HER SİPARİŞ BAŞLIK, ÜRÜNLER AYRI SATIR) ==========

window.ihtiyacListesiYazdir = async (tip = 'hepsi', siparisId = null) => {
    try {
        let siparisler = [];
        let baslik = '';
        if (tip === 'hepsi') {
            const snap = await getDocs(query(collection(db, "siparisler"), orderBy("siparisNo", "desc")));
            if (snap.empty) {
                showToast("Yazdırılacak ihtiyaç listesi yok!", true);
                return;
            }
            snap.forEach(d => siparisler.push({ id: d.id, data: d.data() }));
            baslik = '📋 Tüm İhtiyaç Listeleri';
        } else if (tip === 'tek' && siparisId) {
            const docSnap = await getDoc(doc(db, "siparisler", siparisId));
            if (!docSnap.exists()) {
                showToast("Sipariş bulunamadı!", true);
                return;
            }
            siparisler.push({ id: siparisId, data: docSnap.data() });
            baslik = '📋 İhtiyaç Listesi Detayı';
        } else {
            showToast("Geçersiz yazdırma isteği!", true);
            return;
        }

        // Her sipariş için ayrı bölüm oluştur
        let icerikHtml = '';
        siparisler.forEach((item, index) => {
            const s = item.data;
            const siparisNo = s.siparisNo || 'SIP-XXX';
            const tarih = s.tarih?.toDate().toLocaleString('tr-TR') || "-";
            const durumText = s.durum === 'bekliyor' ? 'Bekliyor' : 
                              s.durum === 'siparis_verildi' ? 'Sipariş Verildi' :
                              s.durum === 'tamamlandi' ? 'Tamamlandı' : 'İptal';
            const tedarikci = s.tedarikci || '-';
            const not = s.not || '-';
            const olusturan = s.olusturan || '-';

            // Sipariş başlığı ve bilgiler
            icerikHtml += `
                <div class="siparis-yazdir">
                    <div class="siparis-baslik">
                        <h3>📦 ${siparisNo}</h3>
                        <span class="durum-badge ${s.durum}">${durumText}</span>
                    </div>
                    <div class="siparis-bilgi">
                        <p><strong>Tarih:</strong> ${tarih}</p>
                        <p><strong>Tedarikçi:</strong> ${tedarikci}</p>
                        <p><strong>Not:</strong> ${not}</p>
                        <p><strong>Oluşturan:</strong> ${olusturan}</p>
                    </div>
                    <div class="urun-listesi">
                        <table class="urun-tablo">
                            <thead>
                                <tr><th>Ürün Adı</th><th>Miktar</th><th>Birim</th></tr>
                            </thead>
                            <tbody>
                    `;
            if (s.urunler && s.urunler.length > 0) {
                s.urunler.forEach(u => {
                    icerikHtml += `
                        <tr>
                            <td>${u.urunAd}</td>
                            <td style="text-align:center;">${u.miktar}</td>
                            <td style="text-align:center;">${u.birim || 'Adet'}</td>
                        </tr>
                    `;
                });
            } else {
                icerikHtml += `
                    <tr><td colspan="3">Bu siparişte ürün bulunmuyor.</td></tr>
                `;
            }
            icerikHtml += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            if (index < siparisler.length - 1) {
                icerikHtml += `<div class="sayfa-ayraci"></div>`;
            }
        });

        const yazdirHtml = `
            <div id="yazdirArea">
                <div class="print-header">
                    <h2>${baslik}</h2>
                    <div class="header-info">Yazdırma Tarihi: ${new Date().toLocaleString('tr-TR')}</div>
                </div>
                ${icerikHtml}
                <div class="print-footer">Stok Takip Pro - Otomatik oluşturulmuştur.</div>
            </div>
        `;

        const yeniPencere = window.open('', '_blank', 'width=1000,height=700');
        if (!yeniPencere) {
            showToast("Lütfen pop-up engelleyiciyi kapatın!", true);
            return;
        }

        yeniPencere.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>İhtiyaç Listesi</title>
                <meta charset="UTF-8">
                <style>
                    /* Reset ve genel stiller */
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                        padding: 30px;
                        background: #ffffff;
                        color: #1a1a1a;
                    }
                    .print-header {
                        text-align: center;
                        border-bottom: 2px solid #2c3e50;
                        padding-bottom: 15px;
                        margin-bottom: 30px;
                    }
                    .print-header h2 { font-size: 24px; color: #2c3e50; }
                    .header-info { color: #7f8c8d; font-size: 14px; margin-top: 5px; }
                    .siparis-yazdir {
                        margin-bottom: 30px;
                        border: 1px solid #e0e0e0;
                        border-radius: 8px;
                        padding: 20px;
                        page-break-inside: avoid;
                    }
                    .siparis-baslik {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid #e0e0e0;
                        padding-bottom: 10px;
                        margin-bottom: 12px;
                    }
                    .siparis-baslik h3 { font-size: 18px; color: #2c3e50; }
                    .durum-badge {
                        padding: 4px 14px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                        color: white;
                    }
                    .durum-badge.bekliyor { background: #f39c12; }
                    .durum-badge.siparis_verildi { background: #3498db; }
                    .durum-badge.tamamlandi { background: #27ae60; }
                    .durum-badge.iptal { background: #e74c3c; }
                    .siparis-bilgi {
                        background: #f8f9fa;
                        padding: 10px 15px;
                        border-radius: 6px;
                        margin-bottom: 15px;
                        font-size: 14px;
                    }
                    .siparis-bilgi p { margin: 4px 0; }
                    .siparis-bilgi strong { color: #2c3e50; }
                    .urun-tablo {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 14px;
                    }
                    .urun-tablo th {
                        background: #34495e;
                        color: white;
                        padding: 8px 12px;
                        text-align: left;
                    }
                    .urun-tablo td {
                        padding: 6px 12px;
                        border-bottom: 1px solid #e0e0e0;
                    }
                    .urun-tablo tr:nth-child(even) { background: #f8f9fa; }
                    .sayfa-ayraci {
                        border-top: 2px dashed #ccc;
                        margin: 20px 0;
                    }
                    .print-footer {
                        text-align: center;
                        margin-top: 30px;
                        font-size: 11px;
                        color: #999;
                        border-top: 1px solid #ddd;
                        padding-top: 15px;
                    }
                    .print-actions {
                        text-align: center;
                        margin-top: 25px;
                    }
                    .print-actions button {
                        padding: 10px 24px;
                        border: none;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 14px;
                        margin: 0 6px;
                    }
                    .btn-print { background: #27ae60; color: white; }
                    .btn-close { background: #e74c3c; color: white; }
                    @media print {
                        .print-actions { display: none; }
                        body { padding: 20px; }
                        .siparis-yazdir { border: 1px solid #ddd; page-break-inside: avoid; }
                        .urun-tablo th { background: #34495e !important; color: white !important; }
                        .siparis-bilgi { background: #f8f9fa !important; }
                    }
                </style>
            </head>
            <body>
                ${yazdirHtml}
                <div class="print-actions">
                    <button class="btn-print" onclick="window.print()">🖨️ Yazdır</button>
                    <button class="btn-close" onclick="window.close()">❌ Kapat</button>
                </div>
                <script>
                    document.addEventListener('keydown', function(e) {
                        if (e.ctrlKey && e.key === 'p') { e.preventDefault(); window.print(); }
                    });
                <\/script>
            </body>
            </html>
        `);
        yeniPencere.document.close();

    } catch(e) {
        showToast("Yazdırma hatası: " + e.message, true);
        console.error(e);
    }
};

// Detaydan yazdırma
window.ihtiyacDetayYazdir = async () => {
    if (!window._siparisDetayId) {
        showToast("Sipariş ID'si bulunamadı!", true);
        return;
    }
    await window.ihtiyacListesiYazdir('tek', window._siparisDetayId);
};

// ========== BAŞLAT ==========
verileriGetir();