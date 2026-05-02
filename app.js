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

// --- YARDIMCI FONKSİYONLAR ---
function getUrunAdi(urun) {
    if (!urun) return "Bilinmeyen";
    return urun.urunAd || urun.ad || urun.isim || urun.name || urun.productName || urun.id || "Bilinmeyen Ürün";
}

function karakterTemizle(metin) {
    if (!metin) return "";
    const harfHaritasi = { 'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ş':'s','Ş':'S','ü':'u','Ü':'U','ö':'o','Ö':'O','ı':'i','İ':'I' };
    return metin.replace(/[çÇğĞşŞüÜöÖıİ]/g, (harf) => harfHaritasi[harf]);
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
    const tabloGovde = document.getElementById('tablo');
    if (!tabloGovde) return;

    let tabloHTML = "";
    let toplamAdet = 0;
    let kritikSayisi = 0;

    let gruplar = {};
    Object.values(stoklar).forEach(u => {
        const g = u.grup || "Genel";
        if (!gruplar[g]) gruplar[g] = [];
        gruplar[g].push(u);
    });

    Object.keys(gruplar).sort().forEach((grupAd, idx) => {
        const grupId = `grup-${idx}`;
        tabloHTML += `
            <tr onclick="grupToggle('${grupId}')" style="cursor:pointer; background:#f1c40f;">
                <td colspan="3" style="font-weight:bold; padding:10px;">📂 ${grupAd}</td>
              </td>`;
        
        gruplar[grupAd].forEach(u => {
            const miktar = parseInt(u.kalan) || 0;
            const kritik = parseInt(u.kritik) || 5;
            toplamAdet += miktar;
            if(miktar <= kritik) kritikSayisi++;
            const urunAdi = getUrunAdi(u);

            tabloHTML += `
                <tr class="${grupId}" onclick="detayGoster('${u.id}')" style="display:none; cursor:pointer;">
                    <td style="padding-left:20px;">${urunAdi}</td>
                    <td style="font-weight:bold; color:${miktar <= kritik ? 'red' : 'inherit'}">${miktar}</td>
                    <td style="text-align:center;"><button onclick="event.stopPropagation(); urunSil('${u.id}')">✖</button></td>
                  </tr>`;
        });
    });

    tabloGovde.innerHTML = tabloHTML;
    document.getElementById('dashToplam').innerText = toplamAdet;
    document.getElementById('dashKritik').innerText = kritikSayisi;
}

function kritikKontrol() {
    const kritikUrunler = Object.values(stoklar).filter(u => (parseInt(u.kalan) || 0) <= (parseInt(u.kritik) || 5));
    const kritikPanel = document.getElementById('kritikPanel');
    const kritikListe = document.getElementById('kritikListe');
    const otoSiparisPanel = document.getElementById('otoSiparisPanel');
    const otoSiparisListesi = document.getElementById('otoSiparisListesi');
    
    if (kritikUrunler.length > 0) {
        if (kritikPanel) kritikPanel.style.display = 'block';
        if (kritikListe) {
            kritikListe.innerHTML = kritikUrunler.map(u => `<li><strong>${getUrunAdi(u)}</strong>: Stok ${u.kalan} / Kritik ${u.kritik}</li>`).join('');
        }
        if (otoSiparisPanel) otoSiparisPanel.style.display = 'block';
        if (otoSiparisListesi) {
            otoSiparisListesi.innerHTML = kritikUrunler.map(u => `<li>📦 ${getUrunAdi(u)} (Stok: ${u.kalan}, Kritik: ${u.kritik})</li>`).join('');
        }
    } else {
        if (kritikPanel) kritikPanel.style.display = 'none';
        if (otoSiparisPanel) otoSiparisPanel.style.display = 'none';
    }
}

async function popularesiGetir() {
    try {
        const q = query(collection(db, "hareketler"), where("tur", "==", "cikis"));
        const snap = await getDocs(q);
        const urunSayilari = {};
        
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const urunAd = data.urun || "Bilinmeyen";
            urunSayilari[urunAd] = (urunSayilari[urunAd] || 0) + (data.miktar || 1);
        });
        
        let populerAd = "-";
        let populerAdet = 0;
        
        Object.entries(urunSayilari).forEach(([ad, adet]) => {
            if(adet > populerAdet) {
                populerAdet = adet;
                populerAd = ad;
            }
        });
        
        const dashPopuler = document.getElementById('dashPopuler');
        if(dashPopuler) {
            dashPopuler.innerText = populerAd !== "-" ? `${populerAd} (${populerAdet})` : "-";
        }
    } catch(e) { 
        console.error("Popüler ürün hatası:", e);
        const dashPopuler = document.getElementById('dashPopuler');
        if(dashPopuler) dashPopuler.innerText = "-";
    }
}

async function hareketleriListele() {
    const tbody = document.getElementById('hareketlerTablo');
    if (!tbody) return;
    
    try {
        const q = query(collection(db, "hareketler"), orderBy("tarih", "desc"), limit(50));
        const snap = await getDocs(q);
        tbody.innerHTML = "";
        snap.forEach(docSnap => {
            const h = docSnap.data();
            const tarih = h.tarih?.toDate().toLocaleString('tr-TR') || "-";
            tbody.innerHTML += `
                <table>
                    <td style="font-size:12px;">${tarih}</td>
                    <td>${h.urun || "-"}</td>
                    <td>${h.miktar}</td>
                    <td style="color:${h.tur === 'giris' ? 'green' : 'red'}">${h.tur === 'giris' ? 'GİRİŞ' : 'ÇIKIŞ'}</td>
                    <td><button onclick="hareketSil('${docSnap.id}')" style="background:none; color:red; font-size:16px; cursor:pointer;">🗑️</button></td>
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
    baslangic.setHours(0, 0, 0, 0);
    const baslangicTimestamp = Timestamp.fromDate(baslangic);
    
    try {
        const q = query(collection(db, "hareketler"), where("tarih", ">=", baslangicTimestamp));
        const querySnapshot = await getDocs(q);
        let bugunToplam = 0;
        querySnapshot.forEach((doc) => {
            if(doc.data().tur === 'giris') bugunToplam += doc.data().miktar;
        });
        if(document.getElementById('dashGiris')) document.getElementById('dashGiris').innerText = bugunToplam;
    } catch(e) { console.error("Bugün özeti hatası:", e); }
}

// --- İŞLEMLER ---
async function urunEkle() {
    const ad = document.getElementById('urunAdi').value.trim();
    const barkod = document.getElementById('urunBarkod').value.trim();
    if (!ad) return alert("Ürün adı şart!");

    try {
        const yeniRef = doc(collection(db, "stoklar"));
        await setDoc(yeniRef, {
            urunAd: ad,
            barkod: barkod,
            kalan: 0,
            kritik: 5,
            grup: "Genel"
        });
        alert("Ürün eklendi!");
        document.getElementById('urunAdi').value = "";
        document.getElementById('urunBarkod').value = "";
    } catch (e) { alert(e.message); }
}

async function stokIslem(tip) {
    const id = document.getElementById('urunSelect').value;
    const miktar = Number(document.getElementById('islemMiktar').value);
    if (!miktar || miktar <= 0) return alert("Geçerli miktar gir!");
    if (!id) return alert("Ürün seçin!");
    if (!stoklar[id]) return alert("Ürün bulunamadı!");
    
    const mevcut = stoklar[id].kalan || 0;
    const yeni = tip === 'giris' ? mevcut + miktar : mevcut - miktar;
    
    if (tip === 'cikis' && yeni < 0) return alert("Yetersiz stok! Mevcut: " + mevcut);

    try {
        const batch = writeBatch(db);
        batch.update(doc(db, "stoklar", id), { kalan: yeni });
        batch.set(doc(collection(db, "hareketler")), {
            urunId: id,
            urun: getUrunAdi(stoklar[id]),
            tur: tip,
            miktar: miktar,
            tarih: Timestamp.now()
        });
        await batch.commit();
        alert("İşlem başarılı!");
        document.getElementById('islemMiktar').value = "";
    } catch (e) { alert(e.message); }
}

window.urunGuncelle = async () => {
    if (!seciliUrunId) return alert("Ürün seçili değil!");
    const yeniAd = document.getElementById('modalUrunAd').value;
    const yeniBarkod = document.getElementById('modalBarkod').value;
    const yeniMiktar = Number(document.getElementById('modalMiktar').value);
    const yeniKritik = Number(document.getElementById('modalKritik').value);
    const yeniGrup = document.getElementById('modalGrup').value;
    
    if (!yeniAd) return alert("Ürün adı boş olamaz!");
    if (isNaN(yeniMiktar) || isNaN(yeniKritik)) return alert("Geçerli sayı girin!");
    
    try {
        await updateDoc(doc(db, "stoklar", seciliUrunId), {
            urunAd: yeniAd,
            barkod: yeniBarkod,
            kalan: yeniMiktar,
            kritik: yeniKritik,
            grup: yeniGrup
        });
        alert("Ürün güncellendi!");
        document.getElementById('detayModal').style.display = 'none';
    } catch(e) { alert("Güncelleme hatası: " + e.message); }
};

// --- GLOBAL ATAMALAR ---
window.sekmeAc = function(evt, name) {
    document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(name).style.display = "block";
    evt.currentTarget.classList.add("active");
};

window.grupToggle = function(id) {
    const rows = document.getElementsByClassName(id);
    for (let r of rows) r.style.display = r.style.display === "none" ? "table-row" : "none";
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
    
    const detayIcerik = document.getElementById('detayIcerik');
    if(detayIcerik) {
        try {
            const q = query(collection(db, "hareketler"), where("urunId", "==", id), orderBy("tarih", "desc"), limit(10));
            const snap = await getDocs(q);
            if(snap.empty) {
                detayIcerik.innerHTML = "<i>Bu ürüne ait hareket yok</i>";
            } else {
                detayIcerik.innerHTML = snap.docs.map(d => {
                    const data = d.data();
                    return `<div style="padding:5px; border-bottom:1px solid #eee;">${data.tarih?.toDate().toLocaleString()} - ${data.tur === 'giris' ? '➕' : '➖'} ${data.miktar}</div>`;
                }).join('');
            }
        } catch(e) { detayIcerik.innerHTML = "<i>Hareketler yüklenemedi</i>"; }
    }
};

window.urunEkle = urunEkle;
window.stokIslem = stokIslem;
window.urunSil = async (id) => { 
    if(confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
        await deleteDoc(doc(db, "stoklar", id));
        alert("Ürün silindi!");
    }
};

// ========== SEPET İŞLEMLERİ ==========
window.sepeteEkle = () => {
    const id = document.getElementById('urunSelect').value;
    const miktar = Number(document.getElementById('islemMiktar').value);
    
    if (!id) return alert("Ürün seçin!");
    if (!miktar || miktar <= 0) return alert("Geçerli miktar girin!");
    
    const urun = stoklar[id];
    if (!urun) return alert("Ürün bulunamadı!");
    
    const urunAdi = getUrunAdi(urun);
    
    sepet.push({ 
        id: id, 
        ad: urunAdi, 
        miktar: miktar 
    });
    
    sepetiGoster();
    document.getElementById('islemMiktar').value = "";
    alert("✅ Sepete eklendi: " + urunAdi + " x" + miktar);
};

function sepetiGoster() {
    const liste = document.getElementById("sepetListesi");
    const butonlar = document.getElementById("sepetButonlar");
    if (!liste) return;
    
    liste.innerHTML = "";
    if(sepet.length === 0) {
        liste.innerHTML = '<div style="color:#999; text-align:center; padding:10px;">📭 Sepet boş</div>';
    } else {
        sepet.forEach((u, i) => {
            liste.innerHTML += `
                <div style="padding:8px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                    <span><strong>${u.ad || "Ürün"}</strong> x${u.miktar}</span>
                    <button onclick="sepettenSil(${i})" style="background:#e74c3c; color:white; border:none; border-radius:5px; padding:5px 10px; cursor:pointer;">🗑️ Sil</button>
                </div>
            `;
        });
    }
    if (butonlar) butonlar.style.display = sepet.length ? "flex" : "none";
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
                urunId: item.id,
                urun: item.ad,
                tur: tip,
                miktar: item.miktar,
                tarih: Timestamp.now()
            });
        }
        await batch.commit();
        alert("Toplu işlem başarılı!");
        sepet = [];
        sepetiGoster();
    } catch (e) { 
        alert("Hata: " + e.message);
    }
};

// --- RAPORLAMA (TÜRKÇE KARAKTER DESTEKLİ) ---
window.raporOlustur = async () => {
    let baslangic = document.getElementById('raporBaslangic').value;
    let bitis = document.getElementById('raporBitis').value;
    const filtre = document.getElementById('raporFiltre').value;
    
    if (!baslangic || !bitis) return alert("Lütfen başlangıç ve bitiş tarihi seçin!");
    
    let baslangicDate = new Date(baslangic);
    baslangicDate.setHours(0,0,0,0);
    let bitisDate = new Date(bitis);
    bitisDate.setHours(23,59,59,999);
    
    try {
        const q = query(
            collection(db, "hareketler"), 
            where("tarih", ">=", Timestamp.fromDate(baslangicDate)),
            where("tarih", "<=", Timestamp.fromDate(bitisDate))
        );
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
    const table = document.getElementById('printableTable');
    if(!table) return;
    const ws = XLSX.utils.table_to_sheet(table, { raw: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `stok_raporu_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.pdfIndir = () => {
    const table = document.getElementById('printableTable');
    if (!table) return;
    
    // Verileri topla
    const headers = [];
    const thead = table.querySelectorAll('thead th');
    thead.forEach(th => headers.push(th.innerText));
    
    const rows = [];
    const tbodyRows = table.querySelectorAll('tbody tr');
    tbodyRows.forEach(tr => {
        const row = [];
        tr.querySelectorAll('td').forEach(td => row.push(td.innerText));
        if (row.length > 0 && row[0] !== "Bu tarih aralığında veri bulunamadı") {
            rows.push(row);
        }
    });
    
    if (rows.length === 0) {
        alert("Raporlanacak veri bulunamadı!");
        return;
    }
    
    // jsPDF oluştur
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // Türkçe karakterler için font ayarı (unicode destekli)
    doc.setFont("helvetica", "normal");
    
    // Başlık
    doc.setFontSize(16);
    doc.text("Stok Raporu", 14, 15);
    
    // Tarih
    doc.setFontSize(9);
    const today = new Date().toLocaleString('tr-TR');
    doc.text(`Oluşturulma Tarihi: ${today}`, 14, 25);
    
    // Tablo oluştur
    doc.autoTable({
        head: [headers],
        body: rows,
        startY: 32,
        theme: 'striped',
        styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 3,
            halign: 'left',
            valign: 'middle'
        },
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'center', cellWidth: 30 },
            2: { halign: 'center', cellWidth: 30 }
        }
    });
    
    doc.save(`stok_raporu_${new Date().toISOString().slice(0,10)}.pdf`);
};
// --- KAMERA FONKSİYONLARI ---
window.anaKameraBaslat = () => {
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
            anaKameraDurdur();
        }, 
        (err) => { console.log("QR okuma hatası:", err); }
    ).catch(err => alert("Kamera başlatılamadı: " + err));
};

window.anaKameraDurdur = () => {
    if(html5QrCode) { 
        html5QrCode.stop().catch(()=>{}); 
        html5QrCode = null;
    }
};

window.yeniUrunKameraBaslat = () => {
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
            yeniUrunKameraDurdur();
        }, 
        (err) => {}
    ).catch(err => alert("Kamera başlatılamadı: " + err));
};

window.yeniUrunKameraDurdur = () => {
    if(html5QrCode) { 
        html5QrCode.stop().catch(()=>{}); 
        html5QrCode = null;
    }
};

// --- SİPARİŞ LİSTESİ (TÜRKÇE KARAKTER DESTEKLİ) ---
window.siparisListesiPDF = async () => {
    const kritikUrunler = Object.values(stoklar).filter(u => (parseInt(u.kalan) || 0) <= (parseInt(u.kritik) || 5));
    if(kritikUrunler.length === 0) return alert("Kritik seviyede ürün bulunmuyor!");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Başlık
    doc.setFontSize(16);
    doc.text("Sipariş Listesi", 14, 15);
    
    // Tarih
    doc.setFontSize(9);
    doc.text(`Tarih: ${new Date().toLocaleString('tr-TR')}`, 14, 25);
    
    // Tablo verileri
    const headers = ["Ürün Adı", "Mevcut Stok", "Kritik Seviye", "Önerilen Sipariş"];
    const body = kritikUrunler.map(u => [
        getUrunAdi(u),
        u.kalan.toString(),
        u.kritik.toString(),
        Math.max(0, (parseInt(u.kritik) * 2) - parseInt(u.kalan)).toString()
    ]);
    
    doc.autoTable({
        head: [headers],
        body: body,
        startY: 32,
        theme: 'striped',
        styles: {
            fontSize: 10,
            cellPadding: 4,
            halign: 'left'
        },
        headStyles: {
            fillColor: [231, 76, 60],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { halign: 'center', cellWidth: 30 },
            2: { halign: 'center', cellWidth: 30 },
            3: { halign: 'center', cellWidth: 40 }
        }
    });
    
    doc.save(`siparis_listesi_${new Date().toISOString().slice(0,10)}.pdf`);
};
window.siparisListesiYazdir = () => {
    const kritikUrunler = Object.values(stoklar).filter(u => (parseInt(u.kalan) || 0) <= (parseInt(u.kritik) || 5));
    if(kritikUrunler.length === 0) return alert("Kritik seviyede ürün bulunmuyor!");
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Sipariş Listesi</title>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
                table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #e74c3c; color: white; }
                h1 { color: #2c3e50; }
            </style>
        </head>
        <body>
            <h1>📋 Sipariş Listesi</h1>
            <p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
            <table>
                <thead>
                    <tr><th>Ürün Adı</th><th>Mevcut Stok</th><th>Kritik Seviye</th><th>Önerilen Sipariş</th></tr>
                </thead>
                <tbody>
                    ${kritikUrunler.map(u => `<tr><td>${getUrunAdi(u)}</td><td>${u.kalan}</td><td>${u.kritik}</td><td>${Math.max(0, (u.kritik * 2) - u.kalan)}</td></tr>`).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
};

// --- FİLTRELEME ---
window.tabloFiltrele = () => {
    const filtre = document.getElementById('aramaKutusu')?.value.toLowerCase() || "";
    const rows = document.querySelectorAll('#tablo tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if(row.classList.length === 0 || row.classList[0]?.startsWith('grup-')) {
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