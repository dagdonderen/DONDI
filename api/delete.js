// "Verilerimi sil": cihazdaki veriler tarayıcıda silinir. Sunucudaki rıza/bilgilendirme kayıtları ispat amacıyla
// (KVKK md. 5/2-ç, e) silinmez; silme talebi de ayrı bir kayıt olarak eklenir. Kayıtlar 10 yıl sonra imha edilir.
import { saveConsent } from "./consent.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca POST." });
  const id = String((req.body ?? {}).deviceId || "");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return res.status(400).json({ error: "Geçersiz." });
  try { await saveConsent(req, id, "delete_request", "", { device_data_deleted: true }); }
  catch (e) { console.error("delete", e.message); return res.status(500).json({ error: "Kaydedilemedi." }); }
  return res.status(200).json({ ok: true, kept: "consent_records" });
}
