// Upstash Redis REST yardımcısı. Tanımlı değilse null döner.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const hasRedis = () => !!(URL_ && TOK);
export async function redis(cmds) {
  if (!hasRedis()) return null;
  const r = await fetch(`${URL_}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error("Redis HTTP " + r.status);
  return r.json();
}
