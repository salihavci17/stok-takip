// --- FIREBASE & GENEL AYARLAR ---
const firebaseConfig = {
    apiKey: "AIzaSyBdxkBa8K77nnLVFefpyzS-ACuxuZhhPc8",
    authDomain: "stok-app-ca168.firebaseapp.com",
    projectId: "stok-app-ca168",
    storageBucket: "stok-app-ca168.appspot.com",
    messagingSenderId: "599049285321",
    appId: "1:599049285321:web:0c51fb5f9331ac4e20e718"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let stoklar = {};
let html5QrCode = null;
let modalQrCode = null;
let seciliUrunId = "";
let sonRaporVerisi = [];
// TÜRKÇE KARAKTERLERİ PDF İÇİN TEMİZLEME FONKSİYONU
function karakterTemizle(metin) {
    if (!metin) return "";
    const harfHaritasi = {
        'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ş': 's', 'Ş': 'S',
        'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ı': 'i', 'İ': 'I'
    };
    return metin.replace(/[çÇğĞşŞüÜöÖıİ]/g, function(harf) {
        return harfHaritasi[harf];
    });
}
// --- YARDIMCI FONKSİYONLAR ---
function tarihFormat(veri) {
    if (!veri) return "---";
    let d;
    if (veri.seconds) {
        d = new Date(veri.seconds * 1000);
    } else {
        d = new Date(veri);
    }
    
    if (isNaN(d.getTime())) return "Bilinmiyor";
    
    // Sadece Gün.Ay.Yıl formatı (Saat kaldırıldı)
    const gun = String(d.getDate()).padStart(2, '0');
    const ay = String(d.getMonth() + 1).padStart(2, '0');
    const yil = d.getFullYear();
    
    return `${gun}.${ay}.${yil}`;
}

// --- ARAMA / FİLTRELEME ÖZELLİĞİ ---
function tabloFiltrele() {
    const input = document.getElementById("aramaKutusu").value.toUpperCase();
    const tablo = document.getElementById("tablo");
    const satirlar = tablo.getElementsByTagName("tr");

    for (let i = 0; i < satirlar.length; i++) {
        const urunAdi = satirlar[i].getElementsByTagName("td")[0];
        if (urunAdi) {
            const metin = urunAdi.textContent || urunAdi.innerText;
            // Buraya barkodu da dahil etmek istersen stoklar objesinden kontrol eklenebilir
            satirlar[i].style.display = metin.toUpperCase().indexOf(input) > -1 ? "" : "none";
        }
    }
}

// --- BARKOD SİSTEMLERİ ---
async function kameraBaslat(inputId) {
    document.getElementById('reader-wrapper').style.display = "block";
    if(html5QrCode) await html5QrCode.stop().catch(()=>{});
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 200 }, (text) => {
        document.getElementById(inputId).value = text;
        kameraDurdur();
    }).catch(err => alert("Hata: " + err));
}
function kameraDurdur() {
    if(html5QrCode) html5QrCode.stop().then(() => document.getElementById('reader-wrapper').style.display = "none");
}

async function modalKameraBaslat() {
    const readerDiv = document.getElementById('modal-reader');
    const btn = document.getElementById('modalCamBtn');
    
    // Eğer zaten çalışıyorsa durdur
    if (modalQrCode) {
        await modalQrCode.stop().catch(err => console.log("Durdurma hatası:", err));
        modalQrCode = null;
        readerDiv.style.display = "none";
        btn.innerText = "📷";
        return;
    }

    // Kamera alanını göster
    readerDiv.style.display = "block";
    btn.innerText = "✖";

    // Yeni nesne oluştur
    modalQrCode = new Html5Qrcode("modal-reader");
    
    const config = { fps: 10, qrbox: { width: 200, height: 200 } };

    // Kamerayı başlat
    modalQrCode.start(
        { facingMode: "environment" }, // Arka kamerayı zorla
        config,
        (text) => { // Başarılı okuma
            document.getElementById('editBarkod').value = text;
            modalKameraDurdur();
        },
        (error) => { // Okuma devam ederken oluşan hataları sustur (loglama)
            // console.warn(error); 
        }
    ).catch(err => {
        alert("Kamera başlatılamadı! Lütfen HTTPS bağlantısı kullandığınızdan ve kamera izni verdiğinizden emin olun.");
        console.error("Kamera Hatası:", err);
        readerDiv.style.display = "none";
        btn.innerText = "📷";
    });
}

// --- VERİ ÇEKME & KRİTİK STOK KONTROLÜ ---
function verileriGetir() {
    db.collection("stoklar").onSnapshot((querySnapshot) => {
        stoklar = {};
        const tablo = document.getElementById('tablo');
        const select = document.getElementById('urunSelect');
        const kPanel = document.getElementById('kritikPanel');
        const kListe = document.getElementById('kritikListe');
        
        tablo.innerHTML = "";
        select.innerHTML = '<option value="">Seçin</option>';
        kListe.innerHTML = "";
        let kritikVarMi = false;

        querySnapshot.forEach((doc) => {
            const id = doc.id; const v = doc.data();
            stoklar[id] = v;
            const kritik = v.kritik || 5;
            const kalan = v.kalan || 0;

            // Kritik Stok Kontrolü
            if (kalan <= kritik) {
                kritikVarMi = true;
                kListe.innerHTML += `<li><b>${id}</b>: Son ${kalan} adet kaldı!</li>`;
            }

            tablo.innerHTML += `<tr>
                <td onclick="urunDetayiniGoster('${id}')" style="color:#3498db; font-weight:bold;">${id}</td>
                <td style="color:${kalan <= kritik ? 'red' : 'black'}; font-weight:bold;">${kalan}</td>
                <td><button onclick="urunSil('${id}')" style="background:none; border:none; color:red;">✖</button></td>
            </tr>`;
            select.innerHTML += `<option value="${id}">${id}</option>`;
        });

        kPanel.style.display = kritikVarMi ? "block" : "none";
    });
}

function hareketleriGetir() {
    db.collection("hareketler").orderBy("tarih", "desc").limit(15).onSnapshot((snap) => {
        const liste = document.getElementById('hareketListesi');
        liste.innerHTML = "";
        snap.forEach(doc => {
            const h = doc.data();
            const renk = h.tur === "giris" ? "green" : "red";
            liste.innerHTML += `<div style="padding:5px; border-bottom:1px solid #eee; font-size:12px;">
                ${tarihFormat(h.tarih)} - <b>${h.urun}</b> - <span style="color:${renk}">${h.miktar}</span>
            </div>`;
        });
    });
}

// --- RAPORLAMA ---
async function raporOlustur() {
    const bas = document.getElementById('raporBaslangic').value;
    const bit = document.getElementById('raporBitis').value;
    const filtre = document.getElementById('raporFiltre').value; // Filtre değeri
    
    if (!bas || !bit) return alert("Tarih seç!");
    
    const govde = document.getElementById('raporTabloGovde');
    govde.innerHTML = "Sorgulanıyor...";
    let raporMap = {}; 
    sonRaporVerisi = [];

    const snap = await db.collection("hareketler").get();
    snap.forEach(doc => {
        const h = doc.data();
        if (!h.tarih) return;
        const d = h.tarih.seconds ? new Date(h.tarih.seconds * 1000) : new Date(h.tarih);
        const f = d.toISOString().split('T')[0];
        
        if (f >= bas && f <= bit) {
            // FİLTRELEME MANTIĞI
            if (filtre === "hepsi" || h.tur === filtre) {
                if (!raporMap[h.urun]) raporMap[h.urun] = { giris: 0, cikis: 0 };
                
                if (h.tur === "giris") {
                    raporMap[h.urun].giris += parseInt(h.miktar);
                } else {
                    raporMap[h.urun].cikis += parseInt(h.miktar);
                }
            }
        }
    });

    govde.innerHTML = "";
    for (const u in raporMap) {
        sonRaporVerisi.push({ Ürün: u, Giriş: raporMap[u].giris, Çıkış: raporMap[u].cikis });
        govde.innerHTML += `<tr><td>${u}</td><td style="color:green">${raporMap[u].giris}</td><td style="color:red">${raporMap[u].cikis}</td></tr>`;
    }
    document.getElementById('raporSonuc').style.display = sonRaporVerisi.length ? "block" : "none";
}

// --- DİĞER İŞLEMLER ---
function stokIslem(tip) {
    const urun = document.getElementById('urunSelect').value;
    const miktar = parseInt(document.getElementById('islemMiktar').value);
    if(!urun || !miktar) return;
    const yeni = tip === 'giris' ? (stoklar[urun].kalan + miktar) : (stoklar[urun].kalan - miktar);
    const batch = db.batch();
    batch.update(db.collection("stoklar").doc(urun), { kalan: yeni });
    batch.set(db.collection("hareketler").doc(), { urun, tur: tip, miktar, tarih: firebase.firestore.FieldValue.serverTimestamp() });
    batch.commit().then(() => document.getElementById('islemMiktar').value = "");
}

function urunDetayiniGoster(id) {
    seciliUrunId = id; const v = stoklar[id];
    document.getElementById('detayUrunAdi').innerText = id;
    document.getElementById('editBarkod').value = v.barkod || "";
    document.getElementById('editStok').value = v.kalan || 0;
    document.getElementById('editKritik').value = v.kritik || 5;
    document.getElementById('detayModal').style.display = "block";
    db.collection("hareketler").where("urun", "==", id).orderBy("tarih", "desc").limit(5).get().then(snap => {
        const icerik = document.getElementById('detayIcerik'); icerik.innerHTML = "<b>Son 5 Hareket:</b>";
        snap.forEach(doc => { icerik.innerHTML += `<div>${tarihFormat(doc.data().tarih)} - ${doc.data().miktar}</div>`; });
    });
}

function urunHepsiniGuncelle() {
    db.collection("stoklar").doc(seciliUrunId).update({
        barkod: document.getElementById('editBarkod').value,
        kalan: parseInt(document.getElementById('editStok').value),
        kritik: parseInt(document.getElementById('editKritik').value)
    }).then(() => { modalKapat(); });
}

function excelIndir() {
    const ws = XLSX.utils.json_to_sheet(sonRaporVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, "Rapor.xlsx");
}

function pdfIndir() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Başlık Bölümü (Türkçe Karakter Kullanmıyoruz)
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text("STOK HAREKET RAPORU", 14, 22);

    // Tarih Satırı
    doc.setFontSize(10);
    doc.setTextColor(120);
    const simdi = new Date().toLocaleString('tr-TR');
    doc.text(`Rapor Tarihi: ${simdi}`, 14, 30);
    
    // Mavi Çizgi
    doc.setLineWidth(0.5);
    doc.setDrawColor(41, 128, 185);
    doc.line(14, 33, 196, 33);

    // TABLO VERİSİNİ DÜZENLEME (Kritik Nokta Burası)
    const temizTabloVerisi = sonRaporVerisi.map(item => [
        karakterTemizle(item.Ürün), // Ürün isimlerini burada temizliyoruz
        item.Giriş,
        item.Çıkış
    ]);

    doc.autoTable({
        head: [['URUN ADI', 'STOK GIRIS', 'STOK CIKIS']], // Başlıklar temizlendi
        body: temizTabloVerisi,
        startY: 38,
        theme: 'striped',
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [44, 62, 80], halign: 'center' },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'center', fontStyle: 'bold', textColor: [39, 174, 96] },
            2: { halign: 'center', fontStyle: 'bold', textColor: [192, 57, 43] }
        },
        didDrawPage: (data) => {
            doc.setFontSize(9);
            doc.text(`Sayfa ${data.pageNumber}`, 14, doc.internal.pageSize.height - 10);
            doc.text("Stok Takip Sistemi tarafindan hazirlanmistir.", 100, doc.internal.pageSize.height - 10, { align: 'center' });
        }
    });

    doc.save(`Stok_Raporu_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.pdf`);
}

function urunEkle() {
    const ad = document.getElementById('urunAdi').value;
    if(ad) db.collection("stoklar").doc(ad).set({ barkod: document.getElementById('urunBarkod').value, kalan: 0, kritik: 5 });
}
function urunSil(id) { if(confirm("Sil?")) db.collection("stoklar").doc(id).delete(); }
function modalKapat() { modalKameraDurdur(); document.getElementById('detayModal').style.display = "none"; }

verileriGetir(); hareketleriGetir();