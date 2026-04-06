import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDocs, collection, addDoc, deleteDoc } from "firebase/firestore";

// 🔑 Senin Firebase config bilgilerin
const firebaseConfig = {
  apiKey: "AIzaSyC7oZ-0VJQwYH7lYvZk9Zy5lXzqQkzXxXo",
  authDomain: "stok-takip-salih.firebaseapp.com",
  projectId: "stok-takip-salih",
  storageBucket: "stok-takip-salih.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let stoklar = {};
let aktifUrun = null;

// Form ve tablo referansları
const urunForm = document.getElementById("urunForm");
const stokForm = document.getElementById("stokForm");
const urunSelect = document.getElementById("urunSelect");
const stokBody = document.getElementById("stokBody");
const hareketBody = document.getElementById("hareketBody");

// ---------------- Ürün Ekleme ----------------
urunForm.addEventListener("submit", async e => {
  e.preventDefault();
  const urunAdi = document.getElementById("urunAdi").value.trim();
  const urunBarkod = document.getElementById("urunBarkod").value.trim();
  if (urunAdi) {
    await setDoc(doc(db, "stoklar", urunAdi), { 
      giren: 0, 
      cikan: 0, 
      kalan: 0, 
      barkod: urunBarkod || "" 
    });
    await stoklariYukle();
  }
  urunForm.reset();
});

// ---------------- Stok İşlemleri ----------------
stokForm.addEventListener("submit", async e => {
  e.preventDefault();
  const urun = urunSelect.value;
  const miktar = parseInt(document.getElementById("miktar").value);
  const islemTuru = document.getElementById("islemTuru").value;
  if (!urun) return alert("Lütfen ürün seçin.");
  let kayit = stoklar[urun] || { giren: 0, cikan: 0, kalan: 0 };

  if (stokForm.dataset.duzenlenen) {
    // 🔑 Düzenleme modunda sadece stok güncellenir, hareket eklenmez
    kayit.kalan = miktar;
    await setDoc(doc(db, "stoklar", urun), kayit);
    stokForm.dataset.duzenlenen = "";
    alert("Stok düzenlendi: " + urun + " → kalan: " + miktar);
  } else {
    // Normal giriş/çıkış işlemleri
    if (islemTuru === "giris") {
      kayit.giren += miktar;
      kayit.kalan += miktar;
    } else {
      kayit.cikan += miktar;
      kayit.kalan = Math.max(0, kayit.kalan - miktar);
    }

    await setDoc(doc(db, "stoklar", urun), kayit);

    // Hareket kaydı ekle
    await addDoc(collection(db, "hareketler"), {
      urun: urun,
      miktar: miktar,
      tur: islemTuru,
      tarih: new Date().toISOString().split("T")[0]
    });
  }

  await stoklariYukle();
  await hareketleriYukle();
  stokForm.reset();
});

// ---------------- Stokları Yükle ----------------
async function stoklariYukle() {
  const snapshot = await getDocs(collection(db, "stoklar"));
  stoklar = {};
  urunSelect.innerHTML = '<option value="">Ürün seçin</option>';
  stokBody.innerHTML = "";
  snapshot.forEach(docSnap => {
    stoklar[docSnap.id] = docSnap.data();
    const kayit = stoklar[docSnap.id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${docSnap.id}</td>
      <td>${kayit.giren}</td>
      <td>${kayit.cikan}</td>
      <td>${kayit.kalan}</td>
      <td>${kayit.barkod || "-"}</td>
      <td>
        <button onclick="urunDetay('${docSnap.id}')">Detay</button>
        <button onclick="duzenleUrun('${docSnap.id}')">Düzenle</button>
        <button onclick="silUrun('${docSnap.id}')">Sil</button>
      </td>
    `;
    stokBody.appendChild(tr);

    // Dropdown’a ürün ekle
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = docSnap.id;
    urunSelect.appendChild(option);
  });
}
stoklariYukle();

// ---------------- Hareketleri Yükle ----------------
async function hareketleriYukle() {
  const snapshot = await getDocs(collection(db, "hareketler"));
  hareketBody.innerHTML = "";
  snapshot.forEach(docSnap => {
    const h = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${h.urun}</td><td>${h.tur}</td><td>${h.miktar}</td><td>${h.tarih}</td>`;
    hareketBody.appendChild(tr);
  });
}
hareketleriYukle();

// ---------------- Ürün Düzenleme ----------------
window.duzenleUrun = function(urun) {
  const kayit = stoklar[urun];
  urunSelect.value = urun;
  document.getElementById("miktar").value = kayit.kalan;
  stokForm.dataset.duzenlenen = urun;
}

// ---------------- Ürün Silme ----------------
window.silUrun = async function(urun) {
  await deleteDoc(doc(db, "stoklar", urun));
  await stoklariYukle();
}

// ---------------- Ürün Detay ----------------
window.urunDetay = async function(urun) {
  aktifUrun = urun;
  const kayit = stoklar[urun];
  document.getElementById("detayUrunAdi").textContent = urun;
  document.getElementById("detayBarkod").value = kayit.barkod || "";
  document.getElementById("detayMiktar").value = kayit.kalan;

  // Hareketleri filtrele
  const snapshot = await getDocs(collection(db, "hareketler"));
  const detayHareketTablo = document.getElementById("detayHareketTablo");
  detayHareketTablo.innerHTML = "";
  snapshot.forEach(docSnap => {
    const h = docSnap.data();
    if (h.urun === urun) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${h.tarih}</td><td>${h.tur}</td><td>${h.miktar}</td>`;
      detayHareketTablo.appendChild(tr);
    }
  });

  document.getElementById("urunDetayModal").style.display = "block";
}

window.kapatDetay = function() {
  document.getElementById("urunDetayModal").style.display = "none";
}

window.kaydetDetay = async function() {
  if (!aktifUrun) return;
  const yeniMiktar = parseInt(document.getElementById("detayMiktar").value);
  const yeniBarkod = document.getElementById("detayBarkod").value.trim();
  let kayit = stoklar[aktifUrun];
  kayit.kalan = yeniMiktar;
  if (yeniBarkod) kayit.barkod = yeniBarkod;

  await setDoc(doc(db, "stoklar", aktifUrun), kayit);
  await stoklariYukle();
  alert("Stok güncellendi: " + aktifUrun + " → kalan: " + yeniMiktar + (yeniBarkod ? " barkod: " + yeniBarkod : ""));
}

// ---------------- Barkod Okutma ----------------
// html5-qrcode kütüphanesini kullanıyorsan:
let html5QrCode;

window.startScanner = function() {
  html5QrCode = new Html5Qrcode("reader");
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    qrCodeMessage => {
      // Barkod okutulduğunda ürün seçilsin
      for (const [urun, kayit] of Object.entries(stoklar)) {
        if (kayit.barkod === qrCodeMessage) {
          urunSelect.value = urun;
          alert("Barkod okundu: " + urun);
        }
      }
    }
  ).catch(err => {
    console.error("Kamera başlatılamadı:", err);
  });
}

window.stopScanner = function() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      console.log("Kamera durduruldu.");
    }).catch(err => {
      console.error("Kamera durdurulamadı:", err);
    });
  }
}