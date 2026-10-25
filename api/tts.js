// Döndi erkek sesi: Gemini TTS (Interactions API). Hata olursa istemci tarayıcı sesine döner.
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts"; // hız için önce lite
const TTS_FALLBACK = process.env.GEMINI_TTS_FALLBACK_MODEL || "gemini-3.8-flash-tts";
const TTS_LEGACY = process.env.GEMINI_TTS_LEGACY_MODEL || "gemini-2.5-flash-preview-tts"; // generateContent yolu (son çare)
let lastErr = "";
// Kota/yoğunluk hatası veren modeli bir süre atla: her cümlede önce başarısız denemeye zaman harcanmasın.
const coolUntil = new Map();
function cool(model, status, data) {
  const msg = JSON.stringify(data || {});
  let sec = status === 503 ? 60 : 300;
  const m = msg.match(/retry in (?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i);
  if (status === 429 && m && (m[1] || m[2] || m[3])) sec = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + Math.ceil(+m[3] || 0);
  coolUntil.set(model, Date.now() + Math.max(5, sec) * 1000);
}
const usable = (model) => (coolUntil.get(model) || 0) < Date.now();
const VOICE = process.env.GEMINI_TTS_VOICE || "Orus"; // erkek, kararlı ton
const STYLE = process.env.GEMINI_TTS_STYLE ||
  "kendinden emin, özgüvenli, sıcak ve çekici bir erkek sesiyle; sakin, akıcı ve doğal bir tempoda";
const VOICES = new Set(["Orus","Charon","Algenib","Alnilam","Algieba","Fenrir","Rasalgethi","Sadaltager"]);
import { createHash } from "node:crypto";
import { resolvePlan, bump, dayKey } from "../lib/plans.js";
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
    if (!r.ok) { lastErr = `${model} ${r.status} ${JSON.stringify(data).slice(0, 160)}`; if (r.status === 429 || r.status === 503) cool(model, r.status, data); console.error("TTS hata:", lastErr); return null; }
    const blocks = (data.steps || []).filter((s) => s.type === "model_output").flatMap((s) => s.content || []).filter((c) => c.type === "audio");
    const last = blocks[blocks.length - 1];
    if (!last?.data) { lastErr = `${model} boş`; console.error("TTS boş cevap:", model, JSON.stringify(data).slice(0, 300)); return null; }
    return last.data;
  } catch (e) {
    console.error("TTS istek hatası:", model, e?.name, e?.message);
    return null;
  } finally { clearTimeout(timer); }
}

function wav(pcmB64) {
  const pcm = Buffer.from(pcmB64, "base64"), h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]).toString("base64");
}
async function synthLegacy(key, text, voice) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_LEGACY}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLE} oku: ${text}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      }),
      signal: ctrl.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { lastErr = `legacy ${r.status} ${JSON.stringify(data).slice(0, 160)}`; console.error("TTS hata:", TTS_LEGACY, lastErr); return null; }
    const part = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
    if (!part) { lastErr = "legacy boş"; return null; }
    return wav(part.inlineData.data);
  } catch (e) { lastErr = `legacy ${e?.name}`; return null; } finally { clearTimeout(timer); }
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
  const eff = resolvePlan(req.body?.ent, { app: req.body?.app === "finans" ? "finans" : "kisisel", fsub: req.body?.fsub === "isletme" ? "isletme" : "bireysel" });
  const sid = eff.sub || createHash("sha256").update(ip).digest("hex").slice(0, 24);
  if ((await bump(`tts:${dayKey()}:${sid}`, 90000)) > eff.limits.tts_gunluk) return res.status(429).json({ error: "Günlük sesli cevap hakkın doldu; yazılı cevaplar devam eder." });
  for (const m of [TTS_MODEL, TTS_FALLBACK].filter((x, i, a) => x && a.indexOf(x) === i && usable(x))) {
    const audio = await synth(m, key, text, voice);
    if (audio) return res.status(200).json({ audio, mime: "audio/wav", model: m });
  }
  const legacy = await synthLegacy(key, text, voice);
  if (legacy) return res.status(200).json({ audio: legacy, mime: "audio/wav", model: TTS_LEGACY });
  return res.status(502).json({ error: "Ses üretilemedi.", detail: lastErr.slice(0, 200) });
}
