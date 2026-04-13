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

function karakterTemizle(metin) {
    if (!metin) return "";
    const harfHaritasi = { 'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ş':'s','Ş':'S','ü':'u','Ü':'U','ö':'o','Ö':'O','ı':'i','İ':'I' };
    return metin.replace(/[çÇğĞşŞüÜöÖıİ]/g, (harf) => harfHaritasi[harf]);
}

function barkodlaUrunSec() {
    const okunanBarkod = document.getElementById('islemBarkod').value;
    const select = document.getElementById('urunSelect');
    let bulundu = false;
    for (let urunId in stoklar) {
        if (stoklar[urunId].barkod === okunanBarkod) {
            select.value = urunId;
            bulundu = true; break;
        }
    }
    if (!bulundu) alert("Bu barkoda ait bir ürün bulunamadı!");
    else document.getElementById('islemMiktar').focus();
}

async function kameraBaslat(inputId) {
    document.getElementById('reader-wrapper').style.display = "block";
    if(html5QrCode) await html5QrCode.stop().catch(()=>{});
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        const inputElement = document.getElementById(inputId);
        inputElement.value = text;
        const event = new Event('change');
        inputElement.dispatchEvent(event);
        kameraDurdur();
    }).catch(err => alert("Kamera Hatası: " + err));
}

function kameraDurdur() {
    if(html5QrCode) html5QrCode.stop().then(() => document.getElementById('reader-wrapper').style.display = "none");
}

function tarihFormat(veri) {
    if (!veri) return "---";
    let d = veri.seconds ? new Date(veri.seconds * 1000) : new Date(veri);
    if (isNaN(d.getTime())) return "Bilinmiyor";
    
    const gun = String(d.getDate()).padStart(2, '0');
    const ay = String(d.getMonth() + 1).padStart(2, '0');
    const yil = d.getFullYear();
    
    return `${gun}.${ay}.${yil}`;
}

function tabloFiltrele() {
    const input = document.getElementById("aramaKutusu").value.toUpperCase();
    const tablo = document.getElementById("tablo");
    const satirlar = tablo.getElementsByTagName("tr");
    for (let i = 0; i < satirlar.length; i++) {
        const urunAdi = satirlar[i].getElementsByTagName("td")[0];
        if (urunAdi) {
            satirlar[i].style.display = urunAdi.textContent.toUpperCase().includes(input) ? "" : "none";
        }
    }
}

function verileriGetir() {
    db.collection("stoklar").onSnapshot((querySnapshot) => {
        stoklar = {};
        querySnapshot.forEach((doc) => { stoklar[doc.id] = doc.data(); });
        stoklariListele(); 
    });
}

function stoklariListele() {
    const tabloGovde = document.getElementById('tablo');
    const select = document.getElementById('urunSelect');
    const siparisPanel = document.getElementById('siparisPanel');
    const siparisListesi = document.getElementById('siparisListesi');
    const kListe = document.getElementById('kritikListe');
    const kPanel = document.getElementById('kritikPanel');

    if (!tabloGovde) return;
    tabloGovde.innerHTML = "";
    if (select) select.innerHTML = '<option value="">Seçin</option>';
    if (siparisListesi) siparisListesi.innerHTML = "";
    if (kListe) kListe.innerHTML = "";

    let eksikVarMi = false;
    const siraliAnahtarlar = Object.keys(stoklar).sort();

    siraliAnahtarlar.forEach(id => {
        const s = stoklar[id];
        const kritik = s.kritik || 5;
        const kalan = s.kalan || 0;
        const renk = parseInt(kalan) <= parseInt(kritik) ? "red" : "black";

        tabloGovde.innerHTML += `
            <tr onclick="urunDetayiniGoster('${id}')"> 
                <td>${id}</td>
                <td style="color:${renk}; font-weight:bold;">${kalan}</td>
                <td><button onclick="event.stopPropagation(); urunSil('${id}')" class="btn-sil">✖</button></td>
            </tr>`;

        if (select) select.innerHTML += `<option value="${id}">${id}</option>`;

        if (parseInt(kalan) <= parseInt(kritik)) {
            eksikVarMi = true;
            if (siparisListesi) siparisListesi.innerHTML += `<li><b>${id}</b> <small>(Kalan: ${kalan})</small></li>`;
            if (kListe) kListe.innerHTML += `<li><b>${id}</b>: Son ${kalan} adet!</li>`;
        }
    });

    if (siparisPanel) siparisPanel.style.display = eksikVarMi ? "block" : "none";
    if (kPanel) kPanel.style.display = eksikVarMi ? "block" : "none";
}
// html değişkeninin başladığı yerdeki başlık kısmına bir <th> ekle:
let html = `
    <table style="width:100%">
        <thead>
            <tr>
                <th>Tarih</th>
                <th>Ürün</th>
                <th>Mkt</th>
                <th></th> 
            </tr>
        </thead>
        <tbody>`;

// app.js içindeki fonksiyonu bu şekilde güncelle:
function hareketleriGetir() {
    db.collection("hareketler").orderBy("tarih", "desc").limit(10).onSnapshot(snap => {
        const govde = document.getElementById("hareketlerTablo");
        if (!govde) return;
        
        let html = "";
        snap.forEach(doc => {
            const h = doc.data();
            const id = doc.id; // Belge ID'sini buradan alıyoruz
            const renk = h.tur === "giris" ? "green" : "red";
            const sembol = h.tur === "giris" ? "+" : "-";

            // Tarih formatı
            let tarihYazi = "";
            if (h.tarih) {
                const d = h.tarih.toDate ? h.tarih.toDate() : new Date(h.tarih);
                tarihYazi = d.toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
            }

            html += `
                <tr>
                    <td style="font-size:11px;">${tarihYazi}</td>
                    <td style="font-weight:bold;">${h.urun}</td>
                    <td style="color:${renk}; font-weight:bold;">${sembol}${h.miktar}</td>
                    <td style="text-align:center;">
                        <button onclick="hareketSil('${id}', '${h.urun}', ${h.miktar}, '${h.tur}')" 
                                style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:18px;">
                            🗑️
                        </button>
                    </td>
                </tr>`;
        });
        govde.innerHTML = html;
    });
}
function stokIslem(tip) {
    const urun = document.getElementById('urunSelect').value;
    const miktar = parseInt(document.getElementById('islemMiktar').value);
    if(!urun || !miktar) return;
    const mevcutStok = parseInt(stoklar[urun].kalan) || 0;
    const yeni = tip === 'giris' ? (mevcutStok + miktar) : (mevcutStok - miktar);
    const batch = db.batch();
    batch.update(db.collection("stoklar").doc(urun), { kalan: yeni });
    batch.set(db.collection("hareketler").doc(), { 
        urun, 
        tur: tip, 
        miktar: parseInt(miktar), 
        tarih: firebase.firestore.Timestamp.fromDate(new Date())
    });
    batch.commit().then(() => { document.getElementById('islemMiktar').value = ""; });
}

function urunDetayiniGoster(id) {
    seciliUrunId = id; const v = stoklar[id];
    document.getElementById('editUrunAd').value = doc.id;
    document.getElementById('editBarkod').value = v.barkod || "";
    document.getElementById('editStok').value = v.kalan || 0;
    document.getElementById('editKritik').value = v.kritik || 5;
    document.getElementById('detayModal').style.display = "block";
}

async function urunHepsiniGuncelle() {
    const yeniAd = document.getElementById('editUrunAd').value.trim();
    const eskiAd = seciliUrunId; 
    const yeniBarkod = document.getElementById('editBarkod').value;
    const yeniStok = parseInt(document.getElementById('editStok').value);
    const yeniKritik = parseInt(document.getElementById('editKritik').value);

    if (!yeniAd) return alert("Ürün adı boş olamaz!");

    try {
        const urunRef = db.collection("stoklar");

        // EĞER İSİM DEĞİŞTİYSE (Örn: "Marlboro" idi, "Marlboro Touch" olduysa)
        if (yeniAd !== eskiAd) {
            // 1. Yeni isimle yeni bir belge oluştur
            await urunRef.doc(yeniAd).set({
                barkod: yeniBarkod,
                stok: yeniStok,
                kritik: yeniKritik
            });
            // 2. Eski isimli belgeyi sil
            await urunRef.doc(eskiAd).delete();
            
            // 3. Hareketler tablosundaki ürün adlarını da güncellemek istersen 
            // buraya ekleme yapılabilir ama şu an için ana stok kaydını taşıyoruz.
            
            alert("Ürün adı ve bilgileri başarıyla taşındı ve güncellendi!");
        } else {
            // EĞER İSİM AYNIYSA (Sadece stok veya barkod değiştiyse)
            await urunRef.doc(eskiAd).update({
                barkod: yeniBarkod,
                stok: yeniStok,
                kritik: yeniKritik
            });
            alert("Bilgiler güncellendi!");
        }

        modalKapat();
        stokListesiGetir(); // Listeyi yenile
    } catch (e) {
        console.error("Güncelleme hatası:", e);
        alert("Güncelleme sırasında bir hata oluştu.");
    }
}

async function modalKameraBaslat() {
    const readerDiv = document.getElementById('modalReader');
    if (!readerDiv) return;

    // 1. Ana sayfadaki tarayıcıyı durdur (çakışma önleyici)
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop().catch(() => {});
        document.getElementById('reader-wrapper').style.display = "none";
    }

    // 2. Eğer modal kamerası zaten açıksa temizle
    if (modalQrCode) {
        try { await modalQrCode.stop(); } catch(e) {}
        modalQrCode = null;
    }

    readerDiv.style.display = "block";
    modalQrCode = new Html5Qrcode("modalReader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    modalQrCode.start(
        { facingMode: "environment" }, 
        config, 
        async (text) => {
            // 3. Barkodu inputa yaz
            const barkodInput = document.getElementById('editBarkod');
            if (barkodInput) {
                barkodInput.value = text;
                barkodInput.style.backgroundColor = "#e1f5fe"; // Okunduğunu belli etmek için hafif mavi yap
            }

            // 4. SADECE KAMERAYI KAPAT (Modal açık kalmaya devam eder)
            if (modalQrCode) {
                await modalQrCode.stop().catch(() => {});
                modalQrCode = null;
            }
            readerDiv.style.display = "none";
            
            // Kullanıcıya sesli veya görsel ufak bir onay
            console.log("Barkod okundu ve kamera kapatıldı.");
        }
    ).catch(err => {
        console.error("Kamera Hatası:", err);
    });
}

// Modal Kapatma fonksiyonun sadece sen bastığında çalışacak
async function modalKapat() {
    if (modalQrCode) {
        await modalQrCode.stop().catch(() => {});
        modalQrCode = null;
    }
    document.getElementById('detayModal').style.display = "none";
    document.getElementById('modalReader').style.display = "none";
    
    // Rengi sıfırla
    const barkodInput = document.getElementById('editBarkod');
    if(barkodInput) barkodInput.style.backgroundColor = "white";
}

function urunEkle() {
    const ad = document.getElementById('urunAdi').value;
    if(ad) db.collection("stoklar").doc(ad).set({ barkod: document.getElementById('urunBarkod').value, kalan: 0, kritik: 5 });
}
function urunSil(id) { if(confirm("Silinsin mi?")) db.collection("stoklar").doc(id).delete(); }
// --- RAPORLAMA FONKSİYONLARI ---

async function raporOlustur() {
    // Senin index.html dosmandaki doğru ID'leri kullanıyoruz
    const bas = document.getElementById('raporBaslangic').value;
    const bit = document.getElementById('raporBitis').value;
    const filtre = document.getElementById('raporFiltre').value;
    const govde = document.getElementById('raporTabloGovde');
    const sonucDiv = document.getElementById('raporSonuc');

    if (!bas || !bit) return alert("Lütfen tarih aralığı seçin!");

    // Tarihleri Firebase'in anlayacağı formata çevir (Günün başlangıcı ve bitişi)
    const d1 = new Date(bas + "T00:00:00");
    const d2 = new Date(bit + "T23:59:59");

    try {
        const snap = await db.collection("hareketler")
            .where("tarih", ">=", firebase.firestore.Timestamp.fromDate(d1))
            .where("tarih", "<=", firebase.firestore.Timestamp.fromDate(d2))
            .get();

        sonRaporVerisi = [];
        let özet = {};
        let genelGirisToplam = 0;
        let genelCikisToplam = 0;

        if (snap.empty) {
            alert("Seçili tarihlerde kayıt bulunamadı!");
            if(sonucDiv) sonucDiv.style.display = "none";
            return;
        }

        snap.forEach(doc => {
            const h = doc.data();
            if (filtre !== "hepsi" && h.tur !== filtre) return;

            if (!özet[h.urun]) özet[h.urun] = { giris: 0, cikis: 0 };
            const m = parseInt(h.miktar) || 0;
            
            if (h.tur === "giris") {
                özet[h.urun].giris += m;
                genelGirisToplam += m;
            } else {
                özet[h.urun].cikis += m;
                genelCikisToplam += m;
            }
        });

        // Tabloyu temizle ve doldur
        govde.innerHTML = "";
        for (let u in özet) {
            // İndirme listesine ekle
            sonRaporVerisi.push({ "Ürün": u, "Giriş": özet[u].giris, "Çıkış": özet[u].cikis });
            
            // Tabloya satır ekle
            govde.innerHTML += `
                <tr>
                    <td>${u}</td>
                    <td style="color:green; font-weight:bold;">${özet[u].giris}</td>
                    <td style="color:red; font-weight:bold;">${özet[u].cikis}</td>
                </tr>`;
        }

        // --- GENEL TOPLAM SATIRI (TABLONUN EN ALTI) ---
        govde.innerHTML += `
            <tr style="background-color: #f1f4f8; border-top: 2px solid #2c3e50;">
                <td style="font-weight:bold; color:#2c3e50;">GENEL TOPLAM</td>
                <td style="color:green; font-weight:800; font-size:1.1em;">${genelGirisToplam}</td>
                <td style="color:red; font-weight:800; font-size:1.1em;">${genelCikisToplam}</td>
            </tr>`;

        // PDF/Excel listesine toplamı da ekle (Karakter temizleme fonksiyonun bunu düzeltecektir)
        sonRaporVerisi.push({ "Ürün": "GENEL TOPLAM", "Giriş": genelGirisToplam, "Çıkış": genelCikisToplam });

        if(sonucDiv) sonucDiv.style.display = "block";

    } catch (e) {
        console.error("Rapor Hatası:", e);
        alert("Rapor hazırlanırken bir hata oluştu.");
    }
}

// Excel Olarak İndirme
function excelIndir() {
    if (sonRaporVerisi.length === 0) {
        alert("İndirilecek veri bulunamadı. Önce rapor oluşturun.");
        return;
    }
    
    // Veriyi Excel sayfasına dönüştür
    const ws = XLSX.utils.json_to_sheet(sonRaporVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stok Raporu");
    
    // Dosyayı indir
    XLSX.writeFile(wb, "Stok_Raporu.xlsx");
}
// PDF Olarak İndirme
// PDF Olarak İndirme (Karakter Düzenlenmiş)
function pdfIndir() {
    if (sonRaporVerisi.length === 0) {
        alert("İndirilecek veri bulunamadı. Önce rapor oluşturun.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Başlığı temizle
    const baslik = karakterTemizle("Stok Takip Sistemi - Hareket Raporu");
    doc.text(baslik, 14, 15);
    
    // Verileri temizleyerek PDF tablosuna dönüştür
    const tabloVerisi = sonRaporVerisi.map(item => [
        karakterTemizle(item["Ürün"]),
        item["Giriş"],
        item["Çıkış"]
    ]);

    doc.autoTable({
        startY: 20,
        // Başlıkları da temizleyelim
        head: [[karakterTemizle('Ürün Adı'), karakterTemizle('Toplam Giriş'), karakterTemizle('Toplam Çıkış')]],
        body: tabloVerisi,
        theme: 'grid',
        headStyles: { fillColor: [52, 152, 219] },
        styles: { font: 'helvetica', fontSize: 10 }
    });

    doc.save("Stok_Raporu.pdf");
}

// Yardımcı Fonksiyon: Türkçe karakterleri İngilizce karşılıklarına çevirir
function karakterTemizle(metin) {
    if (!metin) return "";
    const harfHaritasi = { 
        'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ş':'s','Ş':'S','ü':'u','Ü':'U','ö':'o','Ö':'O','ı':'i','İ':'I' 
    };
    return metin.replace(/[çÇğĞşŞüÜöÖıİ]/g, (harf) => harfHaritasi[harf]);
}
async function hareketSil(hareketId, urunAd, miktar, tur) {
    if (!confirm(`${urunAd} işlemini silmek istiyor musunuz? Stok geri düzeltilecek.`)) return;

    try {
        // 1. Hareketi sil
        await db.collection("hareketler").doc(hareketId).delete();

        // 2. Stoğu iade et (Giriş siliniyorsa azalt, çıkış siliniyorsa artır)
        const m = parseInt(miktar);
        const fark = (tur === "giris") ? -m : m;

        await db.collection("stoklar").doc(urunAd).update({
            stok: firebase.firestore.FieldValue.increment(fark)
        });

        alert("İşlem başarıyla geri alındı.");
    } catch (e) {
        alert("Hata: " + e.message);
    }
}
// BU İKİ SATIR DOSYANIN EN SONUNDA VE TEK BAŞINA OLMALI
verileriGetir(); 
hareketleriGetir();