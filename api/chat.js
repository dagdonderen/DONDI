// Döndi – Gemini sürümü + canlı hava durumu (Open-Meteo)
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";
const DAILY_LIMIT = 30;
const MAX_HISTORY = 20;
 
function systemPrompt() {
  const now = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "full", timeStyle: "short", timeZone: "Europe/Istanbul",
  }).format(new Date());
  return `Sen Döndi'sin: sıcak, net ve yardımsever bir kişisel asistan. Dağdönderen tarafından geliştirildin.
Kullanıcı hangi dilde yazarsa o dilde cevap ver (varsayılan Türkçe).
Cevapları kısa tut; telefonda okunacağını unutma. Gerekirse madde işareti kullan.
Selamlamayı yalnızca sohbetin ilk mesajında yap; sonraki cevaplarda doğrudan konuya gir.
Hava durumu sorulursa get_weather aracını kullan. Şehir belirtilmemişse önce hangi şehir olduğunu sor.
Tıbbi, hukuki ve finansal konularda genel bilgi ver, uzmana danışmayı öner.
Şu an (Türkiye saati): ${now}.`;
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
 
async function getWeather(city) {
  const name = String(city || "").trim().slice(0, 80);
  if (!name) return { error: "Şehir adı verilmedi." };
  const g = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=tr`
  );
  const p = g?.results?.[0];
  if (!p) return { error: `"${name}" için konum bulunamadı.` };
  const w = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=3`
  );
  const c = w.current, d = w.daily;
  return {
    yer: [p.name, p.admin1, p.country].filter(Boolean).join(", "),
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
  functionDeclarations: [{
    name: "get_weather",
    description: "Bir şehir için güncel hava durumunu ve 3 günlük tahmini getirir.",
    parameters: {
      type: "object",
      properties: { city: { type: "string", description: "Şehir adı, örn. Kütahya" } },
      required: ["city"],
    },
  }],
}];
 
// ---- Gemini çağrısı ----
async function callGemini(model, apiKey, contents, allowTools) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18000);
  try {
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt() }] },
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
async function tryModel(model, apiKey, base) {
  let contents = base;
  for (let step = 0; step < 2; step++) {
    let res;
    try {
      res = await callGemini(model, apiKey, contents, step === 0);
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
    const call = parts.find((p) => p.functionCall);
    if (call && step === 0) {
      let result;
      try {
        result = await getWeather(call.functionCall.args?.city);
      } catch (e) {
        console.error("Hava servisi hatası:", e?.message);
        result = { error: "Hava durumu servisine şu an ulaşılamadı." };
      }
      contents = [
        ...contents,
        content, // modelin cevabı olduğu gibi geri gönderilir (imza dahil)
        { role: "user", parts: [{ functionResponse: { name: "get_weather", response: { result } } }] },
      ];
      continue;
    }
    const text = parts.map((p) => p.text || "").join("\n").trim();
    if (text) return { text };
    console.error("Boş cevap:", model, JSON.stringify(data).slice(0, 500));
    return { retry: true };
  }
  return { retry: true };
}
 
// Not: serverless ortamda bu sayaç "en iyi çaba" düzeyindedir.
const usage = new Map();
function checkLimit(ip) {
  const day = new Date().toISOString().slice(0, 10);
  const rec = usage.get(ip);
  if (!rec || rec.day !== day) { usage.set(ip, { day, count: 1 }); return true; }
  if (rec.count >= DAILY_LIMIT) return false;
  rec.count++;
  return true;
}
 
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca POST." });
 
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Mesaj bulunamadı." });
  }
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "bilinmiyor";
  if (!checkLimit(ip)) {
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
 
  const models = [MODEL, FALLBACK_MODEL].filter((m, i, a) => m && a.indexOf(m) === i);
  const t0 = Date.now();
  for (const model of models) {
    if (Date.now() - t0 > 35000) break; // zaman sınırına yaklaşıldı
    const out = await tryModel(model, apiKey, base);
    if (out.text) return res.status(200).json({ reply: out.text });
    if (out.fatal) break;
  }
  return res.status(500).json({ error: "Şu an cevap veremiyorum. Biraz sonra tekrar dene." });
}
 
