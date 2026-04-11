// --- CONFIG ---
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
let html5QrCode;

// --- BARKOD & KAMERA SİSTEMİ ---
async function kameraBaslat(inputId) {
    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = "block";
    
    // Eğer önceden açık bir kamera varsa kapat
    if(html5QrCode) { await html5QrCode.stop().catch(() => {}); }

    html5QrCode = new Html5Qrcode("reader");
    
    const config = { fps: 15, qrbox: { width: 250, height: 150 } };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
            document.getElementById(inputId).value = decodedText;
            kameraDurdur();
            alert("Barkod Okundu!");
        }
    ).catch(err => {
        alert("Kamera Hatası: HTTPS bağlantısı veya kamera izni gerekiyor.");
        console.error(err);
        readerDiv.style.display = "none";
    });
}

function kameraDurdur() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader').style.display = "none";
        }).catch(err => console.log(err));
    }
}

// --- VERİ TABANI İŞLEMLERİ ---
function verileriGetir() {
    db.collection("stoklar").onSnapshot((querySnapshot) => {
        stoklar = {};
        const tablo = document.getElementById('tablo');
        const select = document.getElementById('urunSelect');
        tablo.innerHTML = "";
        select.innerHTML = '<option value="">Seçin</option>';

        querySnapshot.forEach((doc) => {
            const id = doc.id;
            const v = doc.data();
            stoklar[id] = v;
            const kritik = v.kritik || 5;
            const renk = v.kalan <= kritik ? "red" : "black";
            const uyari = v.kalan <= kritik ? "⚠️ " : "";

            tablo.innerHTML += `<tr>
                <td onclick="urunDetayiniGoster('${id}')" style="color:blue; cursor:pointer;">${id}</td>
                <td>${v.barkod || '-'}</td>
                <td style="color:${renk}; font-weight:bold;">${uyari}${v.kalan || 0}</td>
                <td><button onclick="urunSil('${id}')">Sil</button></td>
            </tr>`;
            select.innerHTML += `<option value="${id}">${id}</option>`;
        });
        stokGrafikCiz();
    });
}

function urunDetayiniGoster(id) {
    seciliUrunId = id;
    const v = stoklar[id];
    document.getElementById('detayUrunAdi').innerText = id;
    document.getElementById('editBarkod').value = v.barkod || "";
    document.getElementById('editStok').value = v.kalan || 0;
    document.getElementById('editKritik').value = v.kritik || 5;
    document.getElementById('detayModal').style.display = "block";

    db.collection("hareketler").where("urun", "==", id).orderBy("tarih", "desc").limit(10).get().then(snap => {
        const icerik = document.getElementById('detayIcerik');
        icerik.innerHTML = "";
        snap.forEach(doc => {
            const h = doc.data();
            const t = h.tarih ? new Date(h.tarih.seconds*1000).toLocaleDateString() : "-";
            icerik.innerHTML += `<div style="font-size:12px; border-bottom:1px solid #eee; padding:5px;">${t} - ${h.tur}: ${h.miktar}</div>`;
        });
    });
}

function urunHepsiniGuncelle() {
    db.collection("stoklar").doc(seciliUrunId).update({
        barkod: document.getElementById('editBarkod').value,
        kalan: parseInt(document.getElementById('editStok').value),
        kritik: parseInt(document.getElementById('editKritik').value)
    }).then(() => { alert("Güncellendi"); modalKapat(); });
}

function stokIslem(tip) {
    const urun = document.getElementById('urunSelect').value;
    const miktar = parseInt(document.getElementById('islemMiktar').value);
    if(!urun || !miktar) return alert("Eksik bilgi!");
    const yeni = tip === 'giris' ? (stoklar[urun].kalan + miktar) : (stoklar[urun].kalan - miktar);
    
    const batch = db.batch();
    batch.update(db.collection("stoklar").doc(urun), { kalan: yeni });
    batch.set(db.collection("hareketler").doc(), { urun, tur: tip, miktar, tarih: firebase.firestore.FieldValue.serverTimestamp() });
    batch.commit();
}

// (Raporlama, Excel, PDF fonksiyonları öncekiyle aynı şekilde en alta eklenebilir)
function modalKapat() { document.getElementById('detayModal').style.display = "none"; }
function urunEkle() {
    const ad = document.getElementById('urunAdi').value;
    const bar = document.getElementById('urunBarkod').value;
    if(ad) db.collection("stoklar").doc(ad).set({ barkod: bar, kalan: 0, kritik: 5 });
}
function urunSil(id) { if(confirm("Silinsin mi?")) db.collection("stoklar").doc(id).delete(); }

function stokGrafikCiz() {
    const ctx = document.getElementById('stokChart');
    const labels = Object.keys(stoklar);
    const data = labels.map(l => stoklar[l].kalan);
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Stok', data, backgroundColor: 'blue' }] } });
}

verileriGetir();