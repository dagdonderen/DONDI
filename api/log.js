// Anonim kullanım olayları ve hata kayıtları. Kişisel veri, mesaj içeriği veya IP saklanmaz.
import { redis, hasRedis } from "../lib/redis.js";
const EVENTS = new Set(["open", "chat", "voice", "camera", "doc", "export", "reminder", "install", "feedback", "mode_kisisel", "mode_finans", "pip"]);
const mem = new Map();
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca POST." });
  const b = req.body ?? {};
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
  const n = (mem.get(ip) || 0) + 1; mem.set(ip, n); if (mem.size > 5000) mem.clear();
  if (n > 200) return res.status(429).json({ error: "Çok fazla." });
  const day = new Date().toISOString().slice(0, 10);
  const ver = String(b.v || "").slice(0, 12).replace(/[^\w.]/g, "");
  try {
    if (b.kind === "event" && EVENTS.has(b.name)) {
      await redis([["HINCRBY", `dondi:ev:${day}`, `${b.name}|${ver}`, 1], ["EXPIRE", `dondi:ev:${day}`, 60 * 60 * 24 * 90]]);
    } else if (b.kind === "error") {
      const rec = JSON.stringify({ t: new Date().toISOString(), v: ver, m: String(b.msg || "").slice(0, 300), s: String(b.src || "").slice(0, 120), ua: String(req.headers["user-agent"] || "").slice(0, 120) });
      await redis([["LPUSH", "dondi:err", rec], ["LTRIM", "dondi:err", 0, 199]]);
    } else return res.status(400).json({ error: "Geçersiz." });
  } catch (e) { console.error("log", e.message); }
  return res.status(200).json({ ok: true, stored: hasRedis() });
}
