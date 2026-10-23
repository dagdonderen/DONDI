// Döndi erkek sesi: Gemini TTS (Interactions API). Hata olursa istemci tarayıcı sesine döner.
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
const TTS_FALLBACK = process.env.GEMINI_TTS_FALLBACK_MODEL || "gemini-3.8-flash-lite-tts";
const VOICE = process.env.GEMINI_TTS_VOICE || "Orus"; // erkek, kararlı ton
const STYLE = process.env.GEMINI_TTS_STYLE ||
  "kendinden emin, özgüvenli, sıcak ve çekici bir erkek sesiyle; sakin, akıcı ve doğal bir tempoda";
const VOICES = new Set(["Orus","Charon","Algenib","Alnilam","Algieba","Fenrir","Rasalgethi","Sadaltager"]);
const DAILY = 120;
const used = new Map();

function allow(ip) {
  const day = new Date().toISOString().slice(0, 10);
  const r = used.get(ip);
  if (!r || r.day !== day) { used.set(ip, { day, n: 1 }); return true; }
  if (r.n >= DAILY) return false;
  r.n++; return true;
}

async function synth(model, key, text, voice) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        model,
        input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: STYLE }] }] }],
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice }] },
      }),
      signal: ctrl.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { console.error("TTS hata:", model, r.status, JSON.stringify(data).slice(0, 400)); return null; }
    const blocks = (data.steps || []).filter((s) => s.type === "model_output").flatMap((s) => s.content || []).filter((c) => c.type === "audio");
    const last = blocks[blocks.length - 1];
    if (!last?.data) { console.error("TTS boş cevap:", model, JSON.stringify(data).slice(0, 300)); return null; }
    return last.data;
  } catch (e) {
    console.error("TTS istek hatası:", model, e?.name, e?.message);
    return null;
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca POST." });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Sunucu ayarı eksik." });
  const text = String(req.body?.text || "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (!text) return res.status(400).json({ error: "Metin yok." });
  const voice = VOICES.has(req.body?.voice) ? req.body.voice : VOICE;
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "bilinmiyor";
  if (!allow(ip)) return res.status(429).json({ error: "Sesli cevap limiti doldu." });
  for (const m of [TTS_MODEL, TTS_FALLBACK].filter((x, i, a) => x && a.indexOf(x) === i)) {
    const audio = await synth(m, key, text, voice);
    if (audio) return res.status(200).json({ audio, mime: "audio/wav" });
  }
  return res.status(502).json({ error: "Ses üretilemedi." });
}
