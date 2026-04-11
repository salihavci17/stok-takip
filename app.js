import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDocs, deleteDoc, collection, addDoc } 
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// 🔑 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBdxkBa8K77nnLVFefpyzS-ACuxuZhhPc8",
  authDomain: "stok-app-ca168.firebaseapp.com",
  projectId: "stok-app-ca168",
  storageBucket: "stok-app-ca168.appspot.com",
  messagingSenderId: "599049285321",
  appId: "1:599049285321:web:0c51fb5f9331ac4e20e718",
  measurementId: "G-GH4N6W0FXH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Form ve tablo referansları
const urunForm = document.getElementById("urunForm");
const stokForm = document.getElementById("stokForm");
const urunSelect = document.getElementById("urunSelect");
const tablo = document.getElementById("tablo");
const hareketTablo = document.getElementById("hareketTablo");

let stoklar = {};
let urunler = [];
let html5QrCode;

// ---------------- Bildirim Kutusu ----------------
function bildirim(mesaj, tip = "success") {
  const div = document.createElement("div");
  div.textContent = mesaj;
  div.style.padding = "10px";
  div.style.margin = "10px 0";
  div.style.borderRadius = "6px";
  div.style.color = "#fff";
  div.style.fontWeight = "bold";
  div.style.textAlign = "center";
  div.style.backgroundColor = tip === "success" ? "#2ecc71" : "#e74c3c";
  document.body.prepend(div);
  setTimeout(() => div.remove(), 3000);
}

// ---------------- Stokları Yükle ----------------
async function stoklariYukle() {
  const snapshot = await getDocs(collection(db, "stoklar"));
  stoklar = {};
  urunler = [];
  snapshot.forEach(docSnap => {
    stoklar[docSnap.id] = docSnap.data();
    urunler.push(docSnap.id);
  });
  urunSelect.innerHTML = '<option value="">Ürün seçin</option>';
  urunler.forEach(urun => ekleUrunSecenek(urun));
  tabloyuYenile();
}

// ---------------- Hareketleri Yükle ----------------
async function hareketleriYukle() {
  const snapshot = await getDocs(collection(db, "hareketler"));
  hareketTablo.innerHTML = "";
  snapshot.forEach(docSnap => {
    const h = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${h.tarih}</td>
      <td>${h.urun}</td>
      <td>${h.tur}</td>
      <td>${h.miktar}</td>
    `;
    hareketTablo.appendChild(tr);
  });
}

// ---------------- Ürün Ekleme ----------------
urunForm.addEventListener("submit", async e => {
  e.preventDefault();
  const urunAdi = document.getElementById("urunAdi").value.trim();
  if (urunAdi) {
    await setDoc(doc(db, "stoklar", urunAdi), { giren: 0, cikan: 0, kalan: 0, barkod: "" });
    await stoklariYukle();
    bildirim("Ürün eklendi: " + urunAdi);
  }
  urunForm.reset();
});

// ---------------- Stok İşlemleri ----------------
stokForm.addEventListener("submit", async e => {
  e.preventDefault();
  const urun = urunSelect.value;
  const miktar = parseInt(document.getElementById("miktar").value);
  const islemTuru = document.getElementById("islemTuru").value;
  if (!urun) return bildirim("Lütfen ürün seçin.", "error");
  let kayit = stoklar[urun] || { giren: 0, cikan: 0, kalan: 0 };

  if (stokForm.dataset.duzenlenen) {
    kayit.kalan = miktar;
    stokForm.dataset.duzenlenen = "";
    bildirim("Stok düzenlendi: " + urun + " → kalan: " + miktar);
  } else {
    if (islemTuru === "giris") {
      kayit.giren += miktar;
      kayit.kalan += miktar;
    } else {
      kayit.cikan += miktar;
      kayit.kalan = Math.max(0, kayit.kalan - miktar);
    }
    bildirim("İşlem kaydedildi: " + urun + " → " + islemTuru + " " + miktar);
  }

  await setDoc(doc(db, "stoklar", urun), kayit);

  // Hareket kaydı ekle
  await addDoc(collection(db, "hareketler"), {
    urun: urun,
    miktar: miktar,
    tur: islemTuru,
    tarih: new Date().toISOString().split("T")[0]
  });

  await stoklariYukle();
  await hareketleriYukle();
  stokForm.reset();
});

// ---------------- Yardımcı Fonksiyonlar ----------------
function ekleUrunSecenek(urun) {
  const option = document.createElement("option");
  option.value = urun;
  option.textContent = urun;
  urunSelect.appendChild(option);
}

function tabloyuYenile() {
  tablo.innerHTML = "";
  for (const u in stoklar) {
    const kayit = stoklar[u];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u}</td>
      <td>${kayit.giren}</td>
      <td>${kayit.cikan}</td>
      <td>${kayit.kalan}</td>
      <td>
        <button onclick="duzenleUrun('${u}')">✏ Düzenle</button>
        <button onclick="silUrun('${u}')">🗑 Sil</button>
      </td>
    `;
    tablo.appendChild(tr);
  }
}

// ---------------- Ürün Silme ----------------
window.silUrun = async function(urun) {
  await deleteDoc(doc(db, "stoklar", urun));
  stoklariYukle();
  bildirim("Ürün silindi: " + urun, "error");
}

// ---------------- Ürün Düzenleme ----------------
window.duzenleUrun = function(urun) {
  const kayit = stoklar[urun];
  urunSelect.value = urun;
  document.getElementById("miktar").value = kayit.kalan;
  stokForm.dataset.duzenlenen = urun;
}

// ---------------- Yazdırma ----------------
window.yazdirStok = function() {
  const printContents = document.getElementById("stokTable").outerHTML;
  const w = window.open("", "", "width=800,height=600");
  w.document.write("<h2>Stok Listesi</h2>" + printContents);
  w.document.close();
  w.print();
}

window.yazdirHareket = function() {
  const printContents = document.getElementById("hareketTable").outerHTML;
  const w = window.open("", "", "width=800,height=600");
  w.document.write("<h2>Günlük Hareketler</h2>" + printContents);
  w.document.close();
  w.print();
}

// ---------------- Barkod Okuma ----------------
function startScanner() {
  html5QrCode = new Html5Qrcode("reader");
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      let bulundu = false;
      for (const [urun, kayit] of Object.entries(stoklar)) {
        if (kayit.barkod === decodedText) {
          urunSelect.value = urun;
          bildirim("Barkod okundu: " + urun + " (Barkod: " + decodedText + ")");
          bulundu = true;
          break;
        }
      }
      if (!bulundu) {
        bildirim("Okunan barkod hiçbir ürünle eşleşmedi: " + decodedText, "error");
      }
    }
  ).catch(err => {
    console.error("Kamera başlatılamadı: ", err);
  });
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      console.log("Barkod okuma durduruldu.");
    }).catch(err => {
      console.error("Scanner durduruldu: ", err);
    });
  }
}