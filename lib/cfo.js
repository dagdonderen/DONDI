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

export const CFO_DECLS = [
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

export const CFO_TOOLS = { cash_flow_table: cashFlow, cost_calc: costCalc };

export const CFO_RULES = `
Finans (CFO) kuralları: Nakit akışı ve maliyet hesabı için mutlaka cash_flow_table ve cost_calc araçlarını kullan; rakamı kafandan hesaplama. Eksik veri varsa (tutar, süre, adet, KDV) varsayım uydurma, kısa soru sor. Kullandığın varsayımları sonuçta belirt. Sonucu önce 1-2 cümle yorumla (nakit açığı var mı, hangi ay kritik, marj yeterli mi), sonra gerekirse markdown tablo ver (| sütun | sütun |). Para birimi varsayılan TL. Bu bilgi yatırım/vergi/muhasebe tavsiyesi değildir; önemli kararlarda mali müşavire danış.`;
