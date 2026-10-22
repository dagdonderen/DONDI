import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5-5";
const DAILY_LIMIT = 30;
const MAX_HISTORY = 20;

const SYSTEM = `Sen Döndi'sin: sıcak, net ve yardımsever bir kişisel asistan. Dağdönderen tarafından geliştirildin.
Kullanıcı hangi dilde yazarsa o dilde cevap ver (varsayılan Türkçe).
Cevapları kısa tut; telefonda okunacağını unutma. Gerekirse madde işareti kullan.
Tıbbi, hukuki ve finansal konularda genel bilgi ver, uzmana danışmayı öner.`;

// Not: serverless ortamda bu sayaç "en iyi çaba" düzeyindedir (sunucu örnekleri arasında paylaşılmaz).
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

  try {
    const r = await client.messages.create({ model: MODEL, max_tokens: 1000, system: SYSTEM, messages: clean });
    const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    res.status(200).json({ reply: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Şu an cevap veremiyorum. Biraz sonra tekrar dene." });
  }
}
