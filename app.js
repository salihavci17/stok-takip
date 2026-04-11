// --- 1. CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyBdxkBa8K77nnLVFefpyzS-ACuxuZhhPc8",
    authDomain: "stok-app-ca168.firebaseapp.com",
    projectId: "stok-app-ca168",
    storageBucket: "stok-app-ca168.appspot.com",
    messagingSenderId: "599049285321",
    appId: "1:599049285321:web:0c51fb5f9331ac4e20e718",
    measurementId: "G-GH4N6W0FXH"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let stoklar = {};
let myChart = null;
let seciliUrunId = "";
let sonRaporVerisi = [];

// --- YARDIMCI: TARİH FORMATLAYICI ---
function tarihFormatla(tarihVerisi) {
    if (!tarihVerisi) return "Belirsiz";
    if (tarihVerisi.seconds) return new Date(tarihVerisi.seconds * 1000).toLocaleDateString('tr-TR');
    return tarihVerisi.toString();
}

// --- 2. VERİLERİ GETİR ---
function verileriGetir() {
    db.collection("stoklar").onSnapshot((querySnapshot) => {
        stoklar = {};
        const tablo = document.getElementById('tablo');
        const select = document.getElementById('urunSelect');
        tablo.innerHTML = "";
        select.innerHTML = '<option value="">Ürün Seçin</option>';

        querySnapshot.forEach((doc) => {
            const id = doc.id;
            const veri = doc.data();
            stoklar[id] = veri;

            // Dinamik Kritik Seviye Kontrolü (Her ürünün kendi limitine bakar)
            const limit = veri.kritik || 5; 
            const stokRengi = (veri.kalan || 0) <= limit ? '#e74c3c' : '#2c3e50';
            const uyariIkonu = (veri.kalan || 0) <= limit ? '⚠️ ' : '';

            tablo.innerHTML += `
                <tr>
                    <td onclick="urunDetayiniGoster('${id}')" style="color:#3498db; cursor:pointer; font-weight:bold; text-decoration:underline;">${id}</td>
                    <td>${veri.barkod || '-'}</td>
                    <td style="font-weight:bold; color: ${stokRengi}">${uyariIkonu}${veri.kalan || 0}</td>
                    <td><button onclick="urunSil('${id}')" class="btn-sil">Sil</button></td>
                </tr>`;
            
            const opt = document.createElement('option');
            opt.value = id; opt.textContent = id;
            select.appendChild(opt);
        });
        if (typeof stokGrafikCiz === "function") stokGrafikCiz();
    });
}

function hareketleriGetir() {
    const liste = document.getElementById('hareketListesi');
    db.collection("hareketler").orderBy("tarih", "desc").limit(10).onSnapshot((snap) => {
        if (!liste) return;
        liste.innerHTML = "";
        snap.forEach((doc) => {
            const h = doc.data();
            const tur = (h.tur || "").toLowerCase();
            const renk = tur.includes("gir") ? "#27ae60" : "#e74c3c";
            liste.innerHTML += `<li style="border-bottom:1px solid #eee; padding:10px; display:flex; justify-content:space-between; font-size:13px;"><span><small style="color:#888; display:block;">${tarihFormatla(h.tarih)}</small><strong>${h.urun}</strong></span><span style="color:${renk}; font-weight:bold;">${h.miktar} Adet</span></li>`;
        });
    });
}

// --- 3. RAPORLAMA, EXCEL, PDF, YAZDIR ---
async function raporOlustur() {
    const bas = document.getElementById('raporBaslangic').value;
    const bit = document.getElementById('raporBitis').value;
    if (!bas || !bit) return alert("Lütfen tarih seçin!");

    const snap = await db.collection("hareketler").get();
    let raporMap = {};
    let tGiris = 0, tCikis = 0;
    sonRaporVerisi = [];

    snap.forEach(doc => {
        const h = doc.data();
        let hTarih = h.tarih && h.tarih.seconds ? new Date(h.tarih.seconds * 1000).toISOString().split('T')[0] : h.tarih;
        if (hTarih >= bas && hTarih <= bit) {
            const urun = h.urun || "Bilinmeyen";
            const miktar = parseInt(h.miktar) || 0;
            const tur = (h.tur || "").toLowerCase();
            if (!raporMap[urun]) raporMap[urun] = { giris: 0, cikis: 0 };
            if (tur.includes("gir")) { raporMap[urun].giris += miktar; tGiris += miktar; }
            else { raporMap[urun].cikis += miktar; tCikis += miktar; }
        }
    });

    const govde = document.getElementById('raporTabloGovde');
    govde.innerHTML = "";
    for (const urun in raporMap) {
        sonRaporVerisi.push({ Ürün: urun, Giriş: raporMap[urun].giris, Çıkış: raporMap[urun].cikis });
        govde.innerHTML += `<tr><td style="padding:8px; border:1px solid #ddd;">${urun}</td><td style="text-align:center; color:#27ae60; border:1px solid #ddd;">${raporMap[urun].giris}</td><td style="text-align:center; color:#e74c3c; border:1px solid #ddd;">${raporMap[urun].cikis}</td></tr>`;
    }

    document.getElementById('toplamGirisAdet').innerText = tGiris;
    document.getElementById('toplamCikisAdet').innerText = tCikis;
    document.getElementById('raporSonuc').style.display = "block";
    ["btnExcel", "btnPdf", "btnYazdir"].forEach(id => document.getElementById(id).style.display = "inline-block");
}

function excelIndir() {
    const ws = XLSX.utils.json_to_sheet(sonRaporVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `Stok_Raporu_${new Date().toLocaleDateString()}.xlsx`);
}

function pdfIndir() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Stok Hareket Raporu", 14, 15);
    doc.autoTable({ html: '#printableTable', startY: 20 });
    doc.save(`Rapor_${new Date().toLocaleDateString()}.pdf`);
}

function raporYazdir() {
    const bas = document.getElementById('raporBaslangic').value;
    const bit = document.getElementById('raporBitis').value;
    const pWin = window.open('', '', 'height=600,width=800');
    pWin.document.write('<html><head><title>Yazdır</title><style>table{width:100%; border-collapse:collapse;} th,td{border:1px solid #ddd; padding:8px; text-align:left;}</style></head><body>');
    pWin.document.write('<h2>Stok Raporu (' + bas + ' / ' + bit + ')</h2>');
    pWin.document.write(document.getElementById('printableTable').outerHTML);
    pWin.document.write('</body></html>');
    pWin.document.close();
    pWin.print();
}

// --- 4. DİĞER FONKSİYONLAR ---
function urunDetayiniGoster(id) {
    seciliUrunId = id;
    const veri = stoklar[id];
    
    // Pencereyi Verilerle Doldur
    document.getElementById('detayUrunAdi').innerText = id;
    document.getElementById('editBarkod').value = veri.barkod || "";
    document.getElementById('editStok').value = veri.kalan || 0;
    document.getElementById('editKritik').value = veri.kritik || 5; 

    // Stok Rozetini Ayarla (Görsel Yardımcı)
    const rozet = document.getElementById('stokDurumRozet');
    const kritikSeviye = veri.kritik || 5;
    if (veri.kalan <= kritikSeviye) {
        rozet.innerText = "Düşük Stok";
        rozet.style.background = "#f8d7da"; rozet.style.color = "#721c24";
    } else {
        rozet.innerText = "Stok Tamam";
        rozet.style.background = "#d4edda"; rozet.style.color = "#155724";
    }

    document.getElementById('detayModal').style.display = "block";
    
    // Geçmiş Hareketleri Çek
    const icerik = document.getElementById('detayIcerik');
    icerik.innerHTML = "Yükleniyor...";
    db.collection("hareketler").where("urun", "==", id).orderBy("tarih", "desc").limit(10).get().then(snap => {
        icerik.innerHTML = "";
        if(snap.empty) { icerik.innerHTML = "Kayıt yok."; return; }
        snap.forEach(doc => {
            const h = doc.data();
            const tur = (h.tur || "").toLowerCase();
            const renk = tur.includes("gir") ? "#27ae60" : "#e74c3c";
            icerik.innerHTML += `
                <div style="border-left:4px solid ${renk}; padding:8px; margin-bottom:5px; background:#f9f9f9; display:flex; justify-content:space-between; font-size:12px;">
                    <span>${tarihFormatla(h.tarih)}</span>
                    <span style="color:${renk}; font-weight:bold;">${h.miktar} Adet</span>
                </div>`;
        });
    });
}

function stokIslem(tip) {
    const urun = document.getElementById('urunSelect').value;
    const miktar = parseInt(document.getElementById('islemMiktar').value);
    if (!urun || isNaN(miktar) || miktar <= 0) return alert("Hata!");
    const yeniStok = tip === 'giris' ? (stoklar[urun].kalan || 0) + miktar : (stoklar[urun].kalan || 0) - miktar;
    if (yeniStok < 0) return alert("Stok yetersiz!");
    const batch = db.batch();
    batch.update(db.collection("stoklar").doc(urun), { kalan: yeniStok });
    batch.set(db.collection("hareketler").doc(), { urun, tur: tip, miktar, tarih: firebase.firestore.FieldValue.serverTimestamp() });
    batch.commit().then(() => { document.getElementById('islemMiktar').value = ""; });
}

function stokManuelGuncelle() {
    const miktar = parseInt(document.getElementById('manuelStokInput').value);
    db.collection("stoklar").doc(seciliUrunId).update({ kalan: miktar }).then(() => { alert("Güncellendi"); modalKapat(); });
}

function modalKapat() { document.getElementById('detayModal').style.display = "none"; }
function urunEkle() {
    const ad = document.getElementById('urunAdi').value.trim();
    if(!ad) return;
    db.collection("stoklar").doc(ad).set({ barkod: document.getElementById('urunBarkod').value, kalan: 0 });
    document.getElementById('urunAdi').value = ""; document.getElementById('urunBarkod').value = "";
}
function urunSil(id) { if(confirm("Silinsin mi?")) db.collection("stoklar").doc(id).delete(); }
function stokGrafikCiz() {
    const labels = Object.keys(stoklar);
    const data = labels.map(l => stoklar[l].kalan || 0);
    if(myChart) myChart.destroy();
    myChart = new Chart(document.getElementById('stokChart'), { type: 'bar', data: { labels, datasets: [{ label: 'Stok', data, backgroundColor: '#3498db' }] } });
}
function urunHepsiniGuncelle() {
    const yeniBarkod = document.getElementById('editBarkod').value;
    const yeniStok = parseInt(document.getElementById('editStok').value);
    const yeniKritik = parseInt(document.getElementById('editKritik').value);

    if (isNaN(yeniStok) || isNaN(yeniKritik)) {
        return alert("Lütfen miktar alanlarını sayı olarak doldurun!");
    }

    db.collection("stoklar").doc(seciliUrunId).update({
        barkod: yeniBarkod,
        kalan: yeniStok,
        kritik: yeniKritik
    }).then(() => {
        alert("Ürün Bilgileri Güncellendi!");
        modalKapat();
    }).catch(err => {
        alert("Hata: " + err);
    });
    let html5QrCode;

// --- KAMERA İLE BARKOD OKUTMA ---
function kameraBaslat(hedefInputId) {
    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = "block";
    
    html5QrCode = new Html5Qrcode("reader");
    
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        document.getElementById(hedefInputId).value = decodedText;
        kameraKapat();
        alert("Barkod Okundu: " + decodedText);
    };

    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
    .catch((err) => {
        alert("Kamera başlatılamadı: " + err);
        readerDiv.style.display = "none";
    });
}

function kameraKapat() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader').style.display = "none";
        });
    }
}

// --- BARKOD OKUYUCU (EL TERMİNALİ) İÇİN OTOMATİK ENTER DESTEĞİ ---
// Barkod okuyucuyla okutunca otomatik işlem yapmasını sağlar
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const activeElem = document.activeElement;
        // Eğer barkod kutusundaysak ve bir şey okutulduysa
        if (activeElem.id === 'urunBarkod' || activeElem.id === 'editBarkod') {
            console.log("Barkod okuyucudan veri alındı.");
        }
    }
});
}
verileriGetir(); hareketleriGetir();