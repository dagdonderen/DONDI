// GET: plan tablosu (herkese açık). POST {ent}: belgeyi doğrular ve etkin planı döner.
import { publicPlans, resolvePlan } from "../lib/plans.js";
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json(publicPlans());
  if (req.method !== "POST") return res.status(405).json({ error: "Yalnızca GET/POST." });
  const b = req.body ?? {};
  const e = resolvePlan(b.ent, { app: b.app === "finans" ? "finans" : "kisisel", fsub: b.fsub === "isletme" ? "isletme" : "bireysel" });
  return res.status(200).json({ plan: e.id, features: e.features, limits: e.limits, exp: e.exp, beta: e.beta, ...publicPlans() });
}
