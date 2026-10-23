// Rıza ve onay kayıtları (ispat için). Upstash Redis tanımlı değilse kayıt yapılamaz (503).
import { createHash } from "node:crypto";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const TYPES = new Set(["age18", "camera", "camera_revoked", "location", "document"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca POST." });
  const b = req.body ?? {};
  const id = String(b.deviceId || "");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id) || !TYPES.has(b.type)) return res.status(400).json({ error: "Geçersiz kayıt." });

  const items = {};
  for (const [k, v] of Object.entries(b.items || {}).slice(0, 8)) {
    if (/^[A-Za-z0-9_]{1,20}$/.test(k)) items[k] = !!v;
  }
  if (!REDIS_URL || !REDIS_TOKEN) {
    console.error("Rıza kaydı yapılamadı: Redis tanımlı değil.");
    return res.status(503).json({ error: "Kayıt servisi tanımlı değil." });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "bilinmiyor";
  const rec = {
    t: new Date().toISOString(),
    type: b.type,
    version: String(b.version || "").slice(0, 20),
    items,
    ipHash: createHash("sha256").update(ip + (process.env.HASH_SALT || "")).digest("hex").slice(0, 32),
    ua: String(req.headers["user-agent"] || "").slice(0, 200),
  };
  const key = `dondi:consent:${id}`;
  try {
    const r = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([["LPUSH", key, JSON.stringify(rec)], ["LTRIM", key, 0, 99]]),
    });
    if (!r.ok) throw new Error("Redis HTTP " + r.status);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Rıza kaydı hatası:", e?.message);
    return res.status(500).json({ error: "Kayıt yapılamadı." });
  }
}
