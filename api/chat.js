// Döndi – Gemini sürümü + canlı hava durumu (Open-Meteo) + kalıcı günlük limit (Upstash Redis)
import { createHash } from "node:crypto";
import { CFO_DECLS, CFO_TOOLS, CFO_RULES, ACTION_DECLS, ACTION_TOOLS } from "../lib/cfo.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const DAILY_LIMIT = 30;
const MAX_HISTORY = 20;

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
  return t;
}

const IMAGE_RULES = `
Bu mesajla birlikte kullanıcının kamerasından tek bir kare geldi. Görüntüye bakarak kısa ve net cevap ver.
- Elindeki nesne sorulursa: nesneyi tanı, ne olduğunu ve gerekirse ne işe yaradığını kısaca söyle. Emin değilsen bunu belirt.
- Çevre sorulursa: görünenleri kısaca anlat.
- Cilt sorulursa: görünen özellikleri (renk, doku, kuruluk, kızarıklık, sivilce gibi) betimle ve genel bakım önerileri ver. Tanı koyma. Ben, yara ya da şüpheli bir değişiklik için dermatoloğa gitmeyi öner.
- Kişileri yüzlerinden tanıma ve kim olduklarını tahmin etme; yalnızca görünür özelliklerini betimle.
- Görüntü bulanık, karanlık ya da belirsizse bunu söyle ve yeniden denemesini iste.`;

function systemPrompt(ctx) {
  const now = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "full", timeStyle: "short", timeZone: "Europe/Istanbul",
  }).format(new Date());
  return `Sen Döndi'sin: sıcak, net ve yardımsever bir kişisel asistan. Dağdönderen tarafından geliştirildin.
Kullanıcı hangi dilde yazarsa o dilde cevap ver (varsayılan Türkçe).
Cevapları kısa tut; telefonda okunacağını unutma. Gerekirse madde işareti kullan.
Selamlamayı yalnızca sohbetin ilk mesajında yap; sonraki cevaplarda doğrudan konuya gir.
Hava durumu sorulursa get_weather aracını kullan. Şehir belirtilmemişse önce hangi şehir olduğunu sor.
Tıbbi, hukuki ve finansal konularda genel bilgi ver, uzmana danışmayı öner.${CFO_RULES}
Hatırlatıcı/zamanlayıcı için set_reminder, takvim için add_to_calendar aracını çağır. Hatırlatıcılar uygulama açıkken bildirim verir; kullanıcıya bunu kısaca belirt.${ctx.doc ? "\nKullanıcı bir belge yükledi (içerik mesajın başında). Analizi yalnızca belgedeki verilere dayandır, belgede olmayan rakamı uydurma; eksik ya da belirsiz yerleri belirt. Gerekirse nakit akışı ve maliyet araçlarını belgedeki rakamlarla kullan." : ""}
Şu an (Türkiye saati): ${now}.${ctx.loc ? `
Kullanıcının yaklaşık konumu biliniyor. Şehir belirtmeden hava durumu sorarsa get_weather aracını city alanını boş bırakarak çağır.` : ""}${ctx.hasImage ? IMAGE_RULES : ""}${profileText(ctx.profile)}`;
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

const TOOLS = [{
  functionDeclarations: [...CFO_DECLS, ...ACTION_DECLS, {
    name: "get_weather",
    description: "Bir şehir için güncel hava durumunu ve 3 günlük tahmini getirir.",
    parameters: {
      type: "object",
      properties: { city: { type: "string", description: "Şehir adı, örn. Kütahya. Kullanıcı şehir söylemediyse boş bırak." } },
          },
  }],
}];

// ---- Gemini çağrısı ----
async function callGemini(model, apiKey, contents, allowTools, ctx) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18000);
  try {
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt(ctx) }] },
      contents,
      tools: TOOLS,
      generationConfig: { maxOutputTokens: 2048 },
    };
    if (!allowTools) body.toolConfig = { functionCallingConfig: { mode: "NONE" } };
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      }
    );
    const data = await r.json();
    return { r, data };
  } finally {
    clearTimeout(timer);
  }
}

// Bir modeli dener. { text } | { retry: true } | { fatal: true } döner.
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
    const content = data.candidates?.[0]?.content;
    const parts = content?.parts || [];
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length && step < 4) {
      const responses = [];
      for (const { functionCall: fc } of calls) {
        let result;
        try {
          if (CFO_TOOLS[fc.name]) {
            result = CFO_TOOLS[fc.name](fc.args || {});
            if (!result.error) collected.push({ kind: fc.name, data: result, input: fc.args || {} });
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
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const usage = new Map();
function checkLimitMemory(id) {
  const day = new Date().toISOString().slice(0, 10);
  const rec = usage.get(id);
  if (!rec || rec.day !== day) { usage.set(id, { day, count: 1 }); return true; }
  if (rec.count >= DAILY_LIMIT) return false;
  rec.count++;
  return true;
}

async function checkLimit(ip) {
  // IP adresi düz metin olarak saklanmaz, özetlenir (gizlilik)
  const id = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  if (!REDIS_URL || !REDIS_TOKEN) return checkLimitMemory(id);
  try {
    const day = new Date().toISOString().slice(0, 10);
    const key = `dondi:rl:${day}:${id}`;
    const r = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, 90000]]),
    });
    if (!r.ok) throw new Error("Redis HTTP " + r.status);
    const out = await r.json();
    const count = Number(out?.[0]?.result);
    if (!Number.isFinite(count)) throw new Error("Redis beklenmeyen cevap");
    return count <= DAILY_LIMIT;
  } catch (e) {
    console.error("Limit sayacı hatası, bellek içi sayaca geçildi:", e?.message);
    return checkLimitMemory(id);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca POST." });

  const { messages, location, image, profile, doc, pdf } = req.body ?? {};
  const prof = {
    name: String(profile?.name || "").replace(/[^\p{L}\p{N} '’.-]/gu, "").trim().slice(0, 30),
    tone: Object.hasOwn(TONES, profile?.tone) ? profile.tone : "",
  };
  const img = typeof image === "string" && image.length < 1500000 && /^[A-Za-z0-9+/=]+$/.test(image) ? image : null;
  const docText = doc && typeof doc.text === "string" ? { name: String(doc.name || "belge").replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 80), text: doc.text.slice(0, 40000) } : null;
  const pdfData = typeof pdf === "string" && pdf.length < 3200000 && /^[A-Za-z0-9+/=]+$/.test(pdf) ? pdf : null;
  const loc = location && Math.abs(location.lat) <= 90 && Math.abs(location.lon) <= 180
    ? { lat: Number(location.lat.toFixed?.(2) ?? location.lat), lon: Number(location.lon.toFixed?.(2) ?? location.lon) } : null;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Mesaj bulunamadı." });
  }
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "bilinmiyor";
  if (!(await checkLimit(ip))) {
    return res.status(429).json({ error: "Günlük mesaj limitine ulaştın. Yarın tekrar dene." });
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

  const models = [MODEL, FALLBACK_MODEL].filter((m, i, a) => m && a.indexOf(m) === i);
  const t0 = Date.now();
  for (const model of models) {
    if (Date.now() - t0 > 35000) break; // zaman sınırına yaklaşıldı
    const out = await tryModel(model, apiKey, base, { loc, hasImage: !!img, doc: !!(docText || pdfData), profile: prof });
    if (out.text) return res.status(200).json({ reply: out.text, results: out.collected || [] });
    if (out.fatal) break;
  }
  return res.status(500).json({ error: "Şu an cevap veremiyorum. Biraz sonra tekrar dene." });
}
