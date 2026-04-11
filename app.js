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
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
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

function hareketleriGetir() {
    // Firebase'den en son 15 hareketi tarih sırasına göre çekiyoruz
    db.collection("hareketler").orderBy("tarih", "desc").limit(15).onSnapshot((snap) => {
        const liste = document.getElementById('hareketListesi');
        if (!liste) return;
        
        liste.innerHTML = ""; // Listeyi temizle

        snap.forEach(doc => {
            const h = doc.data();
            const renk = h.tur === "giris" ? "#27ae60" : "#e74c3c"; // Yeşil / Kırmızı
            const simge = h.tur === "giris" ? "➕" : "➖";
            
            // Eğer tarih verisi henüz sunucudan gelmediyse "İşleniyor..." yaz
            const tarihYazisi = h.tarih ? tarihFormat(h.tarih) : "İşleniyor...";

            liste.innerHTML += `
                <div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span style="font-weight:bold; color:${renk}">${simge} ${h.urun}</span>
                        <br>
                        <small style="color:#7f8c8d;">${tarihYazisi}</small>
                    </div>
                    <div style="font-weight:bold; color:${renk}">
                        ${h.tur === "giris" ? "+" : "-"}${h.miktar}
                    </div>
                </div>`;
        });
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
    batch.set(db.collection("hareketler").doc(), { urun, tur: tip, miktar, tarih: firebase.firestore.FieldValue.serverTimestamp() });
    batch.commit().then(() => { document.getElementById('islemMiktar').value = ""; });
}

function urunDetayiniGoster(id) {
    seciliUrunId = id; const v = stoklar[id];
    document.getElementById('detayUrunAdi').innerText = id;
    document.getElementById('editBarkod').value = v.barkod || "";
    document.getElementById('editStok').value = v.kalan || 0;
    document.getElementById('editKritik').value = v.kritik || 5;
    document.getElementById('detayModal').style.display = "block";
}

function urunHepsiniGuncelle() {
    db.collection("stoklar").doc(seciliUrunId).update({
        barkod: document.getElementById('editBarkod').value,
        kalan: parseInt(document.getElementById('editStok').value),
        kritik: parseInt(document.getElementById('editKritik').value)
    }).then(() => { modalKapat(); });
}

async function modalKapat() {
    if (modalQrCode) { await modalQrCode.stop().catch(()=>{}); modalQrCode = null; }
    document.getElementById('detayModal').style.display = "none";
    document.getElementById('modal-reader').style.display = "none";
    document.getElementById('modalCamBtn').innerText = "📷";
}

async function modalKameraBaslat() {
    const readerDiv = document.getElementById('modal-reader');
    if (modalQrCode) { await modalQrCode.stop(); modalQrCode = null; readerDiv.style.display = "none"; return; }
    readerDiv.style.display = "block";
    modalQrCode = new Html5Qrcode("modal-reader");
    modalQrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 200 }, (text) => {
        document.getElementById('editBarkod').value = text;
        modalKapat();
    }).catch(err => console.error(err));
}

function urunEkle() {
    const ad = document.getElementById('urunAdi').value;
    if(ad) db.collection("stoklar").doc(ad).set({ barkod: document.getElementById('urunBarkod').value, kalan: 0, kritik: 5 });
}
function urunSil(id) { if(confirm("Silinsin mi?")) db.collection("stoklar").doc(id).delete(); }

verileriGetir(); 
hareketleriGetir();