// Yasal sayfaları legal/*.tpl.html + legal/sirket.json + lib/plans.js'ten üretir (public/ altına).
// Kullanım: node scripts/build_legal.mjs        (eksik alan varsa TASLAK bandı ve [işaretler] ile üretir)
//           node scripts/build_legal.mjs --strict (eksik alan varsa hata verir; yayına çıkmadan önce kullan)
import fs from "node:fs";
import { PLANS } from "../lib/plans.js";

const root = new URL("../", import.meta.url).pathname;
const firma = JSON.parse(fs.readFileSync(root + "legal/sirket.json", "utf8"));
const layout = fs.readFileSync(root + "legal/_layout.html", "utf8");
const strict = process.argv.includes("--strict");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const missing = new Set();
const val = (k) => { const v = firma[k]; if (v === undefined || v === "") { missing.add(k); return `<mark class="todo">[${k}]</mark>`; } return esc(v); };

const TL = (n) => (n ? n.toLocaleString("tr-TR") + " TL" : "Ücretsiz");
const planTable = (seg) => {
  const rows = Object.values(PLANS).filter((p) => seg === "hepsi" || p.segment === seg || (seg === "tuketici" && (p.segment === "bireysel" || p.segment === null)));
  return `<table><thead><tr><th>Plan</th><th>Ücret (KDV dahil)</th><th>Kapsam</th><th>Limitler</th></tr></thead><tbody>${rows.map((p) =>
    `<tr><td><b>${esc(p.ad)}</b></td><td>${p.fiyat.aylik ? `${TL(p.fiyat.aylik)} / ay<br>${TL(p.fiyat.yillik)} / yıl` : "Ücretsiz"}</td><td>${esc(p.ozet)}</td><td>Ayda ${p.limits.mesaj_aylik} mesaj${p.limits.belge_aylik ? `, ayda ${p.limits.belge_aylik} belge analizi` : ""}, ayda ${p.limits.arama_aylik} web arama, günde ${p.limits.tts_gunluk} sesli cevap parçası</td></tr>`).join("")}</tbody></table>`;
};
const satici = () => `<div class="box"><b>${val("unvan")}</b> (${val("isletme_turu")})<br>Vergi dairesi / no: ${val("vergi_dairesi")} / ${val("vergi_no")}<br>MERSİS: ${val("mersis_no")}<br>Adres: ${val("adres")}<br>Telefon: ${val("telefon")} · E-posta: ${val("eposta")}</div>`;

const docs = {
  "abonelik-sartlari": ["Abonelik Şartları", "hepsi"],
  "on-bilgilendirme": ["Ön Bilgilendirme Formu", "tuketici"],
  "mesafeli-satis": ["Mesafeli Satış Sözleşmesi", "tuketici"],
  "iptal-iade": ["İptal ve İade Koşulları", "hepsi"],
  "sirket-hizmet-sozlesmesi": ["Şirket Hizmet Sözleşmesi", "sirket"],
  "yasal": ["Yasal Belgeler", "hepsi"],
};
for (const [slug, [baslik, seg]] of Object.entries(docs)) {
  missing.clear();
  let body = fs.readFileSync(`${root}legal/${slug}.tpl.html`, "utf8")
    .replace("{{SATICI}}", satici).replaceAll("{{SATICI}}", satici())
    .replaceAll("{{PLAN_TABLOSU}}", planTable(seg))
    .replaceAll("{{KEP_SATIRI}}", firma.kep ? ` · KEP: ${esc(firma.kep)}` : "")
    .replace(/\{\{([a-z_]+)\}\}/g, (_, k) => val(k));
  const eksik = [...missing];
  const taslak = !firma.hazir || eksik.length
    ? `<div class="draft"><b>TASLAK.</b> Bu belge henüz yayına hazır değildir${eksik.length ? ` (eksik bilgiler: ${eksik.join(", ")})` : ""}. Ücretli satış başlamadan önce şirket bilgileri doldurulmalı ve bir avukat tarafından gözden geçirilmelidir.</div>` : "";
  if (strict && (eksik.length || !firma.hazir)) { console.error(`HATA ${slug}: eksik alan veya hazir=false`, eksik); process.exitCode = 1; }
  const html = layout.replaceAll("{{BASLIK}}", baslik).replace("{{son_guncelleme}}", esc(firma.son_guncelleme)).replace("{{TASLAK}}", taslak).replace("{{ICERIK}}", () => body);
  fs.writeFileSync(`${root}public/${slug}.html`, html);
  console.log("yazıldı:", slug, eksik.length ? `(eksik: ${eksik.join(", ")})` : "(tam)");
}
