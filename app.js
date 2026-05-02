// --- FIREBASE MODÜLLERİ ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// initializeFirestore, doc, setDoc, writeBatch ve deleteDoc eksikti, onları ekledik:
import { 
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// --- KONFİGÜRASYON ---
const firebaseConfig = {
    apiKey: "AIzaSyBdxkBa8K77nnLVFefpyzS-ACuxuZhhPc8",
    authDomain: "stok-app-ca168.firebaseapp.com",
    projectId: "stok-app-ca168",
    storageBucket: "stok-app-ca168.appspot.com",
    messagingSenderId: "599049285321",
    appId: "1:599049285321:web:0c51fb5f9331ac4e20e718"
};

// --- BAŞLATMA ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- DEĞİŞKENLER ---
let stoklar = {};
let sepet = [];
let html5QrCode = null;
let modalQrCode = null;
let seciliUrunId = "";

// --- YARDIMCI FONKSİYONLAR ---
function karakterTemizle(metin) {
    if (!metin) return "";
    const harfHaritasi = { 'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ş':'s','Ş':'S','ü':'u','Ü':'U','ö':'o','Ö':'O','ı':'i','İ':'I' };
    return metin.replace(/[çÇğĞşŞüÜöÖıİ]/g, (harf) => harfHaritasi[harf]);
}

// --- VERİ ÇEKME ---
function verileriGetir() {
    onSnapshot(collection(db, "stoklar"), (snap) => {
        stoklar = {};
        const urunSelect = document.getElementById("urunSelect");
        if (urunSelect) urunSelect.innerHTML = '<option value="">Ürün Seçin</option>';

        snap.forEach((d) => {
            const veri = d.data();
            stoklar[d.id] = { id: d.id, ...veri };
            if (urunSelect) {
                const option = document.createElement("option");
                option.value = d.id;
                option.textContent = veri.urunAd || d.id;
                urunSelect.appendChild(option);
            }
        });
        stoklariListele();
    });
}

function stoklariListele() {
    const tabloGovde = document.getElementById('tablo');
    if (!tabloGovde) return;

    let tabloHTML = "";
    let toplamAdet = 0;
    let kritikSayisi = 0;

    // Gruplandırma
    let gruplar = {};
    Object.values(stoklar).forEach(u => {
        const g = u.grup || "Genel";
        if (!gruplar[g]) gruplar[g] = [];
        gruplar[g].push(u);
    });

    Object.keys(gruplar).sort().forEach((grupAd, idx) => {
        const grupId = `grup-${idx}`;
        tabloHTML += `
            <tr onclick="grupToggle('${grupId}')" style="cursor:pointer; background:#f1c40f;">
                <td colspan="3" style="font-weight:bold; padding:10px;">📂 ${grupAd}</td>
            </tr>`;
        
        gruplar[grupAd].forEach(u => {
            const miktar = parseInt(u.kalan) || 0;
            const kritik = parseInt(u.kritik) || 5;
            toplamAdet += miktar;
            if(miktar <= kritik) kritikSayisi++;

            tabloHTML += `
                <tr class="${grupId}" onclick="detayGoster('${u.id}')" style="display:none; cursor:pointer;">
                    <td style="padding-left:20px;">${u.urunAd || u.id}</td>
                    <td style="font-weight:bold; color:${miktar <= kritik ? 'red' : 'inherit'}">${miktar}</td>
                    <td style="text-align:center;"><button onclick="event.stopPropagation(); urunSil('${u.id}')">✖</button></td>
                </tr>`;
        });
    });

    tabloGovde.innerHTML = tabloHTML;
    document.getElementById('dashToplam').innerText = toplamAdet;
    document.getElementById('dashKritik').innerText = kritikSayisi;
}

// --- İŞLEMLER ---
async function urunEkle() {
    const ad = document.getElementById('urunAdi').value.trim();
    const barkod = document.getElementById('urunBarkod').value.trim();
    if (!ad) return alert("Ürün adı şart!");

    try {
        const yeniRef = doc(collection(db, "stoklar"));
await setDoc(yeniRef, {
            urunAd: ad,
            barkod: barkod,
            kalan: 0,
            kritik: 5,
            grup: "Genel"
        });
        alert("Eklendi!");
    } catch (e) { alert(e.message); }
}

async function stokIslem(tip) {
    const id = document.getElementById('urunSelect').value;
   const miktar = Number(document.getElementById('islemMiktar').value);
if (!miktar || miktar <= 0) return alert("Geçerli miktar gir!");
    if (!id || !miktar) return alert("Eksik bilgi!");
    if (!stoklar[id]) return alert("Ürün bulunamadı!");
    
    return alert("Yetersiz stok!");
    const yeni = tip === 'giris'
    ? stoklar[id].kalan + miktar
    : stoklar[id].kalan - miktar;
}
    
    try {
        const batch = writeBatch(db);
        batch.update(doc(db, "stoklar", id), { kalan: yeni });
        batch.set(doc(collection(db, "hareketler")), {
            urunId: id, urun: stoklar[id].urunAd, tur: tip, miktar: miktar, tarih: Timestamp.now()
        });
        await batch.commit();
        alert("Başarılı!");
        document.getElementById('islemMiktar').value = "";
        document.getElementById('urunAdi').value = "";
        document.getElementById('urunBarkod').value = "";
    } catch (e) { alert(e.message); }
}

// --- GLOBAL ATAMALAR (MODÜL KORUMASI) ---
window.sekmeAc = function(evt, name) {
    document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(name).style.display = "block";
    evt.currentTarget.classList.add("active");
};

window.grupToggle = function(id) {
    const rows = document.getElementsByClassName(id);
    for (let r of rows) r.style.display = r.style.display === "none" ? "table-row" : "none";
};

window.detayGoster = async function(id) {
    seciliUrunId = id;
    const u = stoklar[id];
    document.getElementById('modalUrunAd').value = u.urunAd;
    document.getElementById('modalMiktar').value = u.kalan;
    document.getElementById('detayModal').style.display = 'block';
    document.getElementById('modalBarkod').value = u.barkod || "";
    document.getElementById('modalKritik').value = u.kritik || 5;
    document.getElementById('modalGrup').value = u.grup || "Genel";
};

window.urunEkle = urunEkle;
window.stokIslem = stokIslem;
window.urunSil = async (id) => { if(confirm("Sil?")) await deleteDoc(doc(db,"stoklar",id)); };
async function bugunOzetiniGetir() {
    const baslangic = new Date();
    baslangic.setHours(0, 0, 0, 0);
    const baslangicTimestamp = Timestamp.fromDate(baslangic);
    
    // Doğru kullanım: collection(db, "isim")
    const q = query(collection(db, "hareketler"), where("tarih", ">=", baslangicTimestamp));
    const querySnapshot = await getDocs(q);
    
    let bugunToplam = 0;
    querySnapshot.forEach((doc) => {
        if(doc.data().tur === 'giris') bugunToplam += doc.data().miktar;
    });
    document.getElementById('dashGiris').innerText = bugunToplam;
}
// --- GEÇİCİ BOŞ FONKSİYONLAR ---
window.anaKameraBaslat = () => alert("Kamera henüz aktif değil");
window.anaKameraDurdur = () => {};
window.yeniUrunKameraBaslat = () => alert("Kamera henüz aktif değil");
window.yeniUrunKameraDurdur = () => {};
window.sepeteEkle = () => {
    const id = document.getElementById('urunSelect').value;
    const miktar = Number(document.getElementById('islemMiktar').value);

    if (!id) return alert("Ürün seç!");
    if (!miktar || miktar <= 0) return alert("Geçerli miktar gir!");

    const urun = stoklar[id];
    if (!urun) return alert("Ürün bulunamadı!");

    sepet.push({
        id: id,
        ad: urun.urunAd, // ✅ DÜZELTİLDİ
        miktar: miktar
    });

    sepetiGoster();
};
function sepetiGoster() {
    const liste = document.getElementById("sepetListesi");
    const butonlar = document.getElementById("sepetButonlar");

    if (!liste) return;

    liste.innerHTML = "";

    sepet.forEach((u, i) => {
        liste.innerHTML += `
            <div style="padding:5px; border-bottom:1px solid #eee;">
                ${u.ad} - ${u.miktar}
                <button onclick="sepettenSil(${i})">❌</button>
            </div>
        `;
    });

   if (butonlar) {
    butonlar.style.display = sepet.length ? "flex" : "none";
}
}

window.sepettenSil = (index) => {
    sepet.splice(index, 1);
    sepetiGoster();
};
window.topluIslem = async (tip) => {
    if (sepet.length === 0) return alert("Sepet boş!");

    try {
        const batch = writeBatch(db);

        sepet.forEach(item => {
            const mevcut = stoklar[item.id].kalan;
            const yeni = tip === 'giris' 
                ? mevcut + item.miktar 
                : mevcut - item.miktar;
                if (tip === 'cikis' && mevcut < item.miktar) {
    throw new Error(item.ad + " için stok yetersiz!");
}

            batch.update(doc(db, "stoklar", item.id), { kalan: yeni });

            batch.set(doc(collection(db, "hareketler")), {
                urunId: item.id,
                urun: item.ad,
                tur: tip,
                miktar: item.miktar,
                tarih: Timestamp.now()
            });
        });

        await batch.commit();

        alert("Toplu işlem başarılı!");
        sepet = [];
        sepetiGoster();

    } catch (e) {
        alert(e.message);
    }
};
window.raporOlustur = () => alert("Rapor sistemi yakında");
window.excelIndir = () => alert("Excel yakında");
window.pdfIndir = () => alert("PDF yakında");
window.siparisListesiPDF = () => alert("PDF yakında");
window.siparisListesiYazdir = () => window.print();
window.urunGuncelle = () => alert("Güncelleme yakında");
window.tabloFiltrele = () => {};
window.addEventListener("DOMContentLoaded", () => {
    verileriGetir();
    bugunOzetiniGetir();
});