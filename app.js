// --- FIREBASE MODÜLLERİ ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    where, 
    Timestamp,
    onSnapshot, 
    doc, 
    setDoc, 
    deleteDoc, 
    writeBatch, 
    updateDoc, 
    orderBy,
    limit
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

// --- BAŞLATMA ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- DEĞİŞKENLER ---
let stoklar = {};
let sepet = [];
let html5QrCode = null;
let seciliUrunId = "";

// --- YARDIMCI ---
function getUrunAdi(urun) {
    if (!urun) return "Bilinmeyen";
    return urun.urunAd || urun.ad || urun.isim || urun.name || urun.id || "Bilinmeyen";
}

// --- VERİ ÇEKME ---
function verileriGetir() {
    onSnapshot(collection(db, "stoklar"), (snap) => {
        stoklar = {};
        const urunSelect = document.getElementById("urunSelect");
        if (urunSelect) urunSelect.innerHTML = '<option value="">Ürün Seçin</option>';

        snap.forEach((d) => {
            const veri = d.data();
            stoklar[d.id] = { id: d.id, ...veri, kalan: veri.kalan || 0, kritik: veri.kritik || 5 };
            
            if (urunSelect) {
                const option = document.createElement("option");
                option.value = d.id;
                option.textContent = getUrunAdi(veri);
                urunSelect.appendChild(option);
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

    let html = "";
    let toplam = 0, kritikSay = 0;
    let gruplar = {};

    Object.values(stoklar).forEach(u => {
        const g = u.grup || "Genel";
        if (!gruplar[g]) gruplar[g] = [];
        gruplar[g].push(u);
    });

    Object.keys(gruplar).sort().forEach((grup, idx) => {
        const grupId = `grup-${idx}`;
        html += `<tr onclick="grupToggle('${grupId}')" class="grup-baslik"><td colspan="3">📂 ${grup}</td></tr>`;
        
        gruplar[grup].forEach(u => {
            const miktar = parseInt(u.kalan) || 0;
            const kritik = parseInt(u.kritik) || 5;
            toplam += miktar;
            if(miktar <= kritik) kritikSay++;
            
            html += `
                <tr class="${grupId}" onclick="detayGoster('${u.id}')" style="display:none">
                    <td style="padding-left:20px;">${getUrunAdi(u)}</td>
                    <td style="color:${miktar <= kritik ? 'red' : 'inherit'}">${miktar}</td>
                    <td><button onclick="event.stopPropagation(); urunSil('${u.id}')">✖</button></td>
                </tr>
            `;
        });
    });

    tbody.innerHTML = html;
    document.getElementById('dashToplam').innerText = toplam;
    document.getElementById('dashKritik').innerText = kritikSay;
}

function kritikKontrol() {
    const kritikUrunler = Object.values(stoklar).filter(u => (parseInt(u.kalan) || 0) <= (parseInt(u.kritik) || 5));
    const kritikPanel = document.getElementById('kritikPanel');
    const kritikListe = document.getElementById('kritikListe');
    
    if (kritikUrunler.length > 0) {
        if (kritikPanel) kritikPanel.style.display = 'block';
        if (kritikListe) {
            kritikListe.innerHTML = kritikUrunler.map(u => `<li><strong>${getUrunAdi(u)}</strong>: Stok ${u.kalan} / Kritik ${u.kritik}</li>`).join('');
        }
    } else {
        if (kritikPanel) kritikPanel.style.display = 'none';
    }
}

async function popularesiGetir() {
    try {
        const q = query(collection(db, "hareketler"), where("tur", "==", "cikis"));
        const snap = await getDocs(q);
        const sayilar = {};
        snap.forEach(d => { const ad = d.data().urun || "Bilinmeyen"; sayilar[ad] = (sayilar[ad] || 0) + (d.data().miktar || 1); });
        const populer = Object.entries(sayilar).sort((a,b) => b[1] - a[1])[0];
        const populerDiv = document.getElementById('dashPopuler');
        if(populerDiv) populerDiv.innerText = populer ? populer[0] : "-";
    } catch(e) { console.error(e); }
}

async function hareketleriListele() {
    const tbody = document.getElementById('hareketlerTablo');
    if (!tbody) return;
    try {
        const q = query(collection(db, "hareketler"), orderBy("tarih", "desc"), limit(50));
        const snap = await getDocs(q);
        tbody.innerHTML = "";
        snap.forEach(d => {
            const h = d.data();
            const tarih = h.tarih?.toDate().toLocaleString('tr-TR') || "-";
            tbody.innerHTML += `
                <tr>
                    <td>${tarih}</td>
                    <td>${h.urun || "-"}</td>
                    <td>${h.miktar}</td>
                    <td style="color:${h.tur === 'giris' ? 'green' : 'red'}">${h.tur === 'giris' ? 'GİRİŞ' : 'ÇIKIŞ'}</td>
                    <td><button onclick="hareketSil('${d.id}')" style="background:none; color:red;">🗑️</button></td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

window.hareketSil = async (id) => {
    if(confirm("Bu hareket silinsin mi?")) {
        await deleteDoc(doc(db, "hareketler", id));
        hareketleriListele();
    }
};

async function bugunOzetiniGetir() {
    const baslangic = new Date();
    baslangic.setHours(0,0,0,0);
    try {
        const q = query(collection(db, "hareketler"), where("tarih", ">=", Timestamp.fromDate(baslangic)));
        const snap = await getDocs(q);
        let toplam = 0;
        snap.forEach(d => { if(d.data().tur === 'giris') toplam += d.data().miktar; });
        const dashGiris = document.getElementById('dashGiris');
        if(dashGiris) dashGiris.innerText = toplam;
    } catch(e) { console.error(e); }
}

// --- ÜRÜN İŞLEMLERİ ---
async function urunEkle() {
    const ad = document.getElementById('urunAdi').value.trim();
    if (!ad) return alert("Ürün adı girin!");
    try {
        await setDoc(doc(collection(db, "stoklar")), {
            urunAd: ad,
            barkod: document.getElementById('urunBarkod').value.trim(),
            kalan: 0, kritik: 5, grup: "Genel"
        });
        alert("Ürün eklendi!");
        document.getElementById('urunAdi').value = "";
        document.getElementById('urunBarkod').value = "";
    } catch(e) { alert(e.message); }
}

async function stokIslem(tip) {
    const id = document.getElementById('urunSelect').value;
    const miktar = Number(document.getElementById('islemMiktar').value);
    if (!id) return alert("Ürün seçin!");
    if (!miktar || miktar <= 0) return alert("Geçerli miktar girin!");
    
    const mevcut = stoklar[id]?.kalan || 0;
    const yeni = tip === 'giris' ? mevcut + miktar : mevcut - miktar;
    if (tip === 'cikis' && yeni < 0) return alert("Yetersiz stok!");
    
    try {
        const batch = writeBatch(db);
        batch.update(doc(db, "stoklar", id), { kalan: yeni });
        batch.set(doc(collection(db, "hareketler")), {
            urunId: id, urun: getUrunAdi(stoklar[id]), tur: tip, miktar: miktar, tarih: Timestamp.now()
        });
        await batch.commit();
        alert("İşlem başarılı!");
        document.getElementById('islemMiktar').value = "";
    } catch(e) { alert(e.message); }
}

window.urunGuncelle = async () => {
    if (!seciliUrunId) return alert("Ürün seçili değil!");
    try {
        await updateDoc(doc(db, "stoklar", seciliUrunId), {
            urunAd: document.getElementById('modalUrunAd').value,
            barkod: document.getElementById('modalBarkod').value,
            kalan: Number(document.getElementById('modalMiktar').value),
            kritik: Number(document.getElementById('modalKritik').value),
            grup: document.getElementById('modalGrup').value
        });
        alert("Güncellendi!");
        kapatModal();
    } catch(e) { alert(e.message); }
};

window.urunSil = async (id) => {
    if(confirm("Ürün silinsin mi?")) {
        await deleteDoc(doc(db, "stoklar", id));
    }
};

// --- SEKMELER ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const tabId = this.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        this.classList.add('active');
    });
});

window.grupToggle = function(id) {
    document.querySelectorAll(`.${id}`).forEach(r => {
        r.style.display = r.style.display === 'none' ? 'table-row' : 'none';
    });
};

window.detayGoster = async function(id) {
    seciliUrunId = id;
    const u = stoklar[id];
    if(!u) return alert("Ürün bulunamadı!");
    
    document.getElementById('modalUrunAd').value = getUrunAdi(u);
    document.getElementById('modalMiktar').value = u.kalan || 0;
    document.getElementById('modalBarkod').value = u.barkod || "";
    document.getElementById('modalKritik').value = u.kritik || 5;
    document.getElementById('modalGrup').value = u.grup || "Genel";
    document.getElementById('detayModal').style.display = 'block';
    
    const detayDiv = document.getElementById('detayIcerik');
    if(detayDiv) {
        try {
            const q = query(collection(db, "hareketler"), where("urunId", "==", id), orderBy("tarih", "desc"), limit(10));
            const snap = await getDocs(q);
            detayDiv.innerHTML = snap.empty ? "<i>Hareket yok</i>" :
                snap.docs.map(d => `<div>${d.data().tarih?.toDate().toLocaleString()} - ${d.data().tur === 'giris' ? '➕' : '➖'} ${d.data().miktar}</div>`).join('');
        } catch(e) { detayDiv.innerHTML = "<i>Hata</i>"; }
    }
};

window.kapatModal = () => {
    document.getElementById('detayModal').style.display = 'none';
};

// ========== SEPET İŞLEMLERİ ==========
window.sepeteEkle = () => {
    const id = document.getElementById('urunSelect').value;
    const miktar = Number(document.getElementById('islemMiktar').value);
    if (!id) return alert("Ürün seçin!");
    if (!miktar || miktar <= 0) return alert("Geçerli miktar girin!");
    const urun = stoklar[id];
    if (!urun) return alert("Ürün bulunamadı!");
    
    sepet.push({ id: id, ad: getUrunAdi(urun), miktar: miktar });
    sepetiGoster();
    document.getElementById('islemMiktar').value = "";
};

function sepetiGoster() {
    const liste = document.getElementById("sepetListesi");
    const butonlar = document.getElementById("sepetButonlar");
    if (!liste) return;
    
    if(sepet.length === 0) {
        liste.innerHTML = '<div style="color:#999; text-align:center;">Sepet boş</div>';
        if(butonlar) butonlar.style.display = 'none';
    } else {
        liste.innerHTML = sepet.map((u, i) => `
            <div style="padding:8px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
                <span><strong>${u.ad}</strong> x${u.miktar}</span>
                <button onclick="sepettenSil(${i})" style="background:#e74c3c; color:white; border:none; border-radius:5px; padding:5px 10px;">Sil</button>
            </div>
        `).join('');
        if(butonlar) butonlar.style.display = 'flex';
    }
}

window.sepettenSil = (index) => { sepet.splice(index, 1); sepetiGoster(); };

window.topluIslem = async (tip) => {
    if (sepet.length === 0) return alert("Sepet boş!");
    try {
        const batch = writeBatch(db);
        for (let item of sepet) {
            const mevcut = stoklar[item.id]?.kalan || 0;
            const yeni = tip === 'giris' ? mevcut + item.miktar : mevcut - item.miktar;
            if (tip === 'cikis' && mevcut < item.miktar) throw new Error(`${item.ad} için stok yetersiz!`);
            batch.update(doc(db, "stoklar", item.id), { kalan: yeni });
            batch.set(doc(collection(db, "hareketler")), {
                urunId: item.id, urun: item.ad, tur: tip, miktar: item.miktar, tarih: Timestamp.now()
            });
        }
        await batch.commit();
        alert("Toplu işlem başarılı!");
        sepet = [];
        sepetiGoster();
    } catch(e) { alert(e.message); }
};

// ========== KAMERA FONKSİYONLARI ==========
let kameraAktif = false;

// Eski fonksiyon isimlerini de destekle
window.anaKameraBaslat = function() {
    kameraBaslat();
};

window.anaKameraDurdur = function() {
    kameraDurdur();
};

window.yeniUrunKameraBaslat = function() {
    yeniUrunKamera();
};

window.yeniUrunKameraDurdur = function() {
    kameraDurdur();
};

function kameraBaslat() {
    const readerDiv = document.getElementById("reader");
    const kameraAcBtn = document.getElementById("kameraAcBtn");
    const kameraKapatBtn = document.getElementById("kameraKapatBtn");
    
    if (kameraAktif) {
        alert("Kamera zaten açık!");
        return;
    }
    
    if (!readerDiv) {
        alert("Kamera alanı bulunamadı!");
        return;
    }
    
    readerDiv.style.display = "block";
    
    if (html5QrCode) {
        html5QrCode.stop().catch(()=>{});
        html5QrCode = null;
    }
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            const select = document.getElementById('urunSelect');
            let bulundu = false;
            
            for(let i = 0; i < select.options.length; i++) {
                const opt = select.options[i];
                if(opt.textContent === decodedText) {
                    select.value = opt.value;
                    alert("✅ Ürün bulundu: " + opt.textContent);
                    bulundu = true;
                    break;
                }
            }
            
            if(!bulundu) {
                for(let i = 0; i < select.options.length; i++) {
                    const opt = select.options[i];
                    const urun = stoklar[opt.value];
                    if(urun && urun.barkod === decodedText) {
                        select.value = opt.value;
                        alert("✅ Barkod eşleşti: " + opt.textContent);
                        bulundu = true;
                        break;
                    }
                }
            }
            
            if(!bulundu) {
                alert("⚠️ Ürün bulunamadı: " + decodedText);
            }
        }, 
        (err) => { console.log("QR okuma:", err); }
    ).then(() => {
        kameraAktif = true;
        // Butonları doğru şekilde göster/gizle
        if(kameraAcBtn) kameraAcBtn.style.display = "block";
        if(kameraKapatBtn) {
            kameraKapatBtn.style.display = "block";
            kameraKapatBtn.style.setProperty('display', 'block', 'important');
        }
    }).catch(err => {
        console.error("Kamera hatası:", err);
        alert("Kamera başlatılamadı. Lütfen izin verin.");
        readerDiv.style.display = "none";
        if(kameraAcBtn) kameraAcBtn.style.display = "block";
        if(kameraKapatBtn) {
            kameraKapatBtn.style.display = "none";
            kameraKapatBtn.style.setProperty('display', 'none', 'important');
        }
    });
}

function kameraDurdur() {
    const readerDiv = document.getElementById("reader");
    const kameraAcBtn = document.getElementById("kameraAcBtn");
    const kameraKapatBtn = document.getElementById("kameraKapatBtn");
    
    if(html5QrCode) {
        html5QrCode.stop().catch(()=>{});
        html5QrCode = null;
    }
    if(readerDiv) readerDiv.style.display = "none";
    kameraAktif = false;
    
    // Butonları doğru şekilde göster/gizle
    if(kameraAcBtn) kameraAcBtn.style.display = "block";
    if(kameraKapatBtn) {
        kameraKapatBtn.style.display = "none";
        kameraKapatBtn.style.setProperty('display', 'none', 'important');
    }
}

function yeniUrunKamera() {
    const readerDiv = document.getElementById("reader");
    const kameraAcBtn = document.getElementById("kameraAcBtn");
    const kameraKapatBtn = document.getElementById("kameraKapatBtn");
    
    if (!readerDiv) {
        alert("Kamera alanı bulunamadı!");
        return;
    }
    
    readerDiv.style.display = "block";
    
    if (html5QrCode) {
        html5QrCode.stop().catch(()=>{});
        html5QrCode = null;
    }
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            document.getElementById('urunBarkod').value = decodedText;
            alert("✅ Barkod okundu: " + decodedText);
            kameraDurdur();
        }, 
        (err) => {}
    ).then(() => {
        if(kameraAcBtn) kameraAcBtn.style.display = "block";
        if(kameraKapatBtn) {
            kameraKapatBtn.style.display = "block";
            kameraKapatBtn.style.setProperty('display', 'block', 'important');
        }
    }).catch(err => {
        console.error("Kamera hatası:", err);
        alert("Kamera başlatılamadı.");
        readerDiv.style.display = "none";
        if(kameraKapatBtn) {
            kameraKapatBtn.style.display = "none";
            kameraKapatBtn.style.setProperty('display', 'none', 'important');
        }
    });
}

// Buton olaylarını bağla (sayfa yüklendiğinde)
function kameraButonlariniBagla() {
    const kameraAcBtn = document.getElementById("kameraAcBtn");
    const kameraKapatBtn = document.getElementById("kameraKapatBtn");
    const yeniUrunKameraBtn = document.getElementById("yeniUrunKameraBtn");
    
    // Önce eski olayları temizle
    if(kameraAcBtn) {
        const yeniButon = kameraAcBtn.cloneNode(true);
        kameraAcBtn.parentNode.replaceChild(yeniButon, kameraAcBtn);
        yeniButon.addEventListener("click", kameraBaslat);
    }
    
    if(kameraKapatBtn) {
        const yeniButon = kameraKapatBtn.cloneNode(true);
        kameraKapatBtn.parentNode.replaceChild(yeniButon, kameraKapatBtn);
        yeniButon.addEventListener("click", kameraDurdur);
        yeniButon.style.display = "none";
        yeniButon.style.setProperty('display', 'none', 'important');
    }
    
    if(yeniUrunKameraBtn) {
        const yeniButon = yeniUrunKameraBtn.cloneNode(true);
        yeniUrunKameraBtn.parentNode.replaceChild(yeniButon, yeniUrunKameraBtn);
        yeniButon.addEventListener("click", yeniUrunKamera);
    }
}

// Sayfa yüklendiğinde butonları bağla
document.addEventListener("DOMContentLoaded", () => {
    kameraButonlariniBagla();
    verileriGetir();
});

// NOT: Yukarıdaki DOMContentLoaded event'ini kaldırın, yerine yukarıdaki kullanıldı
// ========== RAPORLAMA ==========
window.raporOlustur = async () => {
    const baslangic = document.getElementById('raporBaslangic').value;
    const bitis = document.getElementById('raporBitis').value;
    if (!baslangic || !bitis) return alert("Tarih seçin!");
    
    const start = new Date(baslangic); start.setHours(0,0,0,0);
    const end = new Date(bitis); end.setHours(23,59,59,999);
    const filtre = document.getElementById('raporFiltre').value;
    
    try {
        const q = query(collection(db, "hareketler"), 
            where("tarih", ">=", Timestamp.fromDate(start)),
            where("tarih", "<=", Timestamp.fromDate(end)));
        const snap = await getDocs(q);
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
        if(Object.keys(data).length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">Veri yok</td></tr>';
        } else {
            Object.entries(data).sort().forEach(([urun, val]) => {
                tbody.innerHTML += `<tr><td>${urun}</td><td style="text-align:center">${val.giris}</td><td style="text-align:center">${val.cikis}</td></tr>`;
            });
        }
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
    w.document.write(`
        <html><head><meta charset="UTF-8"><title>Stok Raporu</title>
        <style>body{font-family:Segoe UI,sans-serif;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#3498db;color:white}</style>
        </head><body><h1>Stok Raporu</h1><p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>${tablo.outerHTML}</body></html>
    `);
    w.document.close();
    w.print();
};

// --- SİPARİŞ ---
window.siparisPDF = () => {
    const kritikler = Object.values(stoklar).filter(u => (parseInt(u.kalan) || 0) <= (parseInt(u.kritik) || 5));
    if(kritikler.length === 0) return alert("Kritik ürün yok!");
    
    let rows = "";
    kritikler.forEach(u => {
        rows += `<tr><td>${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0, u.kritik * 2 - u.kalan)}</td></tr>`;
    });
    
    const w = window.open('', '_blank');
    w.document.write(`
        <html><head><meta charset="UTF-8"><title>Sipariş Listesi</title>
        <style>body{font-family:Segoe UI,sans-serif;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#e74c3c;color:white}</style>
        </head><body><h1>Sipariş Listesi</h1><p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
        <table><thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead><tbody>${rows}</tbody></table></body></html>
    `);
    w.document.close();
    w.print();
};

window.siparisYazdir = () => {
    const kritikler = Object.values(stoklar).filter(u => (parseInt(u.kalan) || 0) <= (parseInt(u.kritik) || 5));
    if(kritikler.length === 0) return alert("Kritik ürün yok!");
    
    let rows = "";
    kritikler.forEach(u => {
        rows += `<tr><td>${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0, u.kritik * 2 - u.kalan)}</td></tr>`;
    });
    
    const w = window.open('', '_blank');
    w.document.write(`
        <html><head><meta charset="UTF-8"><title>Sipariş Listesi</title>
        <style>body{font-family:Segoe UI,sans-serif;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#e74c3c;color:white}</style>
        </head><body><h1>Sipariş Listesi</h1><p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
        <table><thead><tr><th>Ürün</th><th>Stok</th><th>Kritik</th><th>Önerilen</th></tr></thead><tbody>${rows}</tbody></table>
        <script>window.print();<\/script></body></html>
    `);
    w.document.close();
};

// --- FİLTRE ---
window.tabloFiltrele = () => {
    const filtre = document.getElementById('aramaKutusu')?.value.toLowerCase() || "";
    document.querySelectorAll('#tablo tr').forEach(row => {
        if(row.classList.length === 0 || row.classList[0]?.startsWith('grup-')) row.style.display = '';
        else row.style.display = row.innerText.toLowerCase().includes(filtre) ? '' : 'none';
    });
};

// --- PWA ---
if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.log);
}

// --- BAŞLAT ---
window.addEventListener("DOMContentLoaded", () => {
    verileriGetir();
});