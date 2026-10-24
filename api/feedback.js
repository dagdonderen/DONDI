// Geri bildirim. Redis varsa saklanır, yoksa Vercel loglarına yazılır.
import { redis } from "../lib/redis.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca POST." });
  const b = req.body ?? {};
  const text = String(b.text || "").trim().slice(0, 1000);
  if (text.length < 3) return res.status(400).json({ error: "Mesaj çok kısa." });
  const rec = JSON.stringify({ t: new Date().toISOString(), v: String(b.v || "").slice(0, 12), rating: Math.min(5, Math.max(0, Number(b.rating) || 0)), text, contact: String(b.contact || "").slice(0, 120) });
  try { const r = await redis([["LPUSH", "dondi:fb", rec], ["LTRIM", "dondi:fb", 0, 499]]); if (!r) console.log("FEEDBACK", rec); }
  catch (e) { console.error("feedback", e.message); console.log("FEEDBACK", rec); }
  return res.status(200).json({ ok: true });
}
