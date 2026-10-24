// Döndi finans araçları (v1.0): bilanço oranları, tahmin, bütçe, anomali, kredi puanı, rapor taslağı.
// Hepsi deterministik hesap yapar; model rakamı kafasından üretmez. Girdi eksikse null döner, uydurma yok.
const num = (v) => { if (v === null || v === undefined || v === "") return null; const n = Number(String(v).replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const r2 = (n) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const div = (a, b) => (a === null || b === null || b === 0 ? null : a / b);
const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const std = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)); };
const pct = (a, b) => (a === null || b === null || b === 0 ? null : ((a - b) / Math.abs(b)) * 100);

// ---------- 1) Bilanço / gelir tablosu oran analizi ----------
const BS_KEYS = ["nakit", "alacaklar", "stoklar", "diger_donen_varliklar", "duran_varliklar", "kisa_vadeli_borclar", "uzun_vadeli_borclar", "ozkaynak", "net_satislar", "satislarin_maliyeti", "faaliyet_kari", "faiz_giderleri", "net_kar", "amortisman"];
function ratios(x) {
  const donen = (x.nakit ?? 0) + (x.alacaklar ?? 0) + (x.stoklar ?? 0) + (x.diger_donen_varliklar ?? 0);
  const hasDonen = [x.nakit, x.alacaklar, x.stoklar, x.diger_donen_varliklar].some((v) => v !== null);
  const donenV = hasDonen ? donen : null;
  const toplamVarlik = donenV !== null || x.duran_varliklar !== null ? (donenV ?? 0) + (x.duran_varliklar ?? 0) : null;
  const toplamBorc = x.kisa_vadeli_borclar !== null || x.uzun_vadeli_borclar !== null ? (x.kisa_vadeli_borclar ?? 0) + (x.uzun_vadeli_borclar ?? 0) : null;
  const brut = x.net_satislar !== null && x.satislarin_maliyeti !== null ? x.net_satislar - x.satislarin_maliyeti : null;
  const out = {
    donen_varliklar: r2(donenV), toplam_varlik: r2(toplamVarlik), toplam_borc: r2(toplamBorc),
    calisma_sermayesi: donenV !== null && x.kisa_vadeli_borclar !== null ? r2(donenV - x.kisa_vadeli_borclar) : null,
    cari_oran: r2(div(donenV, x.kisa_vadeli_borclar)),
    asit_test_orani: r2(div(hasDonen ? (x.nakit ?? 0) + (x.alacaklar ?? 0) : null, x.kisa_vadeli_borclar)),
    nakit_orani: r2(div(x.nakit, x.kisa_vadeli_borclar)),
    borc_varlik_orani_pct: r2(div(toplamBorc, toplamVarlik) !== null ? div(toplamBorc, toplamVarlik) * 100 : null),
    borc_ozkaynak_orani: r2(div(toplamBorc, x.ozkaynak)),
    kisa_vadeli_borc_payi_pct: r2(div(x.kisa_vadeli_borclar, toplamBorc) !== null ? div(x.kisa_vadeli_borclar, toplamBorc) * 100 : null),
    brut_kar: r2(brut),
    brut_kar_marji_pct: r2(div(brut, x.net_satislar) !== null ? div(brut, x.net_satislar) * 100 : null),
    faaliyet_kar_marji_pct: r2(div(x.faaliyet_kari, x.net_satislar) !== null ? div(x.faaliyet_kari, x.net_satislar) * 100 : null),
    net_kar_marji_pct: r2(div(x.net_kar, x.net_satislar) !== null ? div(x.net_kar, x.net_satislar) * 100 : null),
    aktif_karliligi_roa_pct: r2(div(x.net_kar, toplamVarlik) !== null ? div(x.net_kar, toplamVarlik) * 100 : null),
    ozkaynak_karliligi_roe_pct: r2(div(x.net_kar, x.ozkaynak) !== null ? div(x.net_kar, x.ozkaynak) * 100 : null),
    faiz_karsilama_orani: r2(div(x.faaliyet_kari, x.faiz_giderleri)),
    alacak_devir_hizi: r2(div(x.net_satislar, x.alacaklar)),
    alacak_tahsil_suresi_gun: r2(div(x.alacaklar, x.net_satislar) !== null ? div(x.alacaklar, x.net_satislar) * 365 : null),
    stok_devir_hizi: r2(div(x.satislarin_maliyeti, x.stoklar)),
    stok_tutma_suresi_gun: r2(div(x.stoklar, x.satislarin_maliyeti) !== null ? div(x.stoklar, x.satislarin_maliyeti) * 365 : null),
    aktif_devir_hizi: r2(div(x.net_satislar, toplamVarlik)),
    favok: x.faaliyet_kari !== null ? r2(x.faaliyet_kari + (x.amortisman ?? 0)) : null,
  };
  out.net_borc_favok = (() => { const f = out.favok; if (f === null || f <= 0 || toplamBorc === null) return null; return r2((toplamBorc - (x.nakit ?? 0)) / f); })();
  return out;
}
function comments(r) {
  const c = [];
  if (r.cari_oran !== null) c.push(r.cari_oran < 1 ? `Cari oran ${r.cari_oran}: kısa vadeli borçlar dönen varlıkları aşıyor, likidite baskısı var.` : r.cari_oran < 1.5 ? `Cari oran ${r.cari_oran}: sınırda, tahsilat ve vade takibi kritik.` : `Cari oran ${r.cari_oran}: likidite makul görünüyor.`);
  if (r.asit_test_orani !== null && r.asit_test_orani < 0.8) c.push(`Asit-test ${r.asit_test_orani}: stoklar satılmadan kısa vadeli borcu ödemek zor olabilir.`);
  if (r.borc_ozkaynak_orani !== null) c.push(r.borc_ozkaynak_orani > 2 ? `Borç/özkaynak ${r.borc_ozkaynak_orani}: yüksek kaldıraç.` : `Borç/özkaynak ${r.borc_ozkaynak_orani}.`);
  if (r.faiz_karsilama_orani !== null && r.faiz_karsilama_orani < 2) c.push(`Faiz karşılama ${r.faiz_karsilama_orani}: faaliyet kârı faiz yükünü rahat karşılamıyor.`);
  if (r.net_kar_marji_pct !== null) c.push(`Net kâr marjı %${r.net_kar_marji_pct}.`);
  if (r.alacak_tahsil_suresi_gun !== null) c.push(`Ortalama tahsil süresi ${Math.round(r.alacak_tahsil_suresi_gun)} gün.`);
  return c;
}
export function balanceSheet(args = {}) {
  const cur = {}, prev = {}; let any = 0;
  for (const k of BS_KEYS) { cur[k] = num(args[k]); if (cur[k] !== null) any++; prev[k] = num(args.onceki?.[k]); }
  if (!any) return { error: "Bilanço/gelir tablosu kalemi gelmedi. Belgeden ya da kullanıcıdan rakamları al." };
  const r = ratios(cur), out = { donem: String(args.donem || "").slice(0, 40), para_birimi: String(args.para_birimi || "TL").slice(0, 8), oranlar: r, yorumlar: comments(r) };
  if (Object.values(prev).some((v) => v !== null)) {
    const rp = ratios(prev); out.onceki_oranlar = rp;
    out.degisim_pct = {}; for (const k of ["net_satislar", "net_kar", "nakit", "alacaklar", "stoklar", "kisa_vadeli_borclar", "ozkaynak"]) { const d = pct(cur[k], prev[k]); if (d !== null) out.degisim_pct[k] = r2(d); }
  }
  out.eksik_kalemler = BS_KEYS.filter((k) => cur[k] === null);
  out.not = "Oranlar verilen kalemlerden hesaplandı; eksik kalemlere bağlı oranlar boş (null) bırakıldı.";
  return out;
}

// ---------- 2) Gelir/gider tahmini ----------
function linfit(y) { const n = y.length, xs = y.map((_, i) => i), mx = mean(xs), my = mean(y); let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (y[i] - my); sxx += (xs[i] - mx) ** 2; } const b = sxx ? sxy / sxx : 0; return { a: my - b * mx, b }; }
function forecastOne(raw, h, season) {
  const y = raw.map(Number).filter((v) => Number.isFinite(v));
  if (y.length < 3) return { error: "Tahmin için en az 3 dönem veri gerekir." };
  const n = y.length; let method = "doğrusal trend", seas = null;
  const { a, b } = linfit(y);
  let fit = y.map((_, i) => a + b * i);
  if (season && n >= 24) { // mevsimsellik: 12 aylık indeks (trendden sapma ortalaması)
    const idx = Array(12).fill(0), cnt = Array(12).fill(0);
    y.forEach((v, i) => { idx[i % 12] += v - fit[i]; cnt[i % 12]++; });
    seas = idx.map((s, i) => (cnt[i] ? s / cnt[i] : 0)); const m = mean(seas); seas = seas.map((s) => s - m);
    fit = fit.map((f, i) => f + seas[i % 12]); method = "doğrusal trend + 12 aylık mevsimsellik";
  }
  const resid = y.map((v, i) => v - fit[i]); const sd = std(resid);
  const f = []; for (let k = 1; k <= h; k++) { const i = n - 1 + k; let v = a + b * i + (seas ? seas[i % 12] : 0); f.push({ donem: k, tahmin: r2(v), alt: r2(v - 1.28 * sd * Math.sqrt(1 + k / n)), ust: r2(v + 1.28 * sd * Math.sqrt(1 + k / n)) }); }
  const lastAvg = mean(y.slice(-Math.min(3, n)));
  return { yontem: method, veri_sayisi: n, egim_donem_basina: r2(b), son_3_donem_ortalama: r2(lastAvg), tahminler: f, guven_araligi: "yaklaşık %80", guven_notu: n < 12 ? "Veri kısa (<12 dönem); tahmin belirsizliği yüksek." : "Geçmiş eğilimin devamı varsayılır; fiyat/talep şokları dahil değildir." };
}
export function forecast(args = {}) {
  const h = Math.min(24, Math.max(1, Math.round(num(args.ileri_donem) ?? 6)));
  const season = args.mevsimsellik !== false;
  const res = {};
  if (Array.isArray(args.gelir)) res.gelir = forecastOne(args.gelir, h, season);
  if (Array.isArray(args.gider)) res.gider = forecastOne(args.gider, h, season);
  if (!res.gelir && !res.gider) return { error: "En az bir seri (gelir veya gider) gerekir; aylık rakamları sırayla ver." };
  if (res.gelir?.tahminler && res.gider?.tahminler) res.net = res.gelir.tahminler.map((g, i) => ({ donem: g.donem, tahmin: r2(g.tahmin - res.gider.tahminler[i].tahmin) }));
  res.baslangic_ay = String(args.baslangic_ay || "").slice(0, 10);
  res.not = "İstatistiksel projeksiyon, taahhüt değildir. Güvenilirlik veri uzunluğuna bağlıdır.";
  return res;
}

// ---------- 3) Bütçe ve bütçe-gerçekleşen sapma ----------
export function budget(args = {}) {
  const items = (Array.isArray(args.kalemler) ? args.kalemler : []).slice(0, 60).map((i) => ({ kalem: String(i.kalem || "Kalem").slice(0, 60), tur: i.tur === "gelir" ? "gelir" : "gider", butce: num(i.butce), gerceklesen: num(i.gerceklesen) }));
  if (!items.length) return { error: "Bütçe kalemleri gerekli: kalem, tur (gelir/gider), butce ve varsa gerceklesen." };
  const rows = items.map((i) => { const fark = i.butce !== null && i.gerceklesen !== null ? i.gerceklesen - i.butce : null; const dev = fark === null ? null : (i.tur === "gelir" ? fark : -fark); return { ...i, fark: r2(fark), sapma_pct: r2(pct(i.gerceklesen, i.butce)), durum: dev === null ? "gerçekleşen yok" : dev >= 0 ? "olumlu" : "olumsuz" }; });
  const tot = (tur, key) => r2(sum(rows.filter((r) => r.tur === tur && r[key] !== null).map((r) => r[key])));
  const out = { kalemler: rows, toplam_gelir_butce: tot("gelir", "butce"), toplam_gider_butce: tot("gider", "butce"), toplam_gelir_gerceklesen: tot("gelir", "gerceklesen"), toplam_gider_gerceklesen: tot("gider", "gerceklesen") };
  out.butce_net = r2(out.toplam_gelir_butce - out.toplam_gider_butce); out.gerceklesen_net = r2(out.toplam_gelir_gerceklesen - out.toplam_gider_gerceklesen); out.net_fark = r2(out.gerceklesen_net - out.butce_net);
  out.dikkat = rows.filter((r) => r.durum === "olumsuz" && r.sapma_pct !== null && Math.abs(r.sapma_pct) >= 10).map((r) => `${r.kalem}: %${r.sapma_pct} sapma`).slice(0, 8);
  return out;
}

// ---------- 4) Şüpheli işlem / anomali tespiti ----------
export function anomalies(args = {}) {
  const tx = (Array.isArray(args.islemler) ? args.islemler : []).slice(0, 2000).map((t, i) => ({ id: i + 1, tarih: String(t.tarih || "").slice(0, 10), aciklama: String(t.aciklama || "").slice(0, 80), kategori: String(t.kategori || "Genel").slice(0, 40), taraf: String(t.taraf || t.aciklama || "").slice(0, 60).toLowerCase(), tutar: Math.abs(num(t.tutar) ?? NaN) })).filter((t) => Number.isFinite(t.tutar) && t.tutar > 0);
  if (tx.length < 5) return { error: "Anomali analizi için en az 5 işlem gerekir (tarih, açıklama, tutar, kategori)." };
  const flags = new Map(); const add = (t, puan, neden) => { const f = flags.get(t.id) || { islem: t, puan: 0, nedenler: [] }; f.puan = Math.min(100, f.puan + puan); f.nedenler.push(neden); flags.set(t.id, f); };
  // kategori bazlı sağlam (medyan/MAD) aykırı değer
  const byCat = {}; tx.forEach((t) => (byCat[t.kategori] ||= []).push(t));
  for (const [cat, list] of Object.entries(byCat)) {
    const a = list.map((t) => t.tutar); if (a.length < 5) continue; const med = median(a), mad = median(a.map((x) => Math.abs(x - med))) || med * 0.1 || 1;
    list.forEach((t) => { const z = (0.6745 * (t.tutar - med)) / mad; if (z > 3.5) add(t, Math.min(45, 20 + Math.round(z * 3)), `"${cat}" kategorisinin tipik tutarının (${r2(med)}) çok üstünde`); });
  }
  // tekrar eden / mükerrer ödeme: aynı taraf + aynı tutar, 7 gün içinde
  const D = (s) => { const d = Date.parse(s); return Number.isFinite(d) ? d : null; };
  const seen = {}; tx.forEach((t) => { const k = `${t.taraf}|${t.tutar}`; (seen[k] ||= []).push(t); });
  Object.values(seen).forEach((g) => { if (g.length < 2) return; g.sort((x, y) => (D(x.tarih) ?? 0) - (D(y.tarih) ?? 0)); for (let i = 1; i < g.length; i++) { const d1 = D(g[i - 1].tarih), d2 = D(g[i].tarih); if (d1 !== null && d2 !== null && d2 - d1 <= 7 * 86400000) add(g[i], 40, `Mükerrer olabilir: aynı taraf ve tutar ${g[i - 1].tarih} tarihinde de var`); else if (d1 === null || d2 === null) add(g[i], 25, "Aynı taraf ve tutar tekrar ediyor (tarih okunamadı)"); } });
  // onay limitinin hemen altında parçalama
  const limit = num(args.onay_limiti);
  if (limit && limit > 0) { const near = tx.filter((t) => t.tutar < limit && t.tutar >= limit * 0.9); const grp = {}; near.forEach((t) => (grp[t.taraf] ||= []).push(t)); Object.values(grp).forEach((g) => { if (g.length >= 2) g.forEach((t) => add(t, 35, `Onay limitinin (${limit}) hemen altında ve tekrarlı: parçalı harcama şüphesi`)); }); }
  // yuvarlak tutar (büyük ve tam yuvarlak)
  const big = quantile(tx.map((t) => t.tutar), 0.75);
  tx.forEach((t) => { if (t.tutar >= big && t.tutar >= 1000 && t.tutar % 1000 === 0) add(t, 10, "Büyük ve tam yuvarlak tutar (tahmini/ifade edilmiş olabilir)"); });
  // yeni (tek seferlik) tarafa büyük ödeme
  const cnt = {}; tx.forEach((t) => (cnt[t.taraf] = (cnt[t.taraf] || 0) + 1)); const p90 = quantile(tx.map((t) => t.tutar), 0.9);
  tx.forEach((t) => { if (cnt[t.taraf] === 1 && t.tutar >= p90 && tx.length >= 20) add(t, 20, "İlk ve tek işlem yapılan tarafa yüksek tutarlı ödeme"); });
  // hafta sonu (tarih biliniyorsa) ve yüksek tutar
  tx.forEach((t) => { const d = D(t.tarih); if (d !== null) { const g = new Date(d).getUTCDay(); if ((g === 0 || g === 6) && t.tutar >= p90) add(t, 10, "Hafta sonu yapılan yüksek tutarlı işlem"); } });
  const list = [...flags.values()].sort((a, b) => b.puan - a.puan).slice(0, 25).map((f) => ({ no: f.islem.id, tarih: f.islem.tarih, aciklama: f.islem.aciklama, kategori: f.islem.kategori, tutar: r2(f.islem.tutar), risk_puani: f.puan, seviye: f.puan >= 60 ? "yüksek" : f.puan >= 30 ? "orta" : "düşük", nedenler: f.nedenler }));
  return { incelenen_islem: tx.length, isaretlenen: flags.size, yuksek: list.filter((l) => l.seviye === "yüksek").length, orta: list.filter((l) => l.seviye === "orta").length, supheli_islemler: list, not: "İşaretli işlem 'şüpheli'dir, 'hatalı/usulsüz' değildir; belge ve onay kaydıyla doğrulanmalıdır." };
}
function quantile(a, q) { const s = [...a].sort((x, y) => x - y); if (!s.length) return 0; const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi] - s[lo]) * (p - lo); }

// ---------- 5) Kredi risk puanı (içsel karne) ----------
export function creditScore(args = {}) {
  const x = {}; for (const k of BS_KEYS) x[k] = num(args[k]);
  const r = ratios(x);
  const comp = []; // [ad, ağırlık, puan(0-100)|null, gerekçe]
  const band = (v, pts) => { if (v === null) return null; for (const [lim, p] of pts) if (v >= lim) return p; return pts[pts.length - 1][1]; };
  comp.push(["Likidite (cari oran)", 20, band(r.cari_oran, [[2, 100], [1.5, 85], [1.2, 65], [1, 45], [0.8, 25], [-1e9, 10]]), r.cari_oran]);
  comp.push(["Kaldıraç (borç/özkaynak)", 20, r.borc_ozkaynak_orani === null ? null : band(-r.borc_ozkaynak_orani, [[-0.5, 100], [-1, 85], [-2, 65], [-3, 40], [-5, 20], [-1e9, 5]]), r.borc_ozkaynak_orani]);
  comp.push(["Faiz karşılama", 15, band(r.faiz_karsilama_orani, [[6, 100], [3, 85], [2, 65], [1.5, 45], [1, 25], [-1e9, 5]]), r.faiz_karsilama_orani]);
  comp.push(["Net kâr marjı", 15, band(r.net_kar_marji_pct, [[15, 100], [8, 85], [4, 65], [1, 45], [0, 30], [-1e9, 8]]), r.net_kar_marji_pct]);
  comp.push(["Tahsilat süresi", 10, r.alacak_tahsil_suresi_gun === null ? null : band(-r.alacak_tahsil_suresi_gun, [[-30, 100], [-60, 80], [-90, 55], [-120, 35], [-1e9, 15]]), r.alacak_tahsil_suresi_gun]);
  const gec = num(args.gecikmis_odeme_sayisi_12ay); const gecgun = num(args.ortalama_gecikme_gunu);
  comp.push(["Ödeme geçmişi", 20, gec === null ? null : Math.max(0, 100 - gec * 15 - (gecgun ? Math.min(40, gecgun) : 0)), gec]);
  const used = comp.filter((c) => c[2] !== null); if (used.length < 3) return { error: "Puanlama için en az 3 bileşen gerekir: örn. dönen varlık/kısa vadeli borç, borç/özkaynak, faaliyet kârı ve faiz gideri, net satış ve net kâr, gecikmiş ödeme sayısı." };
  const wsum = sum(used.map((c) => c[1])); const score = Math.round(sum(used.map((c) => c[1] * c[2])) / wsum);
  const rating = score >= 80 ? "A (düşük risk)" : score >= 65 ? "B (makul risk)" : score >= 50 ? "C (orta risk)" : score >= 35 ? "D (yüksek risk)" : "E (çok yüksek risk)";
  return { puan: score, derece: rating, bilesenler: comp.map((c) => ({ ad: c[0], agirlik: c[1], puan: c[2], deger: c[3] === null ? null : r2(c[3]) })), kullanilan_agirlik_pct: Math.round((wsum / sum(comp.map((c) => c[1]))) * 100), zayif_yonler: used.filter((c) => c[2] < 45).map((c) => c[0]), guvenilirlik: used.length >= 5 ? "yeterli" : "sınırlı (eksik bileşenler var)", oranlar: r, not: "Bu bir içsel gösterge karnesidir; banka, KKB/Findeks veya resmi kredi notu değildir. Kredi kararı yerine geçmez." };
}

// ---------- 6) Rapor taslağı (istemci Word/PDF'e aktarır) ----------
export function reportDraft(args = {}) {
  const sections = (Array.isArray(args.bolumler) ? args.bolumler : []).slice(0, 12).map((s) => ({ baslik: String(s.baslik || "").slice(0, 120), metin: String(s.metin || "").slice(0, 4000), tablo: s.tablo && Array.isArray(s.tablo.satirlar) ? { baslik: (Array.isArray(s.tablo.sutunlar) ? s.tablo.sutunlar : []).slice(0, 8).map((c) => String(c).slice(0, 40)), satirlar: s.tablo.satirlar.slice(0, 40).map((row) => (Array.isArray(row) ? row : []).slice(0, 8).map((c) => (typeof c === "number" ? c : String(c).slice(0, 60)))) } : null })).filter((s) => s.baslik || s.metin);
  if (!sections.length) return { error: "Rapor için bölümler gerekli (baslik, metin, istersen tablo)." };
  return { baslik: String(args.baslik || "Finansal Rapor Taslağı").slice(0, 120), donem: String(args.donem || "").slice(0, 60), bolumler: sections, taslak: true, uyari: "Taslaktır; resmi finansal tablo veya denetim raporu yerine geçmez. Yayımlamadan önce mali müşavir/denetçi gözden geçirmelidir." };
}

export const FIN_DECLS = [
  { name: "balance_sheet_analysis", description: "Bilanço ve gelir tablosu kalemlerinden likidite, kaldıraç, kârlılık, faaliyet oranlarını ve FAVÖK'ü hesaplar; önceki dönem verilirse değişimi çıkarır. Kullanıcı bilanço/mizan yüklediyse ya da rakam verdiyse rakamları belgeden okuyup bu aracı çağır, oranları kendin hesaplama.", parameters: { type: "object", properties: { donem: { type: "string" }, para_birimi: { type: "string" }, nakit: { type: "number" }, alacaklar: { type: "number" }, stoklar: { type: "number" }, diger_donen_varliklar: { type: "number" }, duran_varliklar: { type: "number" }, kisa_vadeli_borclar: { type: "number" }, uzun_vadeli_borclar: { type: "number" }, ozkaynak: { type: "number" }, net_satislar: { type: "number" }, satislarin_maliyeti: { type: "number" }, faaliyet_kari: { type: "number" }, faiz_giderleri: { type: "number" }, net_kar: { type: "number" }, amortisman: { type: "number" }, onceki: { type: "object", description: "Önceki dönemin aynı alanları", properties: { nakit: { type: "number" }, alacaklar: { type: "number" }, stoklar: { type: "number" }, kisa_vadeli_borclar: { type: "number" }, uzun_vadeli_borclar: { type: "number" }, ozkaynak: { type: "number" }, net_satislar: { type: "number" }, satislarin_maliyeti: { type: "number" }, faaliyet_kari: { type: "number" }, net_kar: { type: "number" } } } } } },
  { name: "forecast_series", description: "Geçmiş aylık gelir ve/veya gider serisinden ileriye dönük tahmin (trend + mevsimsellik, %80 aralık) üretir.", parameters: { type: "object", properties: { gelir: { type: "array", items: { type: "number" }, description: "Aylık gelir serisi, eskiden yeniye" }, gider: { type: "array", items: { type: "number" } }, ileri_donem: { type: "number", description: "Kaç ay ilerisi (1-24)" }, baslangic_ay: { type: "string", description: "Serinin ilk ayı, örn. 2025-01" }, mevsimsellik: { type: "boolean" } } } },
  { name: "budget_table", description: "Bütçe kalemlerini toplar ve gerçekleşenle karşılaştırıp sapmaları (olumlu/olumsuz) çıkarır.", parameters: { type: "object", properties: { kalemler: { type: "array", items: { type: "object", properties: { kalem: { type: "string" }, tur: { type: "string", description: "gelir veya gider" }, butce: { type: "number" }, gerceklesen: { type: "number" } }, required: ["kalem", "tur", "butce"] } } }, required: ["kalemler"] } },
  { name: "anomaly_detect", description: "İşlem/harcama listesinde şüpheli kalemleri bulur: aykırı tutar, mükerrer ödeme, onay limiti altı parçalama, yuvarlak tutar, yeni tarafa yüksek ödeme. 'Şüpheli' demek 'usulsüz' demek değildir.", parameters: { type: "object", properties: { onay_limiti: { type: "number", description: "Varsa harcama onay limiti" }, islemler: { type: "array", items: { type: "object", properties: { tarih: { type: "string", description: "YYYY-MM-DD" }, aciklama: { type: "string" }, tutar: { type: "number" }, kategori: { type: "string" }, taraf: { type: "string", description: "Tedarikçi/karşı taraf" } }, required: ["tutar"] } } }, required: ["islemler"] } },
  { name: "credit_score", description: "Finansal oranlardan ve ödeme geçmişinden 0-100 içsel kredi risk puanı ve derece (A-E) üretir. Resmi kredi notu değildir.", parameters: { type: "object", properties: { nakit: { type: "number" }, alacaklar: { type: "number" }, stoklar: { type: "number" }, diger_donen_varliklar: { type: "number" }, duran_varliklar: { type: "number" }, kisa_vadeli_borclar: { type: "number" }, uzun_vadeli_borclar: { type: "number" }, ozkaynak: { type: "number" }, net_satislar: { type: "number" }, satislarin_maliyeti: { type: "number" }, faaliyet_kari: { type: "number" }, faiz_giderleri: { type: "number" }, net_kar: { type: "number" }, gecikmis_odeme_sayisi_12ay: { type: "number" }, ortalama_gecikme_gunu: { type: "number" } } } },
  { name: "finance_report", description: "Finansal rapor taslağını (başlık, bölümler, tablolar) hazırlar; kullanıcı Word/PDF olarak indirebilir. Metni ve tabloları önce sen yaz (rakamlar araç sonuçlarından), sonra bu aracı çağır.", parameters: { type: "object", properties: { baslik: { type: "string" }, donem: { type: "string" }, bolumler: { type: "array", items: { type: "object", properties: { baslik: { type: "string" }, metin: { type: "string" }, tablo: { type: "object", properties: { sutunlar: { type: "array", items: { type: "string" } }, satirlar: { type: "array", items: { type: "array", items: { type: "string" } } } } } }, required: ["baslik", "metin"] } } }, required: ["bolumler"] } },
  { name: "kap_search", description: "Borsa şirketi için KAP bildirimleri, finansal sonuçlar ve haber/piyasa trendini arar. Yatırım analizi içindir; al/sat/tut tavsiyesi verme.", parameters: { type: "object", properties: { sirket: { type: "string", description: "Şirket adı veya borsa kodu" }, konu: { type: "string", description: "Örn. son bilanço, temettü, sermaye artırımı, sektör trendi" } }, required: ["sirket"] } },
];
export const FIN_TOOLS = { balance_sheet_analysis: balanceSheet, forecast_series: forecast, budget_table: budget, anomaly_detect: anomalies, credit_score: creditScore, finance_report: reportDraft };
export const FIN_RULES = `
Gelişmiş finans: Bilanço/mizan/gelir tablosu yüklenirse veya yapıştırılırsa kalemleri oku, balance_sheet_analysis çağır, sonucu "ne iyi, ne riskli, neye bakmalı" diye özetle. Gelir-gider tahmini için forecast_series; bütçe ve sapma için budget_table; şüpheli harcama için anomaly_detect (sonuçta "şüpheli ≠ usulsüz", doğrulama öner); kredi risk puanı için credit_score (resmi not olmadığını söyle). Rapor taslağında bölümleri kendin yaz, rakamları araç sonuçlarından al, sonra finance_report çağır. Uzun belgelerde sana "BELGE PARÇALARI" verilirse yalnızca onlara dayan, sayfa numarasını belirt, parçada olmayanı uydurma ve "belgede bulamadım" de.
YATIRIM ANALİZİ KURALI: Şirket/piyasa analizinde kap_search ve web_search ile güncel veriyi bul, kaynakları belirt; güçlü/zayıf yönleri, riskleri, senaryoları ve izlenecek göstergeleri ver. AL/SAT/TUT, hedef fiyat, "yükselir/düşer" kesinliği veya kişiye özel yatırım önerisi VERME. Kullanıcı tavsiye isterse nazikçe reddet, analizi sun. Her yatırım analizinin sonunda tek cümle: "Yatırım tavsiyesi değildir; karar sorumluluğu sana aittir."`;
