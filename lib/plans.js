// Plan tanımları, imzalı hak belgesi (token) ve kullanım sayaçları.
// Fiyatlar ÖNERİDİR (KDV dahil, TL); beta anketi ve gerçek maliyet ölçümüne göre değiştirilir.
import { createHmac, timingSafeEqual } from "node:crypto";
import { redis, hasRedis } from "./redis.js";

const F = (o) => ({ hesap: false, senaryo: false, analiz: false, belge: false, disari_aktar: false, firdondu: false, ...o });

// limits: mesaj_aylik (aylık toplam), gunluk_mesaj (ani yoğunluğa karşı günlük tavan), belge_aylik, arama_aylik (web arama),
// tts_gunluk (sesli cevap parçası), deneme_aylik (ücretsiz finans denemesi), model ("lite" ucuz, "flash" güçlü)
const L = (o) => ({ mesaj_aylik: 0, gunluk_mesaj: 0, belge_aylik: 0, arama_aylik: 0, tts_gunluk: 0, deneme_aylik: 0, model: "lite", ...o });
export const PLANS = {
  ucretsiz: { ad: "Ücretsiz", segment: null, fiyat: { aylik: 0, yillik: 0 },
    features: F({}), limits: L({ mesaj_aylik: 200, gunluk_mesaj: 15, arama_aylik: 10, tts_gunluk: 9, deneme_aylik: 3 }),
    ozet: "Kişisel asistan. Finans modunda ayda 3 deneme hesabı." },
  bireysel_plus: { ad: "Bireysel Plus", segment: "bireysel", fiyat: { aylik: 149, yillik: 1490 },
    features: F({ hesap: true, disari_aktar: true }), limits: L({ mesaj_aylik: 500, gunluk_mesaj: 40, arama_aylik: 20, tts_gunluk: 30 }),
    ozet: "Bütçe, borç planı, birikim hedefi, kur, gelir-gider tahmini, Excel/PDF çıktı." },
  bireysel_pro: { ad: "Bireysel Pro", segment: "bireysel", fiyat: { aylik: 349, yillik: 3490 },
    features: F({ hesap: true, senaryo: true, analiz: true, belge: true, disari_aktar: true }), limits: L({ mesaj_aylik: 600, gunluk_mesaj: 60, belge_aylik: 20, arama_aylik: 60, tts_gunluk: 75, model: "flash" }),
    ozet: "Plus + ekstre/fatura analizi, senaryo karşılaştırma, bilanço analizi, şüpheli harcama tespiti, kredi risk puanı, uzun belgeden bilgi çekme, yatırım analizi (tavsiyesiz), gelişmiş model." },
  sirket_plus: { ad: "Şirket Plus", segment: "sirket", fiyat: { aylik: 599, yillik: 5990 },
    features: F({ hesap: true, disari_aktar: true }), limits: L({ mesaj_aylik: 800, gunluk_mesaj: 60, arama_aylik: 40, tts_gunluk: 90 }),
    ozet: "Nakit akışı ve gelir-gider tahmini, bütçe, maliyet hesabı, KDV, vergi/SGK hatırlatıcıları, rapor taslağı, çıktılar." },
  sirket_pro: { ad: "Şirket Pro", segment: "sirket", fiyat: { aylik: 1199, yillik: 11990 },
    features: F({ hesap: true, senaryo: true, analiz: true, belge: true, disari_aktar: true }), limits: L({ mesaj_aylik: 1500, gunluk_mesaj: 120, belge_aylik: 60, arama_aylik: 150, tts_gunluk: 180, model: "flash" }),
    ozet: "Plus + senaryolar, bilanço ve oran analizi, şüpheli harcama tespiti, kredi risk puanı, bütçe sapma raporu, uzun belge/mevzuattan bilgi çekme, KAP ve piyasa analizi (tavsiyesiz), gelişmiş model." },
  sirket_promax: { ad: "Şirket Pro Max", segment: "sirket", fiyat: { aylik: 2499, yillik: 24990 },
    features: F({ hesap: true, senaryo: true, analiz: true, belge: true, disari_aktar: true, firdondu: true }), limits: L({ mesaj_aylik: 3000, gunluk_mesaj: 200, belge_aylik: 120, arama_aylik: 300, tts_gunluk: 360, model: "flash" }),
    ozet: "Pro + FIRDÖNDÜ bağlantısı (cari, proje, çek...) ve belgeyi e-postaya gönderme." },
};
// Beta: herkese açık geçici plan (BETA_OPEN=0 ile kapatılır)
export const BETA = { ad: "Beta", segment: null, fiyat: { aylik: 0, yillik: 0 },
  features: F({ hesap: true, senaryo: true, analiz: true, belge: true, disari_aktar: true }), limits: L({ mesaj_aylik: 300, gunluk_mesaj: 30, belge_aylik: 5, arama_aylik: 20, tts_gunluk: 30 }), ozet: "Beta döneminde geçici olarak açık." };


// Planlar ekranında gösterilen özellik kataloğu (tek kaynak: aşağıdaki bayraklar sunucuda da zorlanır)
export const KATALOG = {
  kisisel: [
    "Sesli ve yazılı sohbet; “Döndi!” diyerek uyandırma",
    "Hava durumu, günlük plan, özet, mesaj yazma",
    "Hatırlatıcı kurma ve takvime ekleme",
    "Kamerayla göster ve sor",
    "TCMB döviz kurları",
    "Güncel bilgi için web araması",
  ],
  finans: [
    { ad: "TCMB döviz kurları", flag: null },
    { ad: "Nakit akışı tablosu", flag: "hesap" },
    { ad: "Maliyet ve satış fiyatı hesabı (KDV dahil)", flag: "hesap" },
    { ad: "Bütçe ve bütçe-gerçekleşen sapma tablosu", flag: "hesap" },
    { ad: "Gelir-gider tahmini", flag: "hesap" },
    { ad: "Finansal rapor taslağı (Word/PDF)", flag: "hesap" },
    { ad: "Excel, Word, PDF, CSV çıktısı", flag: "disari_aktar" },
    { ad: "Senaryo karşılaştırma (“fiyat artarsa ne olur?”)", flag: "senaryo" },
    { ad: "Bilanço ve oran analizi", flag: "analiz" },
    { ad: "Şüpheli harcama tespiti", flag: "analiz" },
    { ad: "Kredi risk puanı (içsel gösterge)", flag: "analiz" },
    { ad: "KAP ve piyasa analizi (yatırım tavsiyesi vermez)", flag: "analiz" },
    { ad: "Ekstre, fatura, bilanço yükleyip analiz", flag: "belge" },
    { ad: "Yüzlerce sayfalık belge ve mevzuattan bilgi çekme", flag: "belge" },
    { ad: "Gelişmiş yapay zekâ modeli", flag: "model" },
    { ad: "FIRDÖNDÜ bağlantısı: cari, proje, çek; belgeyi e-postaya gönder (çok yakında)", flag: "firdondu" },
  ],
};

export const betaOpen = () => process.env.BETA_OPEN !== "0";
const b64u = (b) => Buffer.from(b).toString("base64url");

export function signEntitlement({ plan, days = 31, sub = "" }, secret = process.env.PLAN_SECRET) {
  if (!secret) throw new Error("PLAN_SECRET tanımlı değil");
  if (!PLANS[plan]) throw new Error("Bilinmeyen plan: " + plan);
  const body = b64u(JSON.stringify({ p: plan, e: Math.floor(Date.now() / 1000) + Math.round(days * 86400), s: String(sub).slice(0, 64) }));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `v1.${body}.${sig}`;
}

export function verifyEntitlement(token, secret = process.env.PLAN_SECRET) {
  try {
    if (!secret || typeof token !== "string") return null;
    const [v, body, sig] = token.split(".");
    if (v !== "v1" || !body || !sig) return null;
    const want = createHmac("sha256", secret).update(body).digest();
    const got = Buffer.from(sig, "base64url");
    if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
    const d = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!PLANS[d.p] || !(d.e > Date.now() / 1000)) return null;
    return { plan: d.p, exp: d.e, sub: d.s || "" };
  } catch { return null; }
}

// Etkin plan: geçerli belge varsa o; yoksa beta açıksa BETA; değilse ücretsiz.
// Bireysel planlar yalnızca Bireysel alt modda, Şirket planları yalnızca Şirket alt modda geçerlidir.
export function resolvePlan(token, { app = "kisisel", fsub = "bireysel" } = {}) {
  const ent = verifyEntitlement(token);
  let id = "ucretsiz", plan = PLANS.ucretsiz, sub = "", exp = null;
  if (ent) {
    const p = PLANS[ent.plan]; sub = ent.sub; exp = ent.exp;
    const seg = fsub === "isletme" ? "sirket" : "bireysel";
    if (app !== "finans" || p.segment === seg) { id = ent.plan; plan = p; }
    else { id = "ucretsiz"; plan = PLANS.ucretsiz; }
  } else if (betaOpen()) { id = "beta"; plan = BETA; }
  return { id, plan, features: plan.features, limits: plan.limits, sub, exp, beta: id === "beta" };
}

export const publicPlans = () => ({
  beta: betaOpen(), katalog: KATALOG,
  plans: Object.entries(PLANS).map(([id, p]) => ({ id, ad: p.ad, segment: p.segment, fiyat: p.fiyat, ozet: p.ozet, features: p.features, limits: p.limits })),
});

// ---- Sayaçlar (Redis varsa kalıcı, yoksa bellek) ----
const mem = new Map();
export async function bump(key, ttlSec) {
  if (hasRedis()) {
    try {
      const out = await redis([["INCR", `dondi:q:${key}`], ["EXPIRE", `dondi:q:${key}`, ttlSec]]);
      const n = Number(out?.[0]?.result); if (Number.isFinite(n)) return n;
    } catch (e) { console.error("Sayaç hatası:", e?.message); }
  }
  const now = Date.now(); const r = mem.get(key);
  if (!r || r.t < now) { if (mem.size > 20000) mem.clear(); mem.set(key, { n: 1, t: now + ttlSec * 1000 }); return 1; }
  return ++r.n;
}
export const dayKey = () => new Date().toISOString().slice(0, 10);
export const monthKey = () => new Date().toISOString().slice(0, 7);

// Araç kapısı: izin yoksa model ve istemci için hata nesnesi döner, izin varsa null.
export async function gateTool(name, eff, sid) {
  const need = (plan) => ({ error: "plan_gerekli", mesaj: `Bu özellik için ${plan} gerekir. Kullanıcıya menüdeki Planlar bölümünü öner; rakam uydurma.`, upgrade: name });
  const FEAT = { cash_flow_table: "hesap", cost_calc: "hesap", budget_table: "hesap", forecast_series: "hesap", finance_report: "hesap", scenario_compare: "senaryo", balance_sheet_analysis: "analiz", anomaly_detect: "analiz", credit_score: "analiz", kap_search: "analiz" };
  if (FEAT[name]) {
    if (eff.features[FEAT[name]]) { if (name === "kap_search") return await searchQuota(eff, sid); return null; }
    if (eff.limits.deneme_aylik > 0) {
      const n = await bump(`ft:${monthKey()}:${sid}`, 40 * 86400);
      return n <= eff.limits.deneme_aylik ? (name === "kap_search" ? await searchQuota(eff, sid) : null) : { error: "plan_gerekli", mesaj: "Ücretsiz aylık finans deneme hakkı doldu. Kullanıcıya Planlar bölümünü öner.", upgrade: name };
    }
    return need(FEAT[name] === "hesap" ? "Plus plan" : "Pro plan");
  }
  if (name === "web_search") return await searchQuota(eff, sid);
  return null;
}
async function searchQuota(eff, sid) {
  const n = await bump(`ws:${monthKey()}:${sid}`, 40 * 86400);
  return n <= eff.limits.arama_aylik ? null : { error: "limit", mesaj: "Bu ayki web arama hakkı doldu. Bilmediğini uydurma; kullanıcıya hakkın dolduğunu ve Planlar bölümünü söyle.", upgrade: "arama" };
}
