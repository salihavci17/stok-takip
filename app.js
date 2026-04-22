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

// --- VERİ ÇEKME VE LİSTELEME ---
function verileriGetir() {
    db.collection("stoklar").onSnapshot((querySnapshot) => {
        stoklar = {};
        const urunSelect = document.getElementById("urunSelect");
        if (urunSelect) urunSelect.innerHTML = '<option value="">Ürün Seçin</option>';

        querySnapshot.forEach((doc) => {
            const veri = doc.data();
            stoklar[doc.id] = veri;
            if (urunSelect) {
                const option = document.createElement("option");
                option.value = doc.id; 
                option.textContent = veri.ad || doc.id; 
                urunSelect.appendChild(option);
            }
        });
        stoklariListele(); 
    });
}

function stoklariListele() {
    const tabloGovde = document.getElementById('tablo');
    const oPanel = document.getElementById('otoSiparisPanel');
    const oListe = document.getElementById('otoSiparisListesi');
    
    if (!tabloGovde) return;
    
    let genelToplamAdet = 0; 
    let kritikUrunVarMi = false;
    let grupluStoklar = {};
    let tabloHTML = ""; // Biriktirme değişkeni

    Object.keys(stoklar).forEach(id => {
        const s = stoklar[id];
        // Veri anahtarını kontrol edin: s.urunAd mı yoksa s.ad mi?
        const ad = s.urunAd || s.ad || "İsimsiz Ürün"; 
        const grup = s.grup || "Genel";
        
        if (!grupluStoklar[grup]) grupluStoklar[grup] = [];
        grupluStoklar[grup].push({ id, ad, ...s });
    });

    Object.keys(grupluStoklar).sort().forEach(grupAdi => {
        tabloHTML += `<tr><td colspan="3" style="background:#f1c40f; font-weight:bold; padding:8px;">${grupAdi}</td></tr>`;
        
        grupluStoklar[grupAdi].forEach(urun => {
            const miktar = parseInt(urun.kalan) || 0;
            const kritik = parseInt(urun.kritik) || 5;
            genelToplamAdet += miktar;
            const renk = miktar <= kritik ? "#e74c3c" : "#2c3e50";
            
            tabloHTML += `
                <tr onclick="detayGoster('${urun.id}')" style="cursor:pointer;">
                    <td style="padding:8px;">${urun.ad}</td>
                    <td style="color:${renk}; font-weight:bold; padding:8px;">${miktar}</td>
                    <td style="text-align:center;"><button onclick="event.stopPropagation(); urunSil('${urun.id}')" style="background:none; border:none; color:#e74c3c; cursor:pointer;">✖</button></td>
                </tr>`;

            if (miktar <= kritik) {
                kritikUrunVarMi = true;
                if (oListe) oListe.innerHTML += `<li>${urun.ad} (Kalan: ${miktar})</li>`;
            }
        });
    });

    // TEK SEFERDE GÜNCELLEME (Hızlandırıcı)
    tabloGovde.innerHTML = tabloHTML;
    
    const toplamEl = document.getElementById('toplamStok');
    if (toplamEl) toplamEl.innerText = genelToplamAdet;
    if (oPanel) oPanel.style.display = kritikUrunVarMi ? "block" : "none";
}
function hareketleriGetir() {
    db.collection("hareketler").orderBy("tarih", "desc").limit(50).onSnapshot(snap => {
        // HATA BURADAYDI: HTML'deki tablonun adı hareketlerTablo, kod hareketGovde arıyordu. Düzelttik.
        const govde = document.getElementById("hareketlerTablo"); 
        if (!govde) return;
        govde.innerHTML = "";
        
        let html = "";
        snap.forEach(doc => {
            const h = doc.data();
            const id = doc.id; 
            const renk = h.tur === "giris" ? "green" : "red";
            const sembol = h.tur === "giris" ? "+" : "-";

            const gorunurIsim = h.urun || h.urunId || "Bilinmeyen Ürün";
            const miktar = h.miktar || 0;
            const tur = h.tur || h.islem || "bilinmiyor";

            let tarihYazi = "";
            if (h.tarih) {
                const d = h.tarih.toDate ? h.tarih.toDate() : new Date(h.tarih);
                tarihYazi = d.toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
            }

            html += `
                <tr>
                    <td style="font-size:11px;">${tarihYazi}</td>
                    <td style="font-weight:bold;">${gorunurIsim}</td>
                    <td style="color:${renk}; font-weight:bold;">${sembol}${miktar}</td>
                    <td style="text-align:center;">
                        <button onclick="hareketSil('${id}', '${gorunurIsim}', ${miktar}, '${tur}')" 
                                style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:18px;">
                            🗑️
                        </button>
                    </td>
                </tr>`;
        });
        govde.innerHTML = html;
    });
}

// --- İŞLEMLER ---
function stokIslem(tip) {
    const urunId = document.getElementById('urunSelect').value;
    const miktar = parseInt(document.getElementById('islemMiktar').value);
    if(!urunId || !miktar) return;

    const mevcutStok = parseInt(stoklar[urunId].kalan) || 0;
    const urunIsmi = stoklar[urunId].ad || urunId; 
    const yeni = tip === 'giris' ? (mevcutStok + miktar) : (mevcutStok - miktar);

    const batch = db.batch();
    batch.update(db.collection("stoklar").doc(urunId), { kalan: yeni });
    
    batch.set(db.collection("hareketler").doc(), { 
        urunId: urunId,
        urun: urunIsmi, 
        tur: tip, 
        islem: tip,
        miktar: parseInt(miktar), 
        tarih: firebase.firestore.Timestamp.fromDate(new Date())
    });

    batch.commit().then(() => { 
        document.getElementById('islemMiktar').value = "";
        alert("İşlem Başarılı");
    });
}

function urunEkle() {
    const adInput = document.getElementById('urunAdi');
    const barkodInput = document.getElementById('urunBarkod');
    const ad = adInput.value.trim();
    const barkod = barkodInput.value.trim();

    // HTML'de ürün grubu seçimi olmadığı için hata vermesin diye 'Genel' atadık
    const grupElementi = document.getElementById('urunGrubu');
    const grup = grupElementi ? grupElementi.value : "Genel"; 

    if (ad) {
        db.collection("stoklar").doc(ad).set({ 
            barkod: barkod, 
            kalan: 0, 
            kritik: 5,
            urunAd: ad,
            grup: grup 
        }).then(() => {
            alert("✅ Yeni ürün başarıyla eklendi.");
            adInput.value = "";
            barkodInput.value = "";
        }).catch(error => alert("Hata: " + error));
    } else {
        alert("Lütfen ürün adını girin!");
    }
}

async function urunSil(id) { if(confirm("Silinsin mi?")) db.collection("stoklar").doc(id).delete(); }

async function hareketSil(docId, urunAd, miktar, tur) {
    if (!confirm(`${urunAd} ürününe ait ${miktar} adetlik ${tur} işlemini silmek ve stoğu geri almak istiyor musunuz?`)) return;

    try {
        const urunId = Object.keys(stoklar).find(key => stoklar[key].ad === urunAd) || urunAd;
        const urunRef = db.collection("stoklar").doc(urunId);
        const urunDoc = await urunRef.get();

        if (urunDoc.exists) {
            const mevcutStok = urunDoc.data().kalan || 0;
            const yeniStok = tur === "giris" ? (mevcutStok - miktar) : (mevcutStok + miktar);
            await urunRef.update({ kalan: yeniStok });
        }
        await db.collection("hareketler").doc(docId).delete();
        alert("İşlem silindi ve stok başarıyla geri alındı.");
    } catch (error) {
        alert("Hata oluştu: " + error.message);
    }
}

// --- MODAL VE GÜNCELLEME İŞLEMLERİ (KLONLAR TEMİZLENDİ) ---
function detayGoster(id) {
    seciliUrunId = id;
    const u = stoklar[id];
    
    if (!u) {
        console.error("Ürün bulunamadı!");
        return;
    }

    // Modal inputlarını doldur
    document.getElementById('modalUrunAd').value = u.urunAd || "";
    document.getElementById('modalBarkod').value = u.barkod || "";
    document.getElementById('modalMiktar').value = u.miktar || 0;
    document.getElementById('modalGrup').value = u.grup || "Genel";
    
    // MODALI AÇ
    const modal = document.getElementById('detayModal');
    if (modal) {
        modal.style.display = 'block';
    } else {
        console.error("Modal elementi sayfada bulunamadı!");
    }

    // 2. HAREKETLERİ GETİR (Bu blok artık fonksiyonun İÇİNDE)
    const detayIcerik = document.getElementById('detayIcerik');
    if (detayIcerik) {
        detayIcerik.innerHTML = "Yükleniyor...";
        
        // Buradaki "id" artık fonksiyon parametresinden geliyor
        db.collection("hareketler")
            .where("urunId", "==", id)
            .orderBy("tarih", "desc")
            .limit(10)
            .get()
            .then((querySnapshot) => {
                detayIcerik.innerHTML = "";
                if (querySnapshot.empty) {
                    detayIcerik.innerHTML = "<p style='color:gray;'>Henüz hareket yok.</p>";
                    return;
                }
                
                querySnapshot.forEach((doc) => {
                    const h = doc.data();
                    const t = h.tarih ? new Date(h.tarih.seconds * 1000).toLocaleString('tr-TR') : "Bilinmiyor";
                    const islem = h.tur || h.islem || "İşlem"; 
                    const miktar = h.miktar || 0;

                    detayIcerik.innerHTML += `
                        <div style="border-bottom:1px solid #eee; padding:8px 0; display:flex; justify-content:space-between;">
                            <span><strong>${t}</strong></span>
                            <span>${islem}: <strong>${miktar}</strong></span>
                        </div>
                    `;
                });
            })
            .catch(err => {
                console.error(err);
                detayIcerik.innerHTML = "Veriler alınamadı.";
            });
    }
}
async function urunGuncelle() {
    const yeniAd = document.getElementById('modalUrunAd').value;
    const yeniBarkod = document.getElementById('modalBarkod').value;
    const yeniMiktar = document.getElementById('modalMiktar').value;
    const yeniGrup = document.getElementById('modalGrup').value;

    // Mevcut (eski) ürün bilgilerini alalım ki boş bırakılanları koruyabilelim
    const eskiUrun = stoklar[seciliUrunId];

    try {
        // Eğer yeniAd boşsa, eski adı kullan; değilse yeni adı kullan
        const finalAd = (yeniAd && yeniAd.trim() !== "") ? yeniAd : (eskiUrun.urunAd || eskiUrun.ad);

        // Güncelleme işlemi
        await db.collection("stoklar").doc(seciliUrunId).update({
            urunAd: finalAd,
            barkod: yeniBarkod,
            miktar: parseInt(yeniMiktar) || 0,
            grup: yeniGrup
        });

        // Hareket kaydı
        await db.collection("hareketler").add({
            urunId: seciliUrunId,
            urun: finalAd,
            tur: "Güncelleme",
            islem: "Ürün Bilgileri Düzenlendi",
            miktar: parseInt(yeniMiktar) || 0,
            tarih: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("✅ Başarıyla güncellendi!");
        
        // Modalı kapat ve listeyi yenile (sayfa yenilenmez)
        document.getElementById('detayModal').style.display = 'none';
        stoklariListele(); 

    } catch (e) {
        console.error("Güncelleme hatası: ", e);
        alert("✖ Hata oluştu: " + e.message);
    }
}
function modalKapat() {
    const modal = document.getElementById('detayModal');
    if (modal) modal.style.display = "none";
    if (modalQrCode) {
        modalQrCode.stop().then(() => {
            document.getElementById('reader-modal').style.display = 'none';
            modalQrCode = null;
        });
    }
}

// --- KAMERA YÖNETİMİ ---
async function anaKameraBaslat() {
    const readerElement = document.getElementById('reader-wrapper');
    readerElement.style.display = 'block';
    if (html5QrCode) { try { await html5QrCode.stop(); } catch (e) {} html5QrCode = null; }
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            const bulunanId = Object.keys(stoklar).find(id => stoklar[id].barkod === decodedText.trim());
            if (bulunanId) {
                document.getElementById('urunSelect').value = bulunanId; 
                anaKameraDurdur(); 
                alert("Ürün Seçildi: " + (stoklar[bulunanId].ad || bulunanId));
            } else alert("Eşleşen ürün bulunamadı!");
        }
    ).catch(err => console.error(err));
}

async function anaKameraDurdur() {
    const readerElement = document.getElementById('reader-wrapper');
    if (html5QrCode) { try { await html5QrCode.stop(); html5QrCode = null; } catch (err) {} }
    if (readerElement) readerElement.style.display = 'none';
}

async function yeniUrunKameraBaslat() {
    const readerElement = document.getElementById('reader-wrapper-ekle');
    readerElement.style.display = 'block';
    if (modalQrCode) { try { await modalQrCode.stop(); modalQrCode = null; } catch (e) {} }
    modalQrCode = new Html5Qrcode("reader-ekle");
    modalQrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
        (decodedText) => {
            document.getElementById('urunBarkod').value = decodedText;
            yeniUrunKameraDurdur();
        }
    ).catch(err => console.error(err));
}

async function yeniUrunKameraDurdur() {
    if (modalQrCode) { try { await modalQrCode.stop(); modalQrCode = null; } catch (e) {} }
    document.getElementById('reader-wrapper-ekle').style.display = 'none';
}

async function modalKameraBaslat() {
    const readerDiv = document.getElementById('reader-modal');
    if (modalQrCode) {
        modalQrCode.stop().then(() => { readerDiv.style.display = 'none'; modalQrCode = null; });
        return;
    }
    readerDiv.style.display = 'block';
    modalQrCode = new Html5Qrcode("reader-modal");
    modalQrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 200 } },
        (decodedText) => {
            document.getElementById('editBarkod').value = decodedText;
            modalQrCode.stop().then(() => { readerDiv.style.display = 'none'; modalQrCode = null; });
        }, () => {}
    ).catch(err => {
        alert("Kamera izni verilmedi.");
        readerDiv.style.display = 'none';
    });
}

// --- RAPORLAMA FONKSİYONLARI ---
async function raporOlustur() {
    const bas = document.getElementById('raporBaslangic').value;
    const bit = document.getElementById('raporBitis').value;
    const filtre = document.getElementById('raporFiltre').value;
    const govde = document.getElementById('raporTabloGovde');
    const sonucDiv = document.getElementById('raporSonuc');

    if (!bas || !bit) return alert("Lütfen tarih aralığı seçin!");

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

            const isim = h.urun || h.urunId || "Tanımsız";
            if (!özet[isim]) özet[isim] = { giris: 0, cikis: 0 };
            const m = parseInt(h.miktar) || 0;
            
            if (h.tur === "giris") { özet[isim].giris += m; genelGirisToplam += m; } 
            else { özet[isim].cikis += m; genelCikisToplam += m; }
        });

        govde.innerHTML = "";
        for (let u in özet) {
            sonRaporVerisi.push({ "Ürün": u, "Giriş": özet[u].giris, "Çıkış": özet[u].cikis });
            govde.innerHTML += `<tr><td>${u}</td><td style="color:green; font-weight:bold;">${özet[u].giris}</td><td style="color:red; font-weight:bold;">${özet[u].cikis}</td></tr>`;
        }

        govde.innerHTML += `<tr style="background-color: #f1f4f8; border-top: 2px solid #2c3e50;"><td style="font-weight:bold;">GENEL TOPLAM</td><td style="color:green; font-weight:800;">${genelGirisToplam}</td><td style="color:red; font-weight:800;">${genelCikisToplam}</td></tr>`;
        sonRaporVerisi.push({ "Ürün": "GENEL TOPLAM", "Giriş": genelGirisToplam, "Çıkış": genelCikisToplam });
        if(sonucDiv) sonucDiv.style.display = "block";

    } catch (e) { alert("Rapor hazırlanırken hata oluştu."); }
}

function excelIndir() {
    if (sonRaporVerisi.length === 0) return alert("Önce rapor oluşturun.");
    const ws = XLSX.utils.json_to_sheet(sonRaporVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stok Raporu");
    XLSX.writeFile(wb, "Stok_Raporu.xlsx");
}

function pdfIndir() {
    if (sonRaporVerisi.length === 0) return alert("Önce rapor oluşturun.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Stok Takip Sistemi - Hareket Raporu", 14, 15);
    const tabloVerisi = sonRaporVerisi.map(item => [ karakterTemizle(item["Ürün"]), item["Giriş"], item["Çıkış"] ]);
    doc.autoTable({ startY: 20, head: [['Urun Adi', 'Toplam Giris', 'Toplam Cikis']], body: tabloVerisi, theme: 'grid', headStyles: { fillColor: [52, 152, 219] } });
    doc.save("Stok_Raporu.pdf");
}

function siparisListesiPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const listeItems = document.querySelectorAll("#otoSiparisListesi li");
    if (listeItems.length === 0) return alert("Sipariş listesi şu an boş!");
    let satirlar = [];
    listeItems.forEach((item) => satirlar.push([karakterTemizle(item.innerText)]));
    doc.setFontSize(18); doc.text("Siparis Listesi", 14, 20);
    doc.setFontSize(10); doc.text("Tarih: " + new Date().toLocaleString('tr-TR'), 14, 28);
    doc.autoTable({ startY: 35, head: [['Urun Bilgisi (Mevcut / Kritik)']], body: satirlar, theme: 'grid', headStyles: { fillColor: [231, 76, 60] } });
    doc.save("siparis_listesi.pdf");
}

function siparisListesiYazdir() {
    const listeIcerik = document.getElementById("otoSiparisListesi").innerHTML;
    if (!listeIcerik || listeIcerik.trim() === "") return alert("Yazdırılacak ürün bulunamadı!");
    const pencere = window.open('', '', 'height=600,width=800');
    pencere.document.write('<html><head><title>Sipariş Listesi</title><style>body{font-family:sans-serif; padding:20px;} h2{color:#e74c3c;} li{margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;}</style></head><body>');
    pencere.document.write('<h2>🛒 Sipariş Listesi</h2><p>Tarih: ' + new Date().toLocaleString('tr-TR') + '</p><ul>' + listeIcerik + '</ul></body></html>');
    pencere.document.close(); pencere.print();
}

// SEKME GEÇİŞİ (Sadece 1 Tane Kaldı)
function sekmeAc(evt, sekmeAdi) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";
    tablinks = document.getElementsByClassName("tab-btn");
    for (i = 0; i < tablinks.length; i++) tablinks[i].classList.remove("active");
    
    const secilenSekme = document.getElementById(sekmeAdi);
    if (secilenSekme) secilenSekme.style.display = "block";
    if (evt) evt.currentTarget.classList.add("active");
}

// Başlangıç tetikleyicileri
verileriGetir(); 
hareketleriGetir();