// "Verilerimi sil": sunucudaki rıza kaydını cihaz kimliğiyle siler (KVKK silme hakkı).
import { redis } from "../lib/redis.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca POST." });
  const id = String((req.body ?? {}).deviceId || "");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return res.status(400).json({ error: "Geçersiz." });
  try { await redis([["DEL", `dondi:consent:${id}`]]); } catch (e) { console.error("delete", e.message); return res.status(500).json({ error: "Silinemedi." }); }
  return res.status(200).json({ ok: true });
}
