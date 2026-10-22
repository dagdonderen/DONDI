// Döndi – Gemini sürümü (Google AI Studio anahtarı ile çalışır)
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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
 
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: clean.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 1000 },
      }),
    });
 
    const data = await r.json();
    if (!r.ok) {
      console.error("Gemini hata:", r.status, JSON.stringify(data));
      const msg = r.status === 429
        ? "Şu an çok yoğunum, biraz sonra tekrar dene."
        : "Şu an cevap veremiyorum. Biraz sonra tekrar dene.";
      return res.status(500).json({ error: msg });
    }
 
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("\n").trim();
    if (!text) return res.status(500).json({ error: "Boş cevap geldi, tekrar dene." });
    res.status(200).json({ reply: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Şu an cevap veremiyorum. Biraz sonra tekrar dene." });
  }
}
 
