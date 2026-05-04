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
    const siparisPanel = document.getElementById('siparisPanel');
    const kritikListe = document.getElementById('kritikListe');
    const siparisListesi = document.getElementById('siparisListesi');
    
    if (kritikUrunler.length > 0) {
        if (kritikPanel) kritikPanel.style.display = 'block';
        if (siparisPanel) siparisPanel.style.display = 'block';
        if (kritikListe) {
            kritikListe.innerHTML = kritikUrunler.map(u => `<li>${getUrunAdi(u)}: Stok ${u.kalan} / Kritik ${u.kritik}</li>`).join('');
        }
        if (siparisListesi) {
            siparisListesi.innerHTML = kritikUrunler.map(u => `<li>📦 ${getUrunAdi(u)} (Stok: ${u.kalan})</li>`).join('');
        }
    } else {
        if (kritikPanel) kritikPanel.style.display = 'none';
        if (siparisPanel) siparisPanel.style.display = 'none';
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
                    <td style="font-size:12px;">${tarih}</td>
                    <td>${h.urun || "-"}</td>
                    <td>${h.miktar}</td>
                    <td style="color:${h.tur === 'giris' ? 'green' : 'red'}">${h.tur === 'giris' ? 'GİRİŞ' : 'ÇIKIŞ'}</td>
                    <td><button onclick="hareketSil('${d.id}')" style="background:none; color:red; font-size:16px; cursor:pointer;">🗑️</button></td>
                </tr>
            `;
        });
    } catch(e) { console.error("Hareket listeleme hatası:", e); }
}

window.hareketSil = async (id) => {
    if(confirm("Bu hareketi silmek istediğinize emin misiniz?")) {
        try {
            await deleteDoc(doc(db, "hareketler", id));
            hareketleriListele();
            alert("Hareket silindi!");
        } catch(e) { alert("Silme hatası: " + e.message); }
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
    if (tip === 'cikis' && yeni < 0) return alert("Yetersiz stok! Mevcut: " + mevcut);
    
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
        alert("Ürün güncellendi!");
        kapatModal();
    } catch(e) { alert("Güncelleme hatası: " + e.message); }
};

window.urunSil = async (id) => {
    if(confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
        await deleteDoc(doc(db, "stoklar", id));
        alert("Ürün silindi!");
    }
};

// --- SEKMELER ---
window.sekmeAc = function(evt, name) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const aktifSekme = document.getElementById(name);
    if(aktifSekme) aktifSekme.classList.add('active');
    evt.currentTarget.classList.add('active');
};

window.grupToggle = function(id) {
    document.querySelectorAll(`.${id}`).forEach(r => {
        r.style.display = r.style.display === 'none' ? 'table-row' : 'none';
    });
};

window.detayGoster = async function(id) {
    seciliUrunId = id;
    const u = stoklar[id];
    if(!u) return alert("Ürün bulunamadı!");
    
    const modalUrunAd = document.getElementById('modalUrunAd');
    const modalMiktar = document.getElementById('modalMiktar');
    const modalBarkod = document.getElementById('modalBarkod');
    const modalKritik = document.getElementById('modalKritik');
    const modalGrup = document.getElementById('modalGrup');
    
    if(modalUrunAd) modalUrunAd.value = getUrunAdi(u);
    if(modalMiktar) modalMiktar.value = u.kalan || 0;
    if(modalBarkod) modalBarkod.value = u.barkod || "";
    if(modalKritik) modalKritik.value = u.kritik || 5;
    if(modalGrup) modalGrup.value = u.grup || "Genel";
    
    const detayModal = document.getElementById('detayModal');
    if(detayModal) detayModal.style.display = 'block';
    
    const detayDiv = document.getElementById('detayIcerik');
    if(detayDiv) {
        try {
            const q = query(collection(db, "hareketler"), where("urunId", "==", id), orderBy("tarih", "desc"), limit(10));
            const snap = await getDocs(q);
            detayDiv.innerHTML = snap.empty ? "<i>Bu ürüne ait hareket yok</i>" :
                snap.docs.map(d => `<div style="padding:5px; border-bottom:1px solid #eee;">${d.data().tarih?.toDate().toLocaleString()} - ${d.data().tur === 'giris' ? '➕' : '➖'} ${d.data().miktar}</div>`).join('');
        } catch(e) { detayDiv.innerHTML = "<i>Hareketler yüklenemedi</i>"; }
    }
};

window.kapatModal = () => {
    const detayModal = document.getElementById('detayModal');
    if(detayModal) detayModal.style.display = 'none';
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
    alert("✅ Sepete eklendi: " + getUrunAdi(urun) + " x" + miktar);
};

function sepetiGoster() {
    const liste = document.getElementById("sepetListesi");
    const butonlar = document.getElementById("sepetButonlar");
    if (!liste) return;
    
    if(sepet.length === 0) {
        liste.innerHTML = '<div style="color:#999; text-align:center; padding:10px;">📭 Sepet boş</div>';
        if(butonlar) butonlar.style.display = 'none';
    } else {
        liste.innerHTML = sepet.map((u, i) => `
            <div style="padding:8px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <span><strong>${u.ad}</strong> x${u.miktar}</span>
                <button onclick="sepettenSil(${i})" style="background:#e74c3c; color:white; border:none; border-radius:5px; padding:5px 10px; cursor:pointer;">🗑️ Sil</button>
            </div>
        `).join('');
        if(butonlar) butonlar.style.display = 'flex';
    }
}

window.sepettenSil = (index) => { 
    sepet.splice(index, 1); 
    sepetiGoster(); 
};

window.topluIslem = async (tip) => {
    if (sepet.length === 0) return alert("Sepet boş!");
    
    try {
        const batch = writeBatch(db);
        for (let item of sepet) {
            const mevcut = stoklar[item.id]?.kalan || 0;
            const yeni = tip === 'giris' ? mevcut + item.miktar : mevcut - item.miktar;
            if (tip === 'cikis' && mevcut < item.miktar) {
                throw new Error(`${item.ad} için stok yetersiz! Mevcut: ${mevcut}, İstenen: ${item.miktar}`);
            }
            batch.update(doc(db, "stoklar", item.id), { kalan: yeni });
            batch.set(doc(collection(db, "hareketler")), {
                urunId: item.id, urun: item.ad, tur: tip, miktar: item.miktar, tarih: Timestamp.now()
            });
        }
        await batch.commit();
        alert("Toplu işlem başarılı!");
        sepet = [];
        sepetiGoster();
    } catch(e) { 
        alert("Hata: " + e.message);
    }
};

// ========== RAPORLAMA ==========
window.raporOlustur = async () => {
    const baslangic = document.getElementById('raporBaslangic').value;
    const bitis = document.getElementById('raporBitis').value;
    if (!baslangic || !bitis) return alert("Lütfen başlangıç ve bitiş tarihi seçin!");
    
    const start = new Date(baslangic);
    start.setHours(0,0,0,0);
    const end = new Date(bitis);
    end.setHours(23,59,59,999);
    const filtre = document.getElementById('raporFiltre').value;
    
    try {
        const q = query(collection(db, "hareketler"), 
            where("tarih", ">=", Timestamp.fromDate(start)),
            where("tarih", "<=", Timestamp.fromDate(end)));
        const snap = await getDocs(q);
        const raporData = {};
        
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (filtre !== "hepsi" && data.tur !== filtre) return;
            if (!raporData[data.urun]) raporData[data.urun] = { giris: 0, cikis: 0 };
            if (data.tur === 'giris') raporData[data.urun].giris += data.miktar;
            else raporData[data.urun].cikis += data.miktar;
        });
        
        const tbody = document.getElementById('raporTabloGovde');
        if(!tbody) return;
        tbody.innerHTML = "";
        
        if(Object.keys(raporData).length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Bu tarih aralığında veri bulunamadı</td></tr>';
        } else {
            Object.entries(raporData).sort().forEach(([urun, val]) => {
                tbody.innerHTML += `<tr><td style="text-align:left;">${urun}</td><td style="text-align:center;">${val.giris}</td><td style="text-align:center;">${val.cikis}</td></tr>`;
            });
        }
        document.getElementById('raporSonuc').style.display = 'block';
    } catch(e) { 
        alert("Rapor oluşturulurken hata: " + e.message);
    }
};

window.excelIndir = () => {
    const table = document.getElementById('raporTablo');
    if(!table) return;
    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `stok_raporu_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.pdfIndir = () => {
    const table = document.getElementById('raporTablo');
    if (!table) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Stok Raporu</title>
            <meta charset="UTF-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: white; }
                h1 { color: #2c3e50; text-align: center; margin-bottom: 10px; }
                .date { text-align: center; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #3498db; color: white; text-align: center; }
                td { text-align: center; }
                td:first-child { text-align: left; }
                .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
            </style>
        </head>
        <body>
            <h1>📊 Stok Raporu</h1>
            <div class="date">Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}</div>
            ${table.outerHTML}
            <div class="footer">Stok Takip Sistemi</div>
            <script>
                window.print();
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// --- KAMERA FONKSİYONLARI ---
window.kameraBaslat = () => {
    const readerDiv = document.getElementById("reader");
    if (!readerDiv) return;
    
    if (html5QrCode) {
        html5QrCode.stop().catch(()=>{});
        html5QrCode = null;
    }
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 }, 
        (decodedText) => {
            const select = document.getElementById('urunSelect');
            for(let i=0; i<select.options.length; i++) {
                const opt = select.options[i];
                if(opt.textContent === decodedText || opt.value === decodedText) {
                    select.value = opt.value;
                    alert("Ürün bulundu: " + opt.textContent);
                    break;
                }
            }
            kameraDurdur();
        }, 
        (err) => { console.log("QR okuma hatası:", err); }
    ).catch(err => alert("Kamera başlatılamadı: " + err));
};

window.kameraDurdur = () => {
    if(html5QrCode) { 
        html5QrCode.stop().catch(()=>{}); 
        html5QrCode = null;
    }
};

window.yeniUrunKamera = () => {
    if (html5QrCode) {
        html5QrCode.stop().catch(()=>{});
        html5QrCode = null;
    }
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 }, 
        (decodedText) => {
            document.getElementById('urunBarkod').value = decodedText;
            alert("Barkod okundu: " + decodedText);
            kameraDurdur();
        }, 
        (err) => {}
    ).catch(err => alert("Kamera başlatılamadı: " + err));
};

// --- SİPARİŞ LİSTESİ ---
window.siparisPDF = () => {
    const kritikUrunler = Object.values(stoklar).filter(u => (parseInt(u.kalan) || 0) <= (parseInt(u.kritik) || 5));
    if(kritikUrunler.length === 0) return alert("Kritik seviyede ürün bulunmuyor!");
    
    const printWindow = window.open('', '_blank');
    let tableRows = "";
    kritikUrunler.forEach(u => {
        tableRows += `
            <tr>
                <td>${getUrunAdi(u)}</td>
                <td style="text-align:center">${u.kalan}</td>
                <td style="text-align:center">${u.kritik}</td>
                <td style="text-align:center">${Math.max(0, (parseInt(u.kritik) * 2) - parseInt(u.kalan))}</td>
            </tr>
        `;
    });
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sipariş Listesi</title>
            <meta charset="UTF-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: white; }
                h1 { color: #e74c3c; text-align: center; margin-bottom: 10px; }
                .date { text-align: center; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #e74c3c; color: white; }
                .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
            </style>
        </head>
        <body>
            <h1>📋 Sipariş Listesi</h1>
            <div class="date">Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}</div>
            <table>
                <thead>
                    <tr>
                        <th>Ürün Adı</th>
                        <th>Mevcut Stok</th>
                        <th>Kritik Seviye</th>
                        <th>Önerilen Sipariş</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
            <div class="footer">Stok Takip Sistemi</div>
            <script>window.print();<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

window.siparisYazdir = () => {
    const kritikUrunler = Object.values(stoklar).filter(u => (parseInt(u.kalan) || 0) <= (parseInt(u.kritik) || 5));
    if(kritikUrunler.length === 0) return alert("Kritik seviyede ürün bulunmuyor!");
    
    const printWindow = window.open('', '_blank');
    let tableRows = "";
    kritikUrunler.forEach(u => {
        tableRows += `<tr><td>${getUrunAdi(u)}</td><td style="text-align:center">${u.kalan}</td><td style="text-align:center">${u.kritik}</td><td style="text-align:center">${Math.max(0, (parseInt(u.kritik) * 2) - parseInt(u.kalan))}</td></tr>`;
    });
    
    printWindow.document.write(`
        <html>
        <head><title>Sipariş Listesi</title><meta charset="UTF-8">
        <style>body{font-family:'Segoe UI',sans-serif;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:10px} th{background:#e74c3c;color:white}</style>
        </head>
        <body>
            <h1>📋 Sipariş Listesi</h1>
            <p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
            <table><thead><tr><th>Ürün Adı</th><th>Mevcut Stok</th><th>Kritik Seviye</th><th>Önerilen Sipariş</th></tr></thead><tbody>${tableRows}</tbody></table>
            <script>window.print();<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// --- FİLTRELEME ---
window.tabloFiltrele = () => {
    const filtre = document.getElementById('aramaKutusu')?.value.toLowerCase() || "";
    const rows = document.querySelectorAll('#tablo tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if(row.classList.length === 0 || (row.classList[0] && row.classList[0].startsWith('grup-'))) {
            row.style.display = '';
        } else {
            row.style.display = text.includes(filtre) ? '' : 'none';
        }
    });
};

// --- PWA KURULUMU ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log("Service Worker kaydedildi", reg))
        .catch(err => console.log("Service Worker hatası", err));
}

// --- SAYFA YÜKLENİNCE ---
window.addEventListener("DOMContentLoaded", () => {
    verileriGetir();
});