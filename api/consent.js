// Rıza, bilgilendirme ve onay kayıtları (KVKK ispat kayıtları). Kayıtlar SİLİNMEZ ve kısaltılmaz:
// son kullanımdan itibaren 10 yıl (TBK m.146) saklanır. Redis'e ek olarak, sunucuda yalnız-ekleme (append-only)
// dosyasına da yazılır (DONDI_RIZA_LOG).
import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { redis, hasRedis } from "../lib/redis.js";

const TYPES = new Set(["age18", "aydinlatma", "gemini", "gemini_revoked", "camera", "camera_revoked", "location", "document", "delete_request"]);

export async function saveConsent(req, id, type, version, items) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "bilinmiyor";
  const rec = {
    t: new Date().toISOString(),
    device: id,
    type,
    version: String(version || "").slice(0, 20),
    items,
    ipHash: createHash("sha256").update(ip + (process.env.HASH_SALT || "")).digest("hex").slice(0, 32),
    ua: String(req.headers["user-agent"] || "").slice(0, 200),
  };
  const line = JSON.stringify(rec);
  if (process.env.DONDI_RIZA_LOG) await appendFile(process.env.DONDI_RIZA_LOG, line + "\n", { mode: 0o640 });
  if (hasRedis()) await redis([["RPUSH", `dondi:consent:${id}`, line], ["SET", `dondi:consent_last:${id}`, rec.t]]);
  else if (!process.env.DONDI_RIZA_LOG) throw new Error("Kayıt servisi tanımlı değil");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca POST." });
  const b = req.body ?? {};
  const id = String(b.deviceId || "");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id) || !TYPES.has(b.type) || b.type === "delete_request") return res.status(400).json({ error: "Geçersiz kayıt." });
  const items = {};
  for (const [k, v] of Object.entries(b.items || {}).slice(0, 8)) {
    if (/^[A-Za-z0-9_]{1,20}$/.test(k)) items[k] = !!v;
  }
  try {
    await saveConsent(req, id, b.type, b.version, items);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Rıza kaydı hatası:", e?.message);
    return res.status(500).json({ error: "Kayıt yapılamadı." });
  }
}
