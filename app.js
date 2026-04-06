import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDocs, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  // senin firebase config bilgilerin buraya
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let stoklar = {};
let aktifUrun = null;

const urunForm = document.getElementById("urunForm");
const stokBody = document.getElementById("stokBody");

// Ürün ekleme formu
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

// Stokları yükle
async function stoklariYukle() {
  const snapshot = await getDocs(collection(db, "stoklar"));
  stoklar = {};
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
  });
}
stoklariYukle();

// Ürün detay ekranı
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
