// Sistem sağlık kontrolü: istemci açılışta çağırır; gerçek durumu söyler (uydurma yok).
import { getExchangeRates } from "../lib/rates.js";
import { hasRedis } from "../lib/redis.js";
import { bump } from "../lib/plans.js";

const T = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ ok: false, why: "zaman aşımı" }), ms))]);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.GEMINI_API_KEY;
  const out = { ai: !!key, redis: hasRedis(), tcmb: null, tts: null };
  const jobs = [
    T(getExchangeRates({ currencies: ["USD"] }).then((r) => ({ ok: !r.error, why: r.error ? "ulaşılamadı" : "" })).catch(() => ({ ok: false })), 4000).then((r) => { out.tcmb = r.ok; }),
    T(hasRedis() ? bump("health:ping", 60).then(() => ({ ok: true })).catch(() => ({ ok: false })) : Promise.resolve({ ok: true }), 2500).then((r) => { out.redisOk = r.ok; }),
  ];
  if (req.query?.tts === "1" && key) {
    jobs.push(T((async () => {
      const t0 = Date.now();
      const r = await fetch(`${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Tamam.", voice: "Orus" }) });
      const d = await r.json().catch(() => ({}));
      out.ttsMs = Date.now() - t0; out.ttsModel = d.model || null; out.ttsErr = d.detail || d.error || null;
      return { ok: !!d.audio };
    })().catch(() => ({ ok: false })), 12000).then((r) => { out.tts = r.ok; }));
  }
  await Promise.all(jobs);
  res.status(200).json(out);
}
