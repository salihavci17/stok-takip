// --- FIREBASE MODÜLLERİ ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, query, where, Timestamp,
    onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let stoklar = {};
let sepet = [];
let html5QrCode = null;
let seciliUrunId = "";

function getUrunAdi(urun) {
    if (!urun) return "Bilinmeyen";
    return urun.urunAd || urun.ad || urun.isim || urun.name || urun.id || "Bilinmeyen";
}

// ========== VERİ ÇEKME ==========
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
                // Barkod da görünsün
                opt.textContent = `${getUrunAdi(v)}${v.barkod ? ' ('+v.barkod+')' : ''}`;
                select.appendChild(opt);
            }
        });
        stoklariListele();
        hareketleriListele(100); // sadece son 100 hareket
        kritikKontrol();
        popularesiGetir();
        bugunOzetiniGetir();
    });
}

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
        html += `<tr onclick="grupToggle('${grupId}')" style="background:#2a2a2a; cursor:pointer;"><td colspan="3"><b>📂 ${grup}</b></td></tr>`;
        gruplar[grup].forEach(u => {
            const m = u.kalan || 0, k = u.kritik || 5;
            toplam += m;
            if (m <= k) kritikSay++;
            html += `<tr class="${grupId}" onclick="detayGoster('${u.id}')" style="display:none; cursor:pointer;">
                        <td style="padding-left:20px;">${getUrunAdi(u)}<br><small style="color:#888">${u.barkod || '-'}</small></td>
                        <td style="color:${m <= k ? '#ff6b6b' : ''}"><b>${m}</b> ${u.birim || 'Adet'}</td>
                        <td><button onclick="event.stopPropagation(); urunSil('${u.id}')" style="background:#ff3b30; color:white; border:none; border-radius:20px; padding:6px 12px;">✖</button></td>
                    </tr>`;
        });
    });
    tbody.innerHTML = html;
    document.getElementById('dashToplam').innerText = toplam;
    document.getElementById('dashKritik').innerText = kritikSay;
}

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

// HAREKETLER - Sadece son 100 kayıt (hızlı)
async function hareketleriListele(limitKac = 100) {
    const tbody = document.getElementById('hareketlerTablo');
    if (!tbody) return;
    try {
        const q = query(collection(db, "hareketler"), orderBy("tarih", "desc"), limit(limitKac));
        const snap = await getDocs(q);
        tbody.innerHTML = "";
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#666;">Henüz hareket yok</td><tr>';
            return;
        }
        snap.forEach(d => {
            const h = d.data();
            const tarih = h.tarih?.toDate().toLocaleString('tr-TR') || "-";
            const isoDate = h.tarih?.toDate().toISOString().split('T')[0] || "";
            tbody.innerHTML += `
                <tr>
                    <td style="font-size:12px;">${tarih}</td>
                    <td>${h.urun || "-"}</td>
                    <td><b>${h.miktar}</b> ${h.birim ? h.birim : ''}</td>
                    <td style="color:${h.tur === 'giris' ? '#00c853' : '#ff3b30'}"><b>${h.tur === 'giris' ? 'GİRİŞ' : 'ÇIKIŞ'}</b></td>
                    <td>
                        <button onclick="hareketDuzenle('${d.id}', '${h.urun}', ${h.miktar}, '${isoDate}', '${h.tur}', '${h.birim || ''}')" style="background:#f39c12; color:white; border:none; border-radius:20px; padding:6px 12px; margin-right:5px;">✏️ Düzenle</button>
                        <button onclick="hareketSil('${d.id}')" style="background:#ff3b30; color:white; border:none; border-radius:20px; padding:6px 12px;">🗑️ Sil</button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error("Hareket listeleme hatası:", e); }
}

// Tüm hareketleri göster (yavaş olabilir)
window.tumHareketleriGoster = async () => {
    await hareketleriListele(999999);
    alert("Tüm hareketler yüklendi (sayfa yavaşlayabilir).");
};

window.hareketSil = async (id) => {
    if (confirm("Bu hareket silinsin mi?")) {
        await deleteDoc(doc(db, "hareketler", id));
        hareketleriListele(100);
    }
};

// HAREKET DÜZENLEME
let duzenlenecekHareket = { id: null, urun: null, eskiMiktar: null, eskiTarih: null, tur: null, birim: null };

window.hareketDuzenle = (id, urun, miktar, tarihIso, tur, birim) => {
    duzenlenecekHareket = { id, urun, eskiMiktar: miktar, eskiTarih: tarihIso, tur, birim };
    document.getElementById('duzenleMiktar').value = miktar;
    document.getElementById('duzenleTarih').value = tarihIso;
    document.getElementById('hareketDuzenleModal').style.display = 'flex';
};

window.hareketDuzenleKaydet = async () => {
    const yeniMiktar = Number(document.getElementById('duzenleMiktar').value);
    const yeniTarihStr = document.getElementById('duzenleTarih').value;
    if (!yeniMiktar || yeniMiktar <= 0) return alert("Geçerli bir miktar girin!");
    
    const { id, urun, eskiMiktar, tur, birim } = duzenlenecekHareket;
    if (!id) return;
    
    let yeniTarih = Timestamp.now();
    if (yeniTarihStr) {
        const date = new Date(yeniTarihStr);
        date.setHours(12, 0, 0, 0);
        yeniTarih = Timestamp.fromDate(date);
    }
    
    // Ürünü bul
    let urunId = null;
    for (let [uid, u] of Object.entries(stoklar)) {
        if (getUrunAdi(u) === urun) {
            urunId = uid;
            break;
        }
    }
    if (!urunId) return alert("Ürün bulunamadı!");
    
    const mevcutStok = stoklar[urunId]?.kalan || 0;
    let yeniStok = mevcutStok;
    
    if (tur === 'giris') {
        yeniStok = mevcutStok - eskiMiktar + yeniMiktar;
    } else {
        yeniStok = mevcutStok + eskiMiktar - yeniMiktar;
    }
    
    if (yeniStok < 0) return alert("Yeni miktar stok düzenlemesi sonucu stok negatif olamaz!");
    
    try {
        const batch = writeBatch(db);
        batch.delete(doc(db, "hareketler", id));
        const yeniHareketRef = doc(collection(db, "hareketler"));
        batch.set(yeniHareketRef, {
            urunId: urunId,
            urun: urun,
            tur: tur,
            miktar: yeniMiktar,
            birim: birim,
            tarih: yeniTarih,
            not: "Düzenlendi"
        });
        batch.update(doc(db, "stoklar", urunId), { kalan: yeniStok });
        
        await batch.commit();
        alert("✅ Hareket düzenlendi!");
        hareketDuzenleKapat();
        hareketleriListele(100);
    } catch(e) {
        alert("Düzenleme hatası: " + e.message);
    }
};

window.hareketDuzenleKapat = () => {
    document.getElementById('hareketDuzenleModal').style.display = 'none';
    duzenlenecekHareket = { id: null, urun: null, eskiMiktar: null, eskiTarih: null, tur: null, birim: null };
};

// Popüler ürün (son 500 çıkış)
async function popularesiGetir() {
    try {
        const q = query(collection(db, "hareketler"), where("tur", "==", "cikis"), limit(500));
        const snap = await getDocs(q);
        const sayilar = {};
        snap.forEach(d => { 
            const ad = d.data().urun || "Bilinmeyen"; 
            sayilar[ad] = (sayilar[ad] || 0) + (d.data().miktar || 1); 
        });
        let populerAd = "-", max = 0;
        for (let [ad, adet] of Object.entries(sayilar)) {
            if (adet > max) { max = adet; populerAd = ad; }
        }
        document.getElementById('dashPopuler').innerText = populerAd !== "-" ? `${populerAd} (${max})` : "-";
    } catch(e) { 
        console.error("Popüler ürün hatası:", e);
        document.getElementById('dashPopuler').innerText = "-";
    }
}

async function bugunOzetiniGetir() {
    const bugun = new Date(); bugun.setHours(0,0,0,0);
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("tarih", ">=", Timestamp.fromDate(bugun))));
        let toplam = 0;
        snap.forEach(d => { if(d.data().tur === 'giris') toplam += d.data().miktar; });
        document.getElementById('dashGiris').innerText = toplam;
    } catch(e) { console.error(e); }
}

// ========== ÜRÜN EKLEME ==========
window.urunEkle = async () => {
    const ad = document.getElementById('urunAdi').value.trim();
    if (!ad) return alert("Ürün adı giriniz!");
    
    const barkod = document.getElementById('urunBarkod').value.trim();
    const grup = document.getElementById('urunGrup').value;
    const baslangicStok = Number(document.getElementById('urunBaslangicStok').value) || 0;
    const kritik = Number(document.getElementById('urunKritik').value) || 5;
    const birim = document.getElementById('urunBirim').value.trim() || "Adet";
    const tedarikci = document.getElementById('urunTedarikci').value.trim() || "";
    
    try {
        const yeniUrunRef = doc(collection(db, "stoklar"));
        await setDoc(yeniUrunRef, {
            urunAd: ad,
            barkod: barkod,
            grup: grup,
            kalan: baslangicStok,
            kritik: kritik,
            birim: birim,
            tedarikci: tedarikci,
            olusturmaTarihi: Timestamp.now()
        });
        
        if (baslangicStok > 0) {
            await setDoc(doc(collection(db, "hareketler")), {
                urunId: yeniUrunRef.id,
                urun: ad,
                tur: "giris",
                miktar: baslangicStok,
                birim: birim,
                tarih: Timestamp.now(),
                not: "Başlangıç stoğu"
            });
        }
        
        alert("✅ Ürün başarıyla eklendi!");
        document.getElementById('urunAdi').value = "";
        document.getElementById('urunBarkod').value = "";
        document.getElementById('urunBaslangicStok').value = "0";
        document.getElementById('urunKritik').value = "5";
        document.getElementById('urunBirim').value = "Adet";
        document.getElementById('urunTedarikci').value = "";
        document.getElementById('urunGrup').value = "Genel";
    } catch(e) {
        alert("Hata: " + e.message);
    }
};

// ========== STOK İŞLEMİ ==========
window.stokIslem = async (tip) => {
    const id = document.getElementById('urunSelect').value;
    const miktar = Number(document.getElementById('islemMiktar').value);
    const secilenTarih = document.getElementById('islemTarihi')?.value;
    if (!id) return alert("Ürün seçin!");
    if (!miktar || miktar <= 0) return alert("Geçerli miktar girin!");
    
    const mevcut = stoklar[id]?.kalan || 0;
    const yeni = tip === 'giris' ? mevcut + miktar : mevcut - miktar;
    if (tip === 'cikis' && yeni < 0) return alert("Yetersiz stok!");
    
    let islemTarihi = Timestamp.now();
    if (secilenTarih) {
        const date = new Date(secilenTarih);
        date.setHours(12,0,0,0);
        islemTarihi = Timestamp.fromDate(date);
    }
    
    const batch = writeBatch(db);
    batch.update(doc(db, "stoklar", id), { kalan: yeni });
    batch.set(doc(collection(db, "hareketler")), {
        urunId: id,
        urun: getUrunAdi(stoklar[id]),
        tur: tip,
        miktar: miktar,
        birim: stoklar[id]?.birim || "Adet",
        tarih: islemTarihi
    });
    await batch.commit();
    alert("✅ İşlem tamam!");
    document.getElementById('islemMiktar').value = "";
    if(document.getElementById('islemTarihi')) document.getElementById('islemTarihi').value = "";
    hareketleriListele(100);
};

// ========== ÜRÜN GÜNCELLEME ==========
window.urunGuncelle = async () => {
    if (!seciliUrunId) return alert("Ürün seçili değil!");
    
    const yeniAd = document.getElementById('modalUrunAd').value;
    const yeniBarkod = document.getElementById('modalBarkod').value;
    const yeniGrup = document.getElementById('modalGrup').value;
    const yeniKalan = Number(document.getElementById('modalMiktar').value);
    const yeniKritik = Number(document.getElementById('modalKritik').value);
    const yeniBirim = document.getElementById('modalBirim').value;
    const yeniTedarikci = document.getElementById('modalTedarikci').value;
    
    try {
        await updateDoc(doc(db, "stoklar", seciliUrunId), {
            urunAd: yeniAd,
            barkod: yeniBarkod,
            grup: yeniGrup,
            kalan: yeniKalan,
            kritik: yeniKritik,
            birim: yeniBirim,
            tedarikci: yeniTedarikci,
            guncellemeTarihi: Timestamp.now()
        });
        alert("✅ Ürün güncellendi!");
        kapatModal();
    } catch(e) {
        alert("Güncelleme hatası: " + e.message);
    }
};

// ========== DETAY GÖSTER ==========
window.detayGoster = async (id) => {
    seciliUrunId = id;
    const u = stoklar[id];
    if (!u) return alert("Ürün bulunamadı!");
    
    document.getElementById('modalUrunAd').value = getUrunAdi(u);
    document.getElementById('modalBarkod').value = u.barkod || "";
    document.getElementById('modalMiktar').value = u.kalan || 0;
    document.getElementById('modalKritik').value = u.kritik || 5;
    document.getElementById('modalGrup').value = u.grup || "Genel";
    document.getElementById('modalBirim').value = u.birim || "Adet";
    document.getElementById('modalTedarikci').value = u.tedarikci || "";
    document.getElementById('detayModal').style.display = 'flex';
    
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("urunId", "==", id), orderBy("tarih", "desc"), limit(10)));
        const hareketHtml = snap.empty ? "<i>Hareket yok</i>" : snap.docs.map(d => {
            const data = d.data();
            return `<div style="padding:8px; border-bottom:1px solid #2a2a2a;">${data.tarih?.toDate().toLocaleString()} - ${data.tur === 'giris' ? '➕' : '➖'} ${data.miktar} ${data.birim || ''}</div>`;
        }).join('');
        document.getElementById('detayIcerik').innerHTML = hareketHtml;
    } catch(e) { console.error(e); }
};

window.kapatModal = () => document.getElementById('detayModal').style.display = 'none';
window.urunSil = async (id) => {
    if(confirm("Bu ürün silinsin mi?")) await deleteDoc(doc(db, "stoklar", id));
};

// ========== SEKMELER ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const tab = document.getElementById(this.dataset.tab);
        if(tab) tab.classList.add('active');
        this.classList.add('active');
    });
});

window.grupToggle = (id) => {
    document.querySelectorAll(`.${id}`).forEach(r => {
        r.style.display = r.style.display === 'none' ? 'table-row' : 'none';
    });
};

// ========== SEPET ==========
window.sepeteEkle = () => {
    const id = document.getElementById('urunSelect').value;
    const miktar = Number(document.getElementById('islemMiktar').value);
    if (!id) return alert("Ürün seçin!");
    if (!miktar || miktar <= 0) return alert("Geçerli miktar girin!");
    sepet.push({ id, ad: getUrunAdi(stoklar[id]), miktar });
    sepetiGoster();
    document.getElementById('islemMiktar').value = "";
};

function sepetiGoster() {
    const liste = document.getElementById('sepetListesi');
    const butonlar = document.getElementById('sepetButonlar');
    if (sepet.length === 0) {
        liste.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">📭 Sepet boş</div>';
        butonlar.style.display = 'none';
    } else {
        liste.innerHTML = sepet.map((u, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #2a2a2a;">
                <span><b>${u.ad}</b> x${u.miktar}</span>
                <button onclick="sepetSil(${i})" style="background:#ff3b30; color:white; border:none; border-radius:20px; padding:6px 14px;">Sil</button>
            </div>
        `).join('');
        butonlar.style.display = 'flex';
    }
}

window.sepetSil = (i) => { sepet.splice(i, 1); sepetiGoster(); };
window.topluIslem = async (tip) => {
    if (sepet.length === 0) return alert("Sepet boş!");
    const batch = writeBatch(db);
    for (let item of sepet) {
        const mevcut = stoklar[item.id]?.kalan || 0;
        const yeni = tip === 'giris' ? mevcut + item.miktar : mevcut - item.miktar;
        if (tip === 'cikis' && mevcut < item.miktar) throw new Error(`${item.ad} için stok yetersiz!`);
        batch.update(doc(db, "stoklar", item.id), { kalan: yeni });
        batch.set(doc(collection(db, "hareketler")), { urunId: item.id, urun: item.ad, tur: tip, miktar: item.miktar, tarih: Timestamp.now() });
    }
    await batch.commit();
    alert("Toplu işlem başarılı!");
    sepet = [];
    sepetiGoster();
    hareketleriListele(100);
};

// ========== KAMERA ==========
let kameraAktif = false;
window.kameraBaslat = () => {
    const reader = document.getElementById("reader");
    const acBtn = document.getElementById("kameraAcBtn");
    const kapatBtn = document.getElementById("kameraKapatBtn");
    if (kameraAktif) return;
    if (!reader) return alert("Kamera alanı bulunamadı!");
    reader.style.display = "block";
    if (acBtn) acBtn.style.display = "none";
    if (kapatBtn) kapatBtn.style.display = "block";
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            const select = document.getElementById('urunSelect');
            let bulundu = false;
            for (let i = 0; i < select.options.length; i++) {
                const opt = select.options[i];
                if (opt.textContent.includes(decodedText) || (stoklar[opt.value]?.barkod === decodedText)) {
                    select.value = opt.value;
                    alert("✅ Ürün bulundu: " + opt.textContent);
                    bulundu = true;
                    break;
                }
            }
            if (!bulundu) alert("⚠️ Barkod/Ürün bulunamadı: " + decodedText);
        },
        (err) => console.log("QR okuma hatası:", err)
    ).then(() => {
        kameraAktif = true;
    }).catch(e => {
        alert("Kamera başlatılamadı: " + e);
        reader.style.display = "none";
        if (acBtn) acBtn.style.display = "block";
        if (kapatBtn) kapatBtn.style.display = "none";
    });
};

window.kameraDurdur = () => {
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    const reader = document.getElementById("reader");
    const acBtn = document.getElementById("kameraAcBtn");
    const kapatBtn = document.getElementById("kameraKapatBtn");
    if (reader) reader.style.display = "none";
    if (acBtn) acBtn.style.display = "block";
    if (kapatBtn) kapatBtn.style.display = "none";
    kameraAktif = false;
};

window.yeniUrunKamera = () => {
    const reader = document.getElementById("reader");
    const acBtn = document.getElementById("kameraAcBtn");
    const kapatBtn = document.getElementById("kameraKapatBtn");
    if (!reader) return;
    reader.style.display = "block";
    if (acBtn) acBtn.style.display = "none";
    if (kapatBtn) kapatBtn.style.display = "block";
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            document.getElementById('urunBarkod').value = decodedText;
            alert("✅ Barkod okundu: " + decodedText);
            window.kameraDurdur();
        },
        (err) => {}
    ).catch(e => {
        alert("Kamera hatası: " + e);
        reader.style.display = "none";
        if (acBtn) acBtn.style.display = "block";
        if (kapatBtn) kapatBtn.style.display = "none";
    });
};

document.getElementById("kameraAcBtn")?.addEventListener("click", window.kameraBaslat);
document.getElementById("kameraKapatBtn")?.addEventListener("click", window.kameraDurdur);
document.getElementById("yeniUrunKameraBtn")?.addEventListener("click", window.yeniUrunKamera);

// ========== RAPORLAMA ==========
window.raporOlustur = async () => {
    const baslangic = document.getElementById('raporBaslangic')?.value;
    const bitis = document.getElementById('raporBitis')?.value;
    if (!baslangic || !bitis) return alert("Tarih seçin!");
    const start = new Date(baslangic); start.setHours(0,0,0,0);
    const end = new Date(bitis); end.setHours(23,59,59,999);
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
        if (Object.keys(data).length === 0) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#666;">Veri yok</td></tr>';
        else Object.entries(data).sort().forEach(([urun, val]) => tbody.innerHTML += `<tr><td style="text-align:left;">${urun}</td><td style="text-align:center">${val.giris}</td><td style="text-align:center">${val.cikis}</td></tr>`);
        document.getElementById('raporSonuc').style.display = 'block';
    } catch(e) { alert(e.message); }
};

window.excelIndir = () => {
    const ws = XLSX.utils.table_to_sheet(document.getElementById('raporTablo'));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `rapor_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.pdfIndir = () => {
    const tablo = document.getElementById('raporTablo').cloneNode(true);
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Rapor</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#333;color:white}</style></head><body><h1>Stok Raporu</h1><p>${new Date().toLocaleString('tr-TR')}</p>${tablo.outerHTML}</body></html>`);
    w.document.close();
    w.print();
};

window.siparisPDF = () => {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (kritikler.length === 0) return alert("Kritik ürün yok!");
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Sipariş</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#ff3b30;color:white}</style></head><body><h1>Sipariş Listesi</h1><p>${new Date().toLocaleString('tr-TR')}</p><table><thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead><tbody>${kritikler.map(u => `<tr><td style="text-align:left;">${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0, (u.kritik * 2) - u.kalan)}</td></tr>`).join('')}</tbody></table></body></html>`);
    w.document.close();
    w.print();
};

window.siparisYazdir = () => {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (kritikler.length === 0) return alert("Kritik ürün yok!");
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Sipariş</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#ff3b30;color:white}</style></head><body><h1>Sipariş Listesi</h1><p>${new Date().toLocaleString('tr-TR')}</p><table><thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead><tbody>${kritikler.map(u => `<tr><td style="text-align:left;">${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0, (u.kritik * 2) - u.kalan)}</td></tr>`).join('')}</tbody></table><script>window.print();</script></body></html>`);
    w.document.close();
};

// Filtreleme
window.tabloFiltrele = () => {
    const f = document.getElementById('aramaKutusu')?.value.toLowerCase() || "";
    document.querySelectorAll('#tablo tr').forEach(r => {
        if (r.classList.length === 0 || r.classList[0]?.startsWith('grup-')) r.style.display = '';
        else {
            const text = r.innerText.toLowerCase();
            r.style.display = text.includes(f) ? '' : 'none';
        }
    });
};

// ========== BAŞLAT ==========
verileriGetir();