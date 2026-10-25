// Döndi – Gemini sürümü + canlı hava durumu (Open-Meteo) + kalıcı günlük limit (Upstash Redis)
import { createHash } from "node:crypto";
import { redis, hasRedis } from "../lib/redis.js";
import { RATES_DECL, getExchangeRates } from "../lib/rates.js";
import { resolvePlan, gateTool, bump, monthKey } from "../lib/plans.js";
import { CFO_DECLS, CFO_TOOLS, CFO_RULES, ACTION_DECLS, ACTION_TOOLS } from "../lib/cfo.js";
import { FIN_DECLS, FIN_TOOLS, FIN_RULES } from "../lib/fin.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const DAILY_LIMIT = 30;
const MAX_HISTORY = 12;

const TONES = {
  samimi: "Samimi, sıcak ve arkadaşça bir dille konuş.",
  resmi: "Resmi ve saygılı bir dille konuş.",
  enerjik: "Enerjik, motive edici ve neşeli bir dille konuş.",
  kisa: "Çok kısa ve net cevap ver, gereksiz süsleme yapma.",
};
function profileText(p) {
  if (!p) return "";
  let t = "";
  if (p.name) t += `\nKullanıcının adı: ${p.name}. Ona zaman zaman adıyla hitap et.`;
  if (p.tone) t += `\n${TONES[p.tone]}`;
  const f = p.fin;
  if (f && (f.sektor || f.gelir || f.gider || f.nakit || f.borc)) {
    t += `\nKullanıcının kendi girdiği işletme profili (tahmini; hesaplarda varsayılan olarak kullan ama önemli rakamları teyit et): ` +
      [f.sektor && `sektör: ${f.sektor}`, f.gelir && `aylık gelir: ${f.gelir} TL`, f.gider && `aylık sabit gider: ${f.gider} TL`,
       f.nakit && `mevcut nakit: ${f.nakit} TL`, f.borc && `toplam borç: ${f.borc} TL`, f.kdv != null && `KDV: %${f.kdv}`].filter(Boolean).join(", ") + ".";
  }
  return t;
}

const VOICE_RULES = `
SES MODU: Kullanıcının son mesajı konuşmadan otomatik yazıya çevrildi; ses tanıma hataları olabilir. Kelimeleri bağlama göre doğru anlamına göre yorumla (ör. sana hitaben söylenen "Döndü", "Dönti", "Dondu" = senin adın "Döndi"). Anlam gerçekten belirsizse kısaca teyit et ("... mı demek istedin?"). Cevabın sesli okunacak: tablo ve uzun liste kullanma, 1-3 kısa cümleyle doğal konuş.`;
const IMAGE_RULES = `
Bu mesajla birlikte kullanıcının kamerasından bir kare ya da eklediği bir görsel geldi (loş/parlak ışık için otomatik iyileştirilmiş olabilir). Görüntüye bakarak kısa ve net cevap ver.
- Elindeki nesne sorulursa: nesneyi tanı, ne olduğunu ve gerekirse ne işe yaradığını kısaca söyle. Emin değilsen bunu belirt.
- Çevre sorulursa: görünenleri kısaca anlat.
- Cilt sorulursa: görünen özellikleri (renk, doku, kuruluk, kızarıklık, sivilce gibi) betimle ve genel bakım önerileri ver. Tanı koyma. Ben, yara ya da şüpheli bir değişiklik için dermatoloğa gitmeyi öner.
- Kişileri yüzlerinden tanıma ve kim olduklarını tahmin etme; yalnızca görünür özelliklerini betimle.
- Görüntü bulanık, karanlık ya da belirsizse bunu söyle ve yeniden denemesini iste.\n- Görüntü fatura, fiş, ekstre ya da makbuzsa: satıcı, tarih, kalemler, KDV ve toplam gibi alanları yalnızca görünen rakamlarla çıkar, okunmayanı \"okunamadı\" diye işaretle, sonucu tablo olarak ver ve kullanıcıdan doğrulamasını iste.`;

function systemPrompt(ctx) {
  const now = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "full", timeStyle: "short", timeZone: "Europe/Istanbul",
  }).format(new Date());
  const fin = ctx.app === "finans";
  const modeText = fin
    ? `\nŞu an FİNANS modundasın: rakam odaklı, net ve sakin bir finans asistanısın.` + (ctx.fsub === "isletme"
        ? ` Kullanıcı bir ŞİRKET yetkilisi: nakit akışı, maliyet, marj, KDV, tahsilat/ödeme vadeleri ve vergi/SGK takvimi gibi CFO konularına odaklan.`
        : ` Kullanıcı BİREYSEL finans soruyor: bütçe, gelir-gider, borç ve kredi hesabı, birikim hedefi ve harcama alışkanlıklarına odaklan; işletme jargonundan kaçın.`) + ` Yatırım, hisse, kripto için al/sat/tut önerisi VERME; yalnızca hesap, karşılaştırma ve genel bilgi sun.`
    : `\nŞu an KİŞİSEL modundasın: günlük yaşam, planlama, yazma, öğrenme ve sohbet. Finansal hesap tabloları bu modun işi değil; kullanıcı ayrıntılı nakit akışı, maliyet veya senaryo hesabı isterse Finans moduna geçmesini kısaca öner.`;
  return `Sen Döndi'sin: sıcak, net, hızlı ve profesyonel bir yapay zekâ asistanı.${modeText}
KİMLİK: Seni Alaaddin DAĞDÖNDEREN geliştirdi (DAĞDÖNDEREN markası). "Seni kim yaptı/geliştirdi, sahibin kim" gibi sorularda bunu açıkça söyle: "Beni Alaaddin DAĞDÖNDEREN geliştirdi." Sosyal medya, iletişim veya geliştiriciye ulaşma sorulursa Instagram hesabını ver: @dagdonderen.tr (https://instagram.com/dagdonderen.tr); e-posta: info@dagdonderen.com.tr. Hangi yapay zekâ modelini kullandığın sorulursa cevapları Google Gemini altyapısıyla ürettiğini, uygulamanın ise Alaaddin DAĞDÖNDEREN tarafından geliştirildiğini söyle.
AMAÇ: "Amacın ne, ne işe yararsın" sorulursa bulunduğun bölüme göre cevap ver: ${fin ? (ctx.fsub === "isletme" ? "Finans > Şirket bölümünde amacın işletmelerin nakit akışı, maliyet, marj, KDV, tahsilat/ödeme ve vergi takvimi gibi CFO işlerinde hızlı hesap ve karar desteği vermek; FIRDÖNDÜ muhasebe-ERP ailesinin asistanısın." : "Finans > Bireysel bölümünde amacın kişisel bütçe, gelir-gider, borç/kredi ve birikim hesaplarında yardımcı olmak.") : "Kişisel bölümde amacın günlük işlerde yardımcı olmak: soru-cevap, plan, yazı, özet, hatırlatıcı, hava durumu, kamerayla gösterilen nesneleri ve belgeleri yorumlamak."} Kısa, somut örneklerle anlat.
Kullanıcı hangi dilde yazarsa o dilde cevap ver (varsayılan Türkçe).
Cevapları kısa tut; telefonda okunacağını unutma. Gerekirse madde işareti kullan.
Selamlamayı yalnızca sohbetin ilk mesajında yap; sonraki cevaplarda doğrudan konuya gir.
Döviz kuru (dolar, euro, altın dışı) sorulursa get_exchange_rates aracını kullan; kuru asla hafızandan söyleme, bülten tarihini belirt. Araç hata verirse rakam uydurma, alınamadığını söyle.
Hava durumu sorulursa get_weather aracını kullan. Şehir belirtilmemişse önce hangi şehir olduğunu sor.
Tıbbi, hukuki ve finansal konularda genel bilgi ver, uzmana danışmayı öner.${fin ? CFO_RULES + FIN_RULES : ""}
Hatırlatıcı/zamanlayıcı için set_reminder, takvim için add_to_calendar aracını çağır. Hatırlatıcılar uygulama açıkken bildirim verir; kullanıcıya bunu kısaca belirt.${ctx.doc ? "\nKullanıcı bir belge yükledi (içerik mesajın başında). Analizi yalnızca belgedeki verilere dayandır, belgede olmayan rakamı uydurma; eksik ya da belirsiz yerleri belirt. Gerekirse nakit akışı ve maliyet araçlarını belgedeki rakamlarla kullan." : ""}
Şu an (Türkiye saati): ${now}.${ctx.loc ? `
Kullanıcının yaklaşık konumu biliniyor. Şehir belirtmeden hava durumu sorarsa get_weather aracını city alanını boş bırakarak çağır.` : ""}${ctx.hasImage ? IMAGE_RULES : ""}${ctx.voice ? VOICE_RULES : ""}${profileText(ctx.profile)}`;
}

// ---- Hava durumu aracı ----
const WEATHER_TEXT = (c) => {
  if (c === 0) return "açık";
  if (c <= 2) return "az bulutlu";
  if (c === 3) return "kapalı";
  if (c === 45 || c === 48) return "sisli";
  if (c >= 51 && c <= 57) return "çisenti";
  if (c >= 61 && c <= 67) return "yağmurlu";
  if (c >= 71 && c <= 77) return "karlı";
  if (c >= 80 && c <= 82) return "sağanak yağışlı";
  if (c === 85 || c === 86) return "kar sağanağı";
  if (c >= 95) return "gök gürültülü fırtına";
  return "belirsiz";
};

async function fetchJson(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getWeather(city, loc) {
  const name = String(city || "").trim().slice(0, 80);
  let lat, lon, yer;
  if (name) {
    const g = await fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=tr`
    );
    const p = g?.results?.[0];
    if (!p) return { error: `"${name}" için konum bulunamadı.` };
    lat = p.latitude; lon = p.longitude;
    yer = [p.name, p.admin1, p.country].filter(Boolean).join(", ");
  } else if (loc) {
    lat = loc.lat; lon = loc.lon; yer = "Kullanıcının bulunduğu konum";
  } else {
    return { error: "Şehir adı verilmedi ve konum izni yok." };
  }
  const w = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=3`
  );
  const c = w.current, d = w.daily;
  return {
    yer,
    su_an: {
      durum: WEATHER_TEXT(c.weather_code),
      sicaklik_c: c.temperature_2m,
      hissedilen_c: c.apparent_temperature,
      nem_yuzde: c.relative_humidity_2m,
      ruzgar_kmh: c.wind_speed_10m,
    },
    gunluk: d.time.map((t, i) => ({
      tarih: t,
      durum: WEATHER_TEXT(d.weather_code[i]),
      en_yuksek_c: d.temperature_2m_max[i],
      en_dusuk_c: d.temperature_2m_min[i],
      yagis_olasiligi_yuzde: d.precipitation_probability_max[i],
    })),
  };
}

async function webSearch(query, apiKey) {
  const q = String(query || "").slice(0, 200).trim();
  if (!q) return { error: "Sorgu boş." };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: q + "\n\nKısa, güncel ve kaynaklı yanıt ver. Tarihleri ve rakamları belirt." }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 800 },
      }),
      signal: ctrl.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { console.error("Arama hata:", r.status, JSON.stringify(d).slice(0, 300)); return { error: "Web araması şu an çalışmadı." }; }
    const cand = d.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p) => p.text || "").join("").trim();
    const sources = (cand?.groundingMetadata?.groundingChunks || []).map((c) => c.web).filter(Boolean).slice(0, 4).map((w) => ({ baslik: w.title, adres: w.uri }));
    return text ? { ozet: text.slice(0, 1800), kaynaklar: sources } : { error: "Sonuç bulunamadı." };
  } catch (e) {
    console.error("Arama istek hatası:", e?.message);
    return { error: "Web araması zaman aşımına uğradı." };
  } finally { clearTimeout(timer); }
}

const toolsFor = (app) => [{
  functionDeclarations: [RATES_DECL, ...(app === "finans" ? [...CFO_DECLS, ...FIN_DECLS] : CFO_DECLS.filter((d) => d.name === "web_search")), ...ACTION_DECLS, {
    name: "get_weather",
    description: "Bir şehir için güncel hava durumunu ve 3 günlük tahmini getirir.",
    parameters: {
      type: "object",
      properties: { city: { type: "string", description: "Şehir adı, örn. Kütahya. Kullanıcı şehir söylemediyse boş bırak." } },
          },
  }],
}];

// ---- Gemini çağrısı ----
const NO_THINK = new Set();
function thinkFor(model) {
  const lvl = process.env.GEMINI_THINKING_LEVEL || "low";
  if (lvl === "off" || NO_THINK.has(model) || /tts/i.test(model)) return null;
  return { thinkingLevel: lvl };
}
async function callGemini(model, apiKey, contents, allowTools, ctx) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18000);
  try {
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt(ctx) }] },
      contents,
      tools: toolsFor(ctx.app),
      generationConfig: { maxOutputTokens: ctx.voice ? 700 : 2048 },
    };
    if (!allowTools) body.toolConfig = { functionCallingConfig: { mode: "NONE" } };
    // Hız: düşük düşünme seviyesi (Gemini 3: thinkingLevel). Model desteklemiyorsa bir kez parametresiz tekrar dener.
    const think = thinkFor(model);
    if (think) body.generationConfig.thinkingConfig = think;
    const post = () => fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      }
    );
    let r = await post();
    let data = await r.json();
    if (think && r.status === 400 && /think/i.test(JSON.stringify(data))) {
      NO_THINK.add(model); delete body.generationConfig.thinkingConfig;
      r = await post(); data = await r.json();
    }
    return { r, data };
  } finally {
    clearTimeout(timer);
  }
}

// Bir modeli dener. { text } | { retry: true } | { fatal: true } döner.
// Gerçek maliyeti ölçmek için: günlük, plan bazlı token toplamları (kişisel veri yok)
function logUsage(data, ctx) {
  try {
    const u = data?.usageMetadata; if (!u || !hasRedis()) return;
    const k = `dondi:use:${new Date().toISOString().slice(0, 10)}`, id = ctx?.eff?.id || "?";
    redis([["HINCRBY", k, `${id}|in`, Number(u.promptTokenCount) || 0], ["HINCRBY", k, `${id}|out`, (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0)], ["HINCRBY", k, `${id}|calls`, 1], ["EXPIRE", k, 60 * 60 * 24 * 120]]).catch(() => {});
  } catch {}
}
async function tryModel(model, apiKey, base, ctx) {
  let contents = base;
  const collected = []; // istemciye giden tablolar ve eylemler
  for (let step = 0; step < 5; step++) {
    let res;
    try {
      res = await callGemini(model, apiKey, contents, step < 4, ctx);
    } catch (err) {
      console.error("İstek hatası:", model, err?.name, err?.message);
      return { retry: true };
    }
    const { r, data } = res;
    if (!r.ok) {
      console.error("Gemini hata:", model, r.status, JSON.stringify(data).slice(0, 600));
      return [404, 429, 500, 503].includes(r.status) ? { retry: true } : { fatal: true };
    }
    logUsage(data, ctx);
    const content = data.candidates?.[0]?.content;
    const parts = content?.parts || [];
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length && step < 4) {
      const responses = [];
      for (const { functionCall: fc } of calls) {
        let result;
        try {
          const blocked = await gateTool(fc.name, ctx.eff, ctx.sid);
          if (blocked) {
            result = blocked;
            if (blocked.upgrade) collected.push({ kind: "upgrade", data: { neden: blocked.upgrade } });
          } else if (CFO_TOOLS[fc.name] || FIN_TOOLS[fc.name]) {
            result = (CFO_TOOLS[fc.name] || FIN_TOOLS[fc.name])(fc.args || {});
            if (!result.error) collected.push({ kind: fc.name, data: result, input: fc.args || {} });
          } else if (fc.name === "get_exchange_rates") {
            result = await getExchangeRates(fc.args || {});
          } else if (fc.name === "web_search") {
            result = await webSearch(fc.args?.query, apiKey);
          } else if (fc.name === "kap_search") {
            const sk = String(fc.args?.sirket || "").slice(0, 80).trim(), kn = String(fc.args?.konu || "son finansal sonuçlar ve KAP bildirimleri").slice(0, 100);
            result = sk ? await webSearch(`${sk} ${kn} KAP kap.org.tr son durum ve piyasa görünümü (tavsiye verme, olguları ve tarihleri ver)`, apiKey) : { error: "Şirket adı boş." };
          } else if (ACTION_TOOLS[fc.name]) {
            result = ACTION_TOOLS[fc.name](fc.args || {});
            if (!result.error) collected.push({ kind: fc.name, data: result });
          } else {
            result = await getWeather(fc.args?.city, ctx.loc);
          }
        } catch (e) {
          console.error("Araç hatası:", fc.name, e?.message);
          result = { error: "Araç şu an çalışmadı." };
        }
        responses.push({ functionResponse: { name: fc.name, response: { result } } });
      }
      contents = [...contents, content, { role: "user", parts: responses }];
      continue;
    }
    const text = parts.map((p) => p.text || "").join("\n").trim();
    if (text) return { text, collected };
    console.error("Boş cevap:", model, JSON.stringify(data).slice(0, 500));
    return { retry: true };
  }
  return { retry: true };
}

// ---- Günlük mesaj limiti ----
// Upstash Redis tanımlıysa kalıcı sayaç kullanılır, değilse bellek içi (en iyi çaba) sayaç.

const usage = new Map();
function checkLimitMemory(id, limit = DAILY_LIMIT) {
  const day = new Date().toISOString().slice(0, 10);
  const rec = usage.get(id);
  if (!rec || rec.day !== day) { usage.set(id, { day, count: 1 }); return true; }
  if (rec.count >= limit) return false;
  rec.count++;
  return true;
}

async function checkLimit(ip, limit = DAILY_LIMIT) {
  // IP adresi düz metin olarak saklanmaz, özetlenir (gizlilik)
  const id = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  if (!hasRedis()) return checkLimitMemory(id, limit);
  try {
    const day = new Date().toISOString().slice(0, 10);
    const key = `dondi:rl:${day}:${id}`;
    const out = await redis([["INCR", key], ["EXPIRE", key, 90000]]);
    const count = Number(out?.[0]?.result);
    if (!Number.isFinite(count)) throw new Error("Redis beklenmeyen cevap");
    return count <= limit;
  } catch (e) {
    console.error("Limit sayacı hatası, bellek içi sayaca geçildi:", e?.message);
    return checkLimitMemory(id, limit);
  }
}

function cleanFin(f) {
  if (!f || typeof f !== "object") return null;
  const n = (v) => { const x = Number(v); return Number.isFinite(x) && x >= 0 && x < 1e12 ? Math.round(x) : null; };
  return {
    sektor: String(f.sektor || "").replace(/[^\p{L}\p{N} ,.&/-]/gu, "").trim().slice(0, 60),
    gelir: n(f.gelir), gider: n(f.gider), nakit: n(f.nakit), borc: n(f.borc), kdv: n(f.kdv),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca POST." });

  const { messages, location, image, profile, doc, pdf, app: appIn, fsub: fsubIn, ent } = req.body ?? {};
  const app = appIn === "finans" ? "finans" : "kisisel";
  const fsub = fsubIn === "isletme" ? "isletme" : "bireysel";
  const prof = {
    name: String(profile?.name || "").replace(/[^\p{L}\p{N} '’.-]/gu, "").trim().slice(0, 30),
    tone: Object.hasOwn(TONES, profile?.tone) ? profile.tone : "",
    fin: app === "finans" && fsub === "isletme" ? cleanFin(profile?.fin) : {},
  };
  const img = typeof image === "string" && image.length < 1500000 && /^[A-Za-z0-9+/=]+$/.test(image) ? image : null;
  const docText = doc && typeof doc.text === "string" ? { name: String(doc.name || "belge").replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 80), text: doc.text.slice(0, 40000), cont: doc.cont === true } : null;
  const pdfData = typeof pdf === "string" && pdf.length < 3200000 && /^[A-Za-z0-9+/=]+$/.test(pdf) ? pdf : null;
  const loc = location && Math.abs(location.lat) <= 90 && Math.abs(location.lon) <= 180
    ? { lat: Number(location.lat.toFixed?.(2) ?? location.lat), lon: Number(location.lon.toFixed?.(2) ?? location.lon) } : null;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Mesaj bulunamadı." });
  }
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "bilinmiyor";
  const eff = resolvePlan(ent, { app, fsub });
  const sid = eff.sub || createHash("sha256").update(ip).digest("hex").slice(0, 24);
  const mAy = await bump(`mm:${monthKey()}:${sid}`, 40 * 86400);
  if (mAy > eff.limits.mesaj_aylik) {
    return res.status(429).json({ error: "Bu ayki mesaj hakkın doldu." + (eff.beta ? "" : " Planlar bölümünden planını yükseltebilirsin."), upgrade: "mesaj" });
  }
  if (!(await checkLimit(eff.sub || ip, eff.limits.gunluk_mesaj))) {
    return res.status(429).json({ error: "Günlük mesaj limitine ulaştın. Yarın tekrar dene" + (eff.beta ? "." : " ya da Planlar bölümünden planını yükselt."), upgrade: eff.beta ? undefined : "limit" });
  }
  if (docText || pdfData) {
    if (!eff.features.belge) return res.status(402).json({ error: "Belge analizi Pro planlarda. Menüdeki Planlar bölümüne bak.", upgrade: "belge" });
    // Aynı belge üzerindeki devam soruları yeni belge sayılmaz (mesaj kotası zaten geçerli)
    const n = docText?.cont ? 0 : await bump(`doc:${monthKey()}:${sid}`, 40 * 86400);
    if (n > eff.limits.belge_aylik) return res.status(402).json({ error: "Bu ayki belge analizi hakkın doldu.", upgrade: "belge" });
  }

  const clean = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (!clean.length) return res.status(400).json({ error: "Geçersiz mesaj." });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY tanımlı değil.");
    return res.status(500).json({ error: "Sunucu ayarı eksik (anahtar bulunamadı)." });
  }

  const base = clean.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const lastParts = base[base.length - 1].parts;
  if (docText) lastParts.unshift({ text: `[Yüklenen belge: ${docText.name}]\n${docText.text}\n[Belge sonu]\n\n` });
  if (pdfData) lastParts.unshift({ inlineData: { mimeType: "application/pdf", data: pdfData } });
  if (img) base[base.length - 1].parts.unshift({ inlineData: { mimeType: "image/jpeg", data: img } });

  const models = (eff.limits.model === "lite" ? [FALLBACK_MODEL, MODEL] : [MODEL, FALLBACK_MODEL]).filter((m, i, a) => m && a.indexOf(m) === i);
  const t0 = Date.now();
  for (const model of models) {
    if (Date.now() - t0 > 35000) break; // zaman sınırına yaklaşıldı
    const out = await tryModel(model, apiKey, base, { eff, sid, app, fsub, loc, hasImage: !!img, voice: !!(req.body && req.body.voice), doc: !!(docText || pdfData), profile: prof });
    if (out.text) return res.status(200).json({ reply: out.text, results: out.collected || [] });
    if (out.fatal) break;
  }
  return res.status(500).json({ error: "Şu an cevap veremiyorum. Biraz sonra tekrar dene." });
}
