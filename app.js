const urunForm = document.getElementById("urunForm");
const stokForm = document.getElementById("stokForm");
const urunSelect = document.getElementById("urun");
const tablo = document.querySelector("#stokTablosu tbody");

let stoklar = JSON.parse(localStorage.getItem("stoklar")) || {};
let urunler = JSON.parse(localStorage.getItem("urunler")) || [];

// Sayfa açıldığında ürünleri ve stokları yükle
window.addEventListener("load", () => {
  urunSelect.innerHTML = '<option value="">Ürün seçin</option>';
  urunler.forEach(urun => ekleUrunSecenek(urun));
  tabloyuYenile();
});

function stokGrafikCiz() {
  const ctx = document.getElementById("stokChart").getContext("2d");
  const labels = Object.keys(stoklar);
  const data = Object.values(stoklar).map(k => k.kalan);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Kalan Stok',
        data: data,
        backgroundColor: '#3498db'
      }]
    }
  });
}


// Yeni ürün ekleme
urunForm.addEventListener("submit", e => {
  e.preventDefault();
  const urunAdi = document.getElementById("urunAdi").value.trim();
  if (urunAdi && !urunler.includes(urunAdi)) {
    urunler.push(urunAdi);
    localStorage.setItem("urunler", JSON.stringify(urunler));
    ekleUrunSecenek(urunAdi);
  }
  urunForm.reset();
});

function ekleUrunSecenek(urun) {
  const option = document.createElement("option");
  option.value = urun;
  option.textContent = urun;
  urunSelect.appendChild(option);
}

// Stok işlemleri
stokForm.addEventListener("submit", e => {
  e.preventDefault();
  const urun = urunSelect.value;
  const miktar = parseInt(document.getElementById("miktar").value);
  const islemTuru = document.getElementById("islemTuru").value;

  if (!urun) {
    alert("Lütfen ürün seçin.");
    return;
  }

  if (stokForm.dataset.duzenlenen) {
    // Düzenleme modunda
    stoklar[urun].kalan = miktar;
    stokForm.dataset.duzenlenen = "";
  } else {
    // Normal giriş/çıkış
    if (!stoklar[urun]) {
      stoklar[urun] = { giren: 0, cikan: 0, kalan: 0 };
    }

    if (islemTuru === "giris") {
      stoklar[urun].giren += miktar;
      stoklar[urun].kalan += miktar;
    } else {
      stoklar[urun].cikan += miktar;
      stoklar[urun].kalan -= miktar;
      if (stoklar[urun].kalan < 0) stoklar[urun].kalan = 0;
    }
  }

  localStorage.setItem("stoklar", JSON.stringify(stoklar));
  tabloyuYenile();
  stokForm.reset();
});

function ekleSatir(urun, kayit) {
  const satir = document.createElement("tr");
  satir.innerHTML = `
    <td>${urun}</td>
    <td>${kayit.giren}</td>
    <td>${kayit.cikan}</td>
    <td>${kayit.kalan}</td>
    <td>
      <button class="duzenle">Düzenle</button>
      <button class="sil">Sil</button>
    </td>
  `;
  tablo.appendChild(satir);

  // Silme
  satir.querySelector(".sil").addEventListener("click", () => {
    delete stoklar[urun];
    localStorage.setItem("stoklar", JSON.stringify(stoklar));
    tabloyuYenile();
  });

  // Düzenleme
  satir.querySelector(".duzenle").addEventListener("click", () => {
    document.getElementById("urun").value = urun;
    document.getElementById("miktar").value = kayit.kalan;
    document.getElementById("islemTuru").value = "giris";
    stokForm.dataset.duzenlenen = urun;
  });
}

function tabloyuYenile() {
  const arama = document.getElementById("stokArama").value.toLowerCase();
  tablo.innerHTML = "";
  for (const u in stoklar) {
    if (arama && !u.toLowerCase().includes(arama)) continue; // filtreleme
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
document.getElementById("stokArama").addEventListener("input", tabloyuYenile);


  // Özet satırı ekle
  const ozetSatir = document.createElement("tr");
  ozetSatir.style.fontWeight = "bold";
  ozetSatir.innerHTML = `
    <td>TOPLAM</td>
    <td>${toplamGiris}</td>
    <td>${toplamCikis}</td>
    <td>${toplamKalan}</td>
    <td></td>
  `;
  tablo.appendChild(ozetSatir);


// Yazdırma sadece liste (İşlem sütunu hariç)
document.getElementById("yazdir").addEventListener("click", () => {
  const tabloClone = document.getElementById("stokTablosu").cloneNode(true);

  // "İşlem" başlığını kaldır
  const thList = tabloClone.querySelectorAll("th");
  thList.forEach(th => {
    if (th.textContent.trim() === "İşlem") {
      th.remove();
    }
  });

  // Satırlardaki son hücreyi kaldır
  const trList = tabloClone.querySelectorAll("tr");
  trList.forEach(tr => {
    const tdList = tr.querySelectorAll("td");
    if (tdList.length > 0) {
      tdList[tdList.length - 1].remove();
    }
  });

  const newWindow = window.open("", "", "width=800,height=600");
  newWindow.document.write("<html><head><title>Stok Listesi</title>");
  newWindow.document.write("<style>table{width:100%;border-collapse:collapse;}th,td{border:1px solid #333;padding:8px;text-align:center;} tr:last-child{font-weight:bold;}</style>");
  newWindow.document.write("</head><body>");
  newWindow.document.write("<h2>Stok Listesi</h2>");
  newWindow.document.write(tabloClone.outerHTML);
  newWindow.document.write("</body></html>");
  newWindow.document.close();
  newWindow.print();
  // Barkod tarayıcıyı başlat
function startScanner() {
  Quagga.init({
    inputStream: {
      type: "LiveStream",
      target: document.querySelector('#barcodeScanner'),
      constraints: {
        facingMode: "environment" // arka kamera
      }
    },
    decoder: {
      readers: ["ean_reader", "code_128_reader"] // yaygın barkod tipleri
    }
  }, function(err) {
    if (err) {
      console.error(err);
      return;
    }
    Quagga.start();
  });

  Quagga.onDetected(function(result) {
    const code = result.codeResult.code;
    document.getElementById("barcodeResult").textContent = "Barkod: " + code;

    // Barkod ürün listesinde varsa otomatik seç
    if (urunler.includes(code)) {
      urunSelect.value = code;
    } else {
      // Yoksa yeni ürün olarak ekle
      urunler.push(code);
      stoklar[code] = { giren: 0, cikan: 0, kalan: 0 };
      localStorage.setItem("urunler", JSON.stringify(urunler));
      localStorage.setItem("stoklar", JSON.stringify(stoklar));
      ekleUrunSecenek(code);
      tabloyuYenile();
      urunSelect.value = code;
    }
  });
}

// Sayfa açıldığında barkod tarayıcıyı başlat
window.addEventListener("load", () => {
  startScanner();
});

});
