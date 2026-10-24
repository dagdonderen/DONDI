// TCMB günlük döviz kurları (resmi). Rakamlar koddan gelir, model uydurmaz.
const BASE = "https://www.tcmb.gov.tr/kurlar";
const pad = (n) => String(n).padStart(2, "0");

export const RATES_DECL = {
  name: "get_exchange_rates",
  description: "TCMB (Merkez Bankası) resmi günlük döviz kurlarını getirir (döviz alış/satış, efektif alış/satış). Dolar, euro, sterlin vb. kur soruları için bunu kullan; web_search kullanma. Hafta sonu/tatilde son iş günü bülteni gelir.",
  parameters: {
    type: "object",
    properties: {
      currencies: { type: "array", items: { type: "string" }, description: "Para birimi kodları, örn. [\"USD\",\"EUR\"]. Boşsa USD, EUR, GBP." },
      date: { type: "string", description: "İsteğe bağlı geçmiş tarih, YYYY-MM-DD. Boşsa en güncel bülten." },
    },
  },
};

const num = (s) => { const n = parseFloat(String(s || "").replace(",", ".")); return Number.isFinite(n) ? n : null; };

export function parseTcmb(xml) {
  const head = xml.match(/<Tarih_Date[^>]*Tarih="([^"]+)"[^>]*Bulten_No="([^"]*)"/) || xml.match(/<Tarih_Date[^>]*Bulten_No="([^"]*)"[^>]*Tarih="([^"]+)"/);
  const tarih = head ? (head[1].includes(".") ? head[1] : head[2]) : null;
  const bulten = head ? (head[1].includes(".") ? head[2] : head[1]) : null;
  const rates = {};
  for (const m of xml.matchAll(/<Currency\b([^>]*)>([\s\S]*?)<\/Currency>/g)) {
    const code = (m[1].match(/CurrencyCode="([A-Z]{3})"/) || m[1].match(/Kod="([A-Z]{3})"/) || [])[1];
    if (!code) continue;
    const g = (t) => num((m[2].match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1]);
    const unit = g("Unit") || 1;
    rates[code] = {
      ad: ((m[2].match(/<Isim>([^<]*)<\/Isim>/) || [])[1] || code).trim(),
      birim: unit,
      doviz_alis: g("ForexBuying"), doviz_satis: g("ForexSelling"),
      efektif_alis: g("BanknoteBuying"), efektif_satis: g("BanknoteSelling"),
    };
  }
  return { tarih, bulten, rates };
}

async function get(url) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
  try { const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Dondi/1.0" } }); if (!r.ok) return null; return await r.text(); }
  finally { clearTimeout(t); }
}

export async function getExchangeRates(args = {}) {
  const want = (Array.isArray(args.currencies) && args.currencies.length ? args.currencies : ["USD", "EUR", "GBP"])
    .map((c) => String(c).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3)).filter(Boolean).slice(0, 10);
  let xml = null, used = null;
  const d0 = /^\d{4}-\d{2}-\d{2}$/.test(args.date || "") ? new Date(args.date + "T12:00:00Z") : null;
  try {
    if (!d0) { xml = await get(`${BASE}/today.xml`); if (!xml) xml = await get(`${BASE}/today.xml`); }
    else {
      // Seçilen gün tatilse geriye doğru 6 güne kadar dene
      for (let i = 0; i < 7 && !xml; i++) {
        const d = new Date(d0.getTime() - i * 86400000);
        used = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}${pad(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`;
        xml = await get(`${BASE}/${used}.xml`);
      }
    }
  } catch (e) { console.error("TCMB hata:", e?.message); }
  if (!xml || !xml.includes("<Currency")) return { error: "TCMB kur servisine şu an ulaşılamadı. Rakam uydurma; kullanıcıya kurların alınamadığını söyle ve tcmb.gov.tr/kurlar adresini öner." };
  const p = parseTcmb(xml);
  const out = {};
  for (const c of want) if (p.rates[c]) out[c] = p.rates[c];
  if (!Object.keys(out).length) return { error: "İstenen para birimi TCMB bülteninde yok.", mevcut: Object.keys(p.rates).join(", ") };
  return { kaynak: "TCMB", bulten_tarihi: p.tarih, bulten_no: p.bulten, kurlar_TL: out, not: "Bülten iş günlerinde yaklaşık 15:30'da yayımlanır; hafta sonu ve tatilde son iş günü bülteni gösterilir. 'birim' alanı kaç birim yabancı paranın TL karşılığı olduğunu gösterir (ör. JPY 100)." };
}
