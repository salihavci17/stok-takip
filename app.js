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
                opt.textContent = getUrunAdi(v);
                select.appendChild(opt);
            }
        });
        stoklariListele();
        hareketleriListele();
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
        html += `<tr onclick="grupToggle('${grupId}')" style="background:#2a2a2a; cursor:pointer;"><td colspan="3"><b>📂 ${grup}</b><td></tr>`;
        gruplar[grup].forEach(u => {
            const m = u.kalan || 0, k = u.kritik || 5;
            toplam += m;
            if (m <= k) kritikSay++;
            html += `<tr class="${grupId}" onclick="detayGoster('${u.id}')" style="display:none; cursor:pointer;">
                        <td style="padding-left:20px;">${getUrunAdi(u)}</td>
                        <td style="color:${m <= k ? '#ff6b6b' : ''}"><b>${m}</b></td>
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
        if (liste) liste.innerHTML = kritikler.map(u => `<li><strong>${getUrunAdi(u)}</strong>: Stok ${u.kalan} / Kritik ${u.kritik}</li>`).join('');
    } else {
        if (panel) panel.style.display = 'none';
    }
}

async function hareketleriListele() {
    const tbody = document.getElementById('hareketlerTBody');
    if (!tbody) return;
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), orderBy("tarih", "desc"), limit(100)));
        tbody.innerHTML = "";
        snap.forEach(d => {
            const h = d.data();
            const tarih = h.tarih?.toDate().toLocaleString('tr-TR') || "-";
            tbody.innerHTML += `
                <tr><td style="font-size:12px;">${tarih}</td>
                    <td>${h.urun || "-"}</td>
                    <td><b>${h.miktar}</b></td>
                    <td style="color:${h.tur === 'giris' ? '#00c853' : '#ff3b30'}"><b>${h.tur === 'giris' ? 'GİRİŞ' : 'ÇIKIŞ'}</b></td>
                </tr>`;
        });
    } catch(e) { console.error(e); }
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

async function popularesiGetir() {
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("tur", "==", "cikis")));
        const sayilar = {};
        snap.forEach(d => { const ad = d.data().urun || "Bilinmeyen"; sayilar[ad] = (sayilar[ad] || 0) + (d.data().miktar || 1); });
        const populer = Object.entries(sayilar).sort((a,b) => b[1] - a[1])[0];
        document.getElementById('dashPopuler').innerText = populer ? populer[0] : "-";
    } catch(e) { console.error(e); }
}

// ========== ÜRÜN İŞLEMLERİ ==========
window.urunEkle = async () => {
    const ad = document.getElementById('urunAdi').value.trim();
    if (!ad) return alert("Ürün adı girin!");
    await setDoc(doc(collection(db, "stoklar")), {
        urunAd: ad,
        barkod: document.getElementById('urunBarkod').value.trim(),
        kalan: 0, kritik: 5, grup: "Genel"
    });
    alert("✅ Ürün eklendi!");
    document.getElementById('urunAdi').value = "";
    document.getElementById('urunBarkod').value = "";
};

window.stokIslem = async (tip) => {
    const id = document.getElementById('urunSelect').value;
    const miktar = Number(document.getElementById('islemMiktar').value);
    const secilenTarih = document.getElementById('islemTarihi').value;
    
    if (!id) return alert("Ürün seçin!");
    if (!miktar || miktar <= 0) return alert("Geçerli miktar girin!");
    
    const mevcut = stoklar[id]?.kalan || 0;
    const yeni = tip === 'giris' ? mevcut + miktar : mevcut - miktar;
    if (tip === 'cikis' && yeni < 0) return alert("Yetersiz stok!");
    
    // Tarih seçimi: seçilmişse o tarihi kullan, yoksa bugünü
    let islemTarihi = Timestamp.now();
    if (secilenTarih) {
        const date = new Date(secilenTarih);
        date.setHours(12, 0, 0, 0);
        islemTarihi = Timestamp.fromDate(date);
    }
    
    const batch = writeBatch(db);
    batch.update(doc(db, "stoklar", id), { kalan: yeni });
    batch.set(doc(collection(db, "hareketler")), {
        urunId: id, urun: getUrunAdi(stoklar[id]), tur: tip, miktar: miktar, tarih: islemTarihi
    });
    await batch.commit();
    alert("✅ İşlem başarılı!");
    document.getElementById('islemMiktar').value = "";
    document.getElementById('islemTarihi').value = "";
};

window.urunGuncelle = async () => {
    if (!seciliUrunId) return alert("Ürün seçili değil!");
    await updateDoc(doc(db, "stoklar", seciliUrunId), {
        urunAd: document.getElementById('modalUrunAd').value,
        barkod: document.getElementById('modalBarkod').value,
        kalan: Number(document.getElementById('modalMiktar').value),
        kritik: Number(document.getElementById('modalKritik').value),
        grup: document.getElementById('modalGrup').value
    });
    alert("✅ Güncellendi!");
    kapatModal();
};

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

window.detayGoster = async (id) => {
    seciliUrunId = id;
    const u = stoklar[id];
    document.getElementById('modalUrunAd').value = getUrunAdi(u);
    document.getElementById('modalMiktar').value = u.kalan;
    document.getElementById('modalBarkod').value = u.barkod || "";
    document.getElementById('modalKritik').value = u.kritik || 5;
    document.getElementById('modalGrup').value = u.grup || "Genel";
    document.getElementById('detayModal').style.display = 'flex';
    try {
        const snap = await getDocs(query(collection(db, "hareketler"), where("urunId", "==", id), orderBy("tarih", "desc"), limit(10)));
        document.getElementById('detayIcerik').innerHTML = snap.empty ? "Hareket yok" : snap.docs.map(d => `<div style="padding:8px; border-bottom:1px solid #2a2a2a;">${d.data().tarih?.toDate().toLocaleString()} - ${d.data().tur}: ${d.data().miktar}</div>`).join('');
    } catch(e) { console.error(e); }
};

window.kapatModal = () => document.getElementById('detayModal').style.display = 'none';

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
};

// ========== KAMERA ==========
let kameraAktif = false;
window.kameraBaslat = () => {
    const reader = document.getElementById("reader");
    const acBtn = document.getElementById("kameraAcBtn");
    const kapatBtn = document.getElementById("kameraKapatBtn");
    if (kameraAktif) return;
    reader.style.display = "block";
    acBtn.style.display = "none";
    kapatBtn.style.display = "block";
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        const select = document.getElementById('urunSelect');
        for (let i = 0; i < select.options.length; i++) {
            const opt = select.options[i];
            if (opt.text === text || stoklar[opt.value]?.barkod === text) {
                select.value = opt.value;
                alert("✅ Ürün bulundu: " + opt.text);
                break;
            }
        }
    }, (err) => {}).then(() => kameraAktif = true).catch(e => alert("Kamera hatası: " + e));
};

window.kameraDurdur = () => {
    const reader = document.getElementById("reader");
    const acBtn = document.getElementById("kameraAcBtn");
    const kapatBtn = document.getElementById("kameraKapatBtn");
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    reader.style.display = "none";
    acBtn.style.display = "block";
    kapatBtn.style.display = "none";
    kameraAktif = false;
};

window.yeniUrunKamera = () => {
    const reader = document.getElementById("reader");
    const acBtn = document.getElementById("kameraAcBtn");
    const kapatBtn = document.getElementById("kameraKapatBtn");
    reader.style.display = "block";
    acBtn.style.display = "none";
    kapatBtn.style.display = "block";
    if (html5QrCode) html5QrCode.stop().catch(()=>{});
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        document.getElementById('urunBarkod').value = text;
        alert("✅ Barkod okundu: " + text);
        kameraDurdur();
    }, (err) => {}).catch(e => alert("Kamera hatası: " + e));
};

document.getElementById("kameraAcBtn")?.addEventListener("click", kameraBaslat);
document.getElementById("kameraKapatBtn")?.addEventListener("click", kameraDurdur);
document.getElementById("yeniUrunKameraBtn")?.addEventListener("click", yeniUrunKamera);

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
    w.document.write(`<html><head><meta charset="UTF-8"><title>Sipariş</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#ff3b30;color:white}</style></head><body><h1>Sipariş Listesi</h1><p>${new Date().toLocaleString('tr-TR')}</p><table><thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead><tbody>${kritikler.map(u => `<tr><td>${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0, (u.kritik * 2) - u.kalan)}</td></tr>`).join('')}</tbody></table></body></html>`);
    w.document.close();
    w.print();
};

window.siparisYazdir = () => {
    const kritikler = Object.values(stoklar).filter(u => (u.kalan || 0) <= (u.kritik || 5));
    if (kritikler.length === 0) return alert("Kritik ürün yok!");
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Sipariş</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#ff3b30;color:white}</style></head><body><h1>Sipariş Listesi</h1><p>${new Date().toLocaleString('tr-TR')}</p><tr><thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead><tbody>${kritikler.map(u => `<tr><td>${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0, (u.kritik * 2) - u.kalan)}</td></tr>`).join('')}</tbody></table><script>window.print();</script></body></html>`);
    w.document.close();
};

window.tabloFiltrele = () => {
    const f = document.getElementById('aramaKutusu')?.value.toLowerCase() || "";
    document.querySelectorAll('#tablo tr').forEach(r => {
        if (r.classList.length === 0 || r.classList[0]?.startsWith('grup-')) r.style.display = '';
        else r.style.display = r.innerText.toLowerCase().includes(f) ? '' : 'none';
    });
};

// ========== BAŞLAT ==========
verileriGetir();