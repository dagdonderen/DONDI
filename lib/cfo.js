// Döndi CFO modülü: hesaplamalar kodda yapılır (model rakam uydurmasın diye).
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const r2 = (n) => Math.round(n * 100) / 100;
const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// items: [{name, type:"gelir"|"gider", amount, start_month?, end_month?, growth_pct?, once?}]
export function cashFlow(args = {}) {
  const months = Math.min(Math.max(Math.round(num(args.months, 12)), 1), 36);
  const opening = num(args.opening_balance);
  const items = (Array.isArray(args.items) ? args.items : []).slice(0, 40).map((i) => ({
    name: String(i.name || "Kalem").slice(0, 60),
    income: /gelir|income/i.test(String(i.type)),
    amount: num(i.amount),
    start: Math.max(1, Math.round(num(i.start_month, 1))),
    end: Math.min(months, Math.round(num(i.end_month, months))),
    growth: num(i.growth_pct) / 100,
    once: !!i.once,
  }));
  if (!items.length) return { error: "Gelir/gider kalemi verilmedi." };
  const start = new Date();
  let bal = opening, minBal = opening, minAt = 0, totalIn = 0, totalOut = 0;
  const rows = [];
  for (let m = 1; m <= months; m++) {
    let inc = 0, out = 0;
    for (const it of items) {
      if (m < it.start || m > it.end) continue;
      if (it.once && m !== it.start) continue;
      const v = it.amount * Math.pow(1 + it.growth, m - it.start);
      it.income ? (inc += v) : (out += v);
    }
    bal += inc - out; totalIn += inc; totalOut += out;
    if (bal < minBal) { minBal = bal; minAt = m; }
    const d = new Date(start.getFullYear(), start.getMonth() + m - 1, 1);
    rows.push({ ay: `${AYLAR[d.getMonth()]} ${d.getFullYear()}`, gelir: r2(inc), gider: r2(out), net: r2(inc - out), kapanis_bakiye: r2(bal) });
  }
  return {
    acilis_bakiye: r2(opening), aylar: rows,
    toplam_gelir: r2(totalIn), toplam_gider: r2(totalOut), toplam_net: r2(totalIn - totalOut),
    en_dusuk_bakiye: r2(minBal), en_dusuk_bakiye_ayi: minAt ? rows[minAt - 1].ay : "açılış",
    nakit_acigi_var: minBal < 0,
    ortalama_aylik_gider: r2(totalOut / months),
    nakitle_dayanma_ayi: totalOut > totalIn ? r2(opening / ((totalOut - totalIn) / months)) : null,
  };
}

// Birim maliyet, fiyat, kâr, başabaş
export function costCalc(args = {}) {
  const qty = Math.max(num(args.quantity, 1), 1);
  const mats = num(args.material_cost_per_unit);
  const labor = num(args.labor_cost_per_unit);
  const otherVar = num(args.other_variable_cost_per_unit);
  const fixed = num(args.fixed_costs_total);
  const vat = num(args.vat_pct, 20) / 100;
  const varUnit = mats + labor + otherVar;
  const unitCost = varUnit + fixed / qty;
  let priceEx;
  if (args.selling_price_excl_vat != null) priceEx = num(args.selling_price_excl_vat);
  else if (args.selling_price_incl_vat != null) priceEx = num(args.selling_price_incl_vat) / (1 + vat);
  else if (args.target_margin_pct != null) priceEx = unitCost / (1 - num(args.target_margin_pct) / 100); // satış fiyatı üzerinden marj
  else if (args.target_markup_pct != null) priceEx = unitCost * (1 + num(args.target_markup_pct) / 100);
  else priceEx = null;
  const out = {
    adet: qty, degisken_birim_maliyet: r2(varUnit), sabit_gider_birim_payi: r2(fixed / qty),
    birim_maliyet: r2(unitCost), toplam_maliyet: r2(unitCost * qty), kdv_orani_pct: vat * 100,
  };
  if (priceEx != null) {
    const profit = priceEx - unitCost;
    out.satis_fiyati_kdv_haric = r2(priceEx);
    out.satis_fiyati_kdv_dahil = r2(priceEx * (1 + vat));
    out.birim_kar = r2(profit);
    out.toplam_kar = r2(profit * qty);
    out.kar_marji_pct = priceEx ? r2((profit / priceEx) * 100) : null;
    out.maliyet_uzeri_ekleme_pct = unitCost ? r2((profit / unitCost) * 100) : null;
    const contrib = priceEx - varUnit;
    out.basabas_adedi = contrib > 0 ? Math.ceil(fixed / contrib) : null;
  }
  return out;
}

// Senaryo karşılaştırma: mevcut durum + değişiklik senaryoları
export function scenarioCompare(args = {}) {
  const b = args.base || {};
  const rev = num(b.monthly_revenue), vp = num(b.variable_cost_pct) / 100, fix = num(b.fixed_costs_monthly);
  const months = Math.min(Math.max(Math.round(num(b.months, 12)), 1), 36), open = num(b.opening_cash);
  if (!rev) return { error: "Aylık gelir (monthly_revenue) gerekli." };
  const list = [{ name: "Mevcut durum" }, ...(Array.isArray(args.scenarios) ? args.scenarios.slice(0, 5) : [])];
  const out = list.map((sc) => {
    const p = 1 + num(sc.price_change_pct) / 100, v = 1 + num(sc.volume_change_pct) / 100, c = 1 + num(sc.variable_cost_change_pct) / 100;
    const r = rev * p * v, vc = rev * vp * v * c, f = fix + num(sc.fixed_cost_change), one = num(sc.one_time_cost);
    const profit = r - vc - f, total = profit * months - one, close = open + total;
    const minCash = profit >= 0 ? open - one : Math.min(open - one, close);
    const vr = r ? vc / r : 0;
    return {
      senaryo: String(sc.name || "Senaryo").slice(0, 50), aylik_gelir: r2(r), aylik_degisken_gider: r2(vc), aylik_sabit_gider: r2(f),
      aylik_kar: r2(profit), kar_marji_pct: r2(r ? (profit / r) * 100 : 0), toplam_kar: r2(total), kapanis_nakit: r2(close),
      en_dusuk_nakit: r2(minCash), basabas_aylik_ciro: vr < 1 ? r2(f / (1 - vr)) : null,
    };
  });
  const best = out.reduce((a, x) => (x.kapanis_nakit > a.kapanis_nakit ? x : a), out[0]);
  return { ay: months, acilis_nakit: r2(open), senaryolar: out, en_iyi_senaryo: best.senaryo };
}

export const CFO_DECLS = [
  {
    name: "scenario_compare",
    description: "Mevcut durumu ve 1-5 senaryoyu (fiyat, adet, değişken maliyet, sabit gider değişimi, tek seferlik harcama) yan yana karşılaştırır.",
    parameters: {
      type: "object",
      properties: {
        base: { type: "object", description: "Mevcut durum", properties: {
          monthly_revenue: { type: "number" }, variable_cost_pct: { type: "number", description: "Gelirin yüzde kaçı değişken maliyet" },
          fixed_costs_monthly: { type: "number" }, opening_cash: { type: "number" }, months: { type: "integer" } }, required: ["monthly_revenue"] },
        scenarios: { type: "array", items: { type: "object", properties: {
          name: { type: "string" }, price_change_pct: { type: "number" }, volume_change_pct: { type: "number" },
          variable_cost_change_pct: { type: "number" }, fixed_cost_change: { type: "number", description: "Aylık sabit gider artışı (TL)" }, one_time_cost: { type: "number" } }, required: ["name"] } },
      },
      required: ["base", "scenarios"],
    },
  },
  {
    name: "web_search",
    description: "Güncel bilgi için web'de arar (döviz kuru, faiz, enflasyon, vergi oranı, mevzuat, haber). Kaynak linkleriyle özet döner.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Arama sorgusu (Türkçe veya İngilizce)" } }, required: ["query"] },
  },
  {
    name: "cash_flow_table",
    description: "Aylık nakit akış tablosu hesaplar (gelir, gider, net, kapanış bakiyesi, nakit açığı). Rakamları kullanıcıdan al, uydurma.",
    parameters: {
      type: "object",
      properties: {
        opening_balance: { type: "number", description: "Başlangıç nakit bakiyesi (TL)" },
        months: { type: "integer", description: "Kaç aylık projeksiyon (1-36), varsayılan 12" },
        items: {
          type: "array", description: "Gelir ve gider kalemleri",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string", description: "gelir veya gider" },
              amount: { type: "number", description: "Aylık tutar (once=true ise tek seferlik tutar)" },
              start_month: { type: "integer", description: "Başlangıç ayı (1=bu ay)" },
              end_month: { type: "integer" },
              growth_pct: { type: "number", description: "Aylık yüzde artış" },
              once: { type: "boolean", description: "Tek seferlik mi" },
            },
            required: ["name", "type", "amount"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "cost_calc",
    description: "Birim maliyet, satış fiyatı, kâr marjı, KDV ve başabaş adedi hesaplar.",
    parameters: {
      type: "object",
      properties: {
        quantity: { type: "number", description: "Üretim/satış adedi" },
        material_cost_per_unit: { type: "number" },
        labor_cost_per_unit: { type: "number" },
        other_variable_cost_per_unit: { type: "number" },
        fixed_costs_total: { type: "number", description: "Dönemlik toplam sabit giderler (kira, elektrik vb.)" },
        vat_pct: { type: "number", description: "KDV yüzdesi, varsayılan 20" },
        selling_price_excl_vat: { type: "number" },
        selling_price_incl_vat: { type: "number" },
        target_margin_pct: { type: "number", description: "Satış fiyatı üzerinden hedef kâr marjı %" },
        target_markup_pct: { type: "number", description: "Maliyet üzerine eklenecek %" },
      },
    },
  },
];

export const CFO_TOOLS = { cash_flow_table: cashFlow, cost_calc: costCalc, scenario_compare: scenarioCompare };

export const CFO_RULES = `
Finans (CFO) kuralları: Nakit akışı, maliyet ve "ya şöyle olsaydı" karşılaştırmaları için cash_flow_table, cost_calc ve scenario_compare araçlarını kullan; döviz kuru için get_exchange_rates (TCMB) kullan, kuru asla web_search veya hafızadan verme; faiz, enflasyon, vergi oranı gibi güncel veriler için web_search kullan ve kaynakları belirt; vergi/SGK/vade tarihleri için tarihli set_reminder (at alanı) çağır; rakamı kafandan hesaplama. Eksik veri varsa (tutar, süre, adet, KDV) varsayım uydurma, kısa soru sor. Kullandığın varsayımları sonuçta belirt. Sonucu önce 1-2 cümle yorumla (nakit açığı var mı, hangi ay kritik, marj yeterli mi), sonra gerekirse markdown tablo ver (| sütun | sütun |). Para birimi varsayılan TL. Bu bilgi yatırım/vergi/muhasebe tavsiyesi değildir; önemli kararlarda mali müşavire danış.`;

// ---- Hatırlatıcı / zamanlayıcı / takvim: istemciye "eylem" olarak döner ----
export const ACTION_DECLS = [
  {
    name: "set_reminder",
    description: "Kullanıcı için hatırlatıcı veya zamanlayıcı kurar. 'X dakika sonra' / 'saat 18:00'de' gibi isteklerde kullan. Verilen saati şu anki Türkiye saatine göre dakikaya çevir.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Hatırlatılacak şey, örn. 'İlaç al' veya 'Zamanlayıcı bitti'" },
        in_minutes: { type: "number", description: "Şimdiden kaç dakika sonra (1 - 10080). Tarih verildiyse boş bırak." },
        at: { type: "string", description: "Belirli tarih ve saat için YYYY-MM-DDTHH:mm (Türkiye saati). Ödeme/vade hatırlatmaları için kullan." },
      },
      required: ["text"],
    },
  },
  {
    name: "add_to_calendar",
    description: "Takvime eklenebilir bir etkinlik (.ics) hazırlar. Tarih ve saat Türkiye saatidir.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string", description: "YYYY-MM-DDTHH:mm biçiminde Türkiye saati" },
        duration_minutes: { type: "number", description: "Süre, varsayılan 60" },
        notes: { type: "string" },
      },
      required: ["title", "start"],
    },
  },
];

export function setReminder(a = {}) {
  const text = String(a.text || "Hatırlatıcı").slice(0, 120);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(a.at || ""));
  if (m) {
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3], (m[4] ? +m[4] : 9) - 3, m[5] ? +m[5] : 0); // Türkiye UTC+3
    if (t <= Date.now()) return { error: "Bu tarih geçmişte; ileri bir tarih ver." };
    if (t > Date.now() + 400 * 86400000) return { error: "En fazla 400 gün sonrası kurulabilir." };
    return { ok: true, text, in_minutes: Math.round((t - Date.now()) / 60000), fire_at: t, at: m[0] };
  }
  const min = Math.min(Math.max(Math.round(num(a.in_minutes)), 1), 10080);
  return { ok: true, text, in_minutes: min, fire_at: Date.now() + min * 60000 };
}

export function addToCalendar(a = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(a.start || ""));
  if (!m) return { error: "Tarih biçimi geçersiz; YYYY-MM-DDTHH:mm olmalı." };
  return {
    ok: true, title: String(a.title || "Etkinlik").slice(0, 120), start: m[0].slice(0, 16),
    duration_minutes: Math.min(Math.max(Math.round(num(a.duration_minutes, 60)), 5), 1440),
    notes: String(a.notes || "").slice(0, 300),
  };
}

export const ACTION_TOOLS = { set_reminder: setReminder, add_to_calendar: addToCalendar };
