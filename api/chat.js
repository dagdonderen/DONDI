// Döndi – Gemini sürümü (Google AI Studio anahtarı ile çalışır)
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";
const DAILY_LIMIT = 30;
const MAX_HISTORY = 20;
 
const SYSTEM = `Sen Döndi'sin: sıcak, net ve yardımsever bir kişisel asistan. Dağdönderen tarafından geliştirildin.
Kullanıcı hangi dilde yazarsa o dilde cevap ver (varsayılan Türkçe).
Cevapları kısa tut; telefonda okunacağını unutma. Gerekirse madde işareti kullan.
Tıbbi, hukuki ve finansal konularda genel bilgi ver, uzmana danışmayı öner.`;
 
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
 
  const models = [MODEL, FALLBACK_MODEL].filter((m, i, arr) => m && arr.indexOf(m) === i);
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: clean.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 2048 },
  });
 
  let text = "";
  for (const model of models) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 22000);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body, signal: ctrl.signal }
      );
      clearTimeout(timer);
      const data = await r.json();
      if (!r.ok) {
        console.error("Gemini hata:", model, r.status, JSON.stringify(data));
        if ([404, 429, 500, 503].includes(r.status)) continue; // sıradaki modeli dene
        break;
      }
      text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("\n").trim();
      if (text) break;
      console.error("Boş cevap:", model, JSON.stringify(data).slice(0, 500));
    } catch (err) {
      console.error("İstek hatası:", model, err?.name, err?.message);
    }
  }
 
  if (!text) {
    return res.status(500).json({ error: "Şu an cevap veremiyorum. Biraz sonra tekrar dene." });
  }
  res.status(200).json({ reply: text });
}
 
