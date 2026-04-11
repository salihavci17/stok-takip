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
let html5QrCode = null;

// --- KAMERA (TELEFON UYUMLU) ---
async function kameraBaslat(inputId) {
    const wrapper = document.getElementById('reader-wrapper');
    wrapper.style.display = "block";
    
    if(html5QrCode) { await html5QrCode.stop().catch(() => {}); }
    html5QrCode = new Html5Qrcode("reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    // environment = Arka Kamera demek
    html5QrCode.start({ facingMode: "environment" }, config, (text) => {
        document.getElementById(inputId).value = text;
        kameraDurdur();
        alert("Okundu: " + text);
    }).catch(err => {
        alert("Kamera Hatası! HTTPS kullanıyor musunuz? Hata: " + err);
        wrapper.style.display = "none";
    });
}

function kameraDurdur() {
    if(html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader-wrapper').style.display = "none";
        });
    }
}

// --- VERİ ÇEKME & LİSTELEME ---
function verileriGetir() {
    db.collection("stoklar").onSnapshot((querySnapshot) => {
        stoklar = {};
        const tablo = document.getElementById('tablo');
        const select = document.getElementById('urunSelect');
        tablo.innerHTML = "";
        select.innerHTML = '<option value="">Ürün Seçin</option>';

        querySnapshot.forEach((doc) => {
            const id = doc.id;
            const v = doc.data();
            stoklar[id] = v;
            const kritik = v.kritik || 5;
            const renk = v.kalan <= kritik ? "#e74c3c" : "#2c3e50";

            tablo.innerHTML += `<tr>
                <td onclick="urunDetayiniGoster('${id}')" style="color:#3498db; font-weight:bold;">${id}</td>
                <td style="color:${renk}; font-weight:bold;">${v.kalan || 0}</td>
                <td><button onclick="urunSil('${id}')" class="btn-sil">Sil</button></td>
            </tr>`;
            select.innerHTML += `<option value="${id}">${id}</option>`;
        });
        stokGrafikCiz();
    });
}

// --- HAREKETLER (Yeniden Eklendi) ---
function hareketleriGetir() {
    db.collection("hareketler").orderBy("tarih", "desc").limit(15).onSnapshot((snap) => {
        const liste = document.getElementById('hareketListesi');
        if(!liste) return;
        liste.innerHTML = "";
        snap.forEach(doc => {
            const h = doc.data();
            const tarih = h.tarih ? new Date(h.tarih.seconds*1000).toLocaleTimeString() : "";
            const renk = h.tur === "giris" ? "#27ae60" : "#e74c3c";
            liste.innerHTML += `<li style="padding:8px; border-bottom:1px solid #eee;">
                <span style="color:#888;">${tarih}</span> | <b>${h.urun}</b> | <span style="color:${renk}">${h.tur.toUpperCase()} (${h.miktar})</span>
            </li>`;
        });
    });
}

// --- İŞLEMLER ---
function stokIslem(tip) {
    const urun = document.getElementById('urunSelect').value;
    const miktar = parseInt(document.getElementById('islemMiktar').value);
    if(!urun || !miktar) return alert("Eksik bilgi!");

    const yeniStok = tip === 'giris' ? (stoklar[urun].kalan + miktar) : (stoklar[urun].kalan - miktar);
    if(yeniStok < 0) return alert("Stok yetersiz!");

    const batch = db.batch();
    batch.update(db.collection("stoklar").doc(urun), { kalan: yeniStok });
    batch.set(db.collection("hareketler").doc(), {
        urun, tur: tip, miktar, tarih: firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.commit().then(() => document.getElementById('islemMiktar').value = "");
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
            const d = h.tarih ? new Date(h.tarih.seconds*1000).toLocaleDateString() : "";
            icerik.innerHTML += `<div style="font-size:12px; padding:5px; border-bottom:1px solid #eee;">${d} - ${h.tur}: ${h.miktar}</div>`;
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

// --- DİĞER FONKSİYONLAR ---
function modalKapat() { document.getElementById('detayModal').style.display = "none"; }
function urunEkle() {
    const ad = document.getElementById('urunAdi').value;
    const bar = document.getElementById('urunBarkod').value;
    if(!ad) return alert("Ürün adı girin!");
    db.collection("stoklar").doc(ad).set({ barkod: bar, kalan: 0, kritik: 5 }).then(() => {
        document.getElementById('urunAdi').value = ""; document.getElementById('urunBarkod').value = "";
    });
}
function urunSil(id) { if(confirm(id + " silinsin mi?")) db.collection("stoklar").doc(id).delete(); }

function stokGrafikCiz() {
    const ctx = document.getElementById('stokChart');
    const labels = Object.keys(stoklar);
    const data = labels.map(l => stoklar[l].kalan);
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Stok Adedi', data, backgroundColor: '#3498db' }] } });
}

// Uygulamayı Başlat
verileriGetir();
hareketleriGetir();