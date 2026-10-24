// Redis yardımcısı: Upstash REST (UPSTASH_REDIS_REST_* / KV_REST_API_*) veya standart REDIS_URL (redis:// ve rediss://).
// redis(cmds) -> [{result}, ...] döner; Redis tanımlı değilse null. Dış paket gerektirmez.
import net from "node:net";
import tls from "node:tls";

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const TCP_URL = process.env.REDIS_URL || process.env.KV_URL;
export const hasRedis = () => !!((REST_URL && REST_TOK) || TCP_URL);

const enc = (cmd) => {
  let s = `*${cmd.length}\r\n`;
  for (const a of cmd) { const b = String(a); s += `$${Buffer.byteLength(b)}\r\n${b}\r\n`; }
  return s;
};

// Tek cevabı ayrıştırır; yeterli veri yoksa null döner.
function parse(buf, pos = 0) {
  const nl = buf.indexOf("\r\n", pos);
  if (nl < 0) return null;
  const t = buf[pos], line = buf.toString("utf8", pos + 1, nl), next = nl + 2;
  if (t === 43) return { v: line, end: next };                     // +
  if (t === 45) return { v: new Error(line), end: next };          // -
  if (t === 58) return { v: Number(line), end: next };             // :
  if (t === 36) {                                                  // $
    const n = Number(line); if (n < 0) return { v: null, end: next };
    if (buf.length < next + n + 2) return null;
    return { v: buf.toString("utf8", next, next + n), end: next + n + 2 };
  }
  if (t === 42) {                                                  // *
    const n = Number(line); if (n < 0) return { v: null, end: next };
    const arr = []; let p = next;
    for (let i = 0; i < n; i++) { const r = parse(buf, p); if (!r) return null; arr.push(r.v); p = r.end; }
    return { v: arr, end: p };
  }
  throw new Error("Redis: beklenmeyen cevap");
}

function runTcp(cmds) {
  const u = new URL(TCP_URL);
  const secure = u.protocol === "rediss:";
  const pre = [];
  if (u.password) pre.push(u.username && u.username !== "default" ? ["AUTH", decodeURIComponent(u.username), decodeURIComponent(u.password)] : ["AUTH", decodeURIComponent(u.password)]);
  const all = [...pre, ...cmds];
  return new Promise((resolve, reject) => {
    const opts = { host: u.hostname, port: Number(u.port) || 6379 };
    const sock = secure ? tls.connect({ ...opts, servername: u.hostname }) : net.connect(opts);
    let buf = Buffer.alloc(0), pos = 0; const out = [];
    const done = (err) => { clearTimeout(timer); sock.destroy(); err ? reject(err) : resolve(out.slice(pre.length)); };
    const timer = setTimeout(() => done(new Error("Redis zaman aşımı")), 6000);
    sock.on("error", done);
    sock.on(secure ? "secureConnect" : "connect", () => sock.write(all.map(enc).join("")));
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      try {
        for (;;) {
          const r = parse(buf, pos); if (!r) break;
          pos = r.end;
          if (r.v instanceof Error) return done(r.v);
          out.push({ result: r.v });
          if (out.length === all.length) return done();
        }
      } catch (e) { done(e); }
    });
  });
}

export async function redis(cmds) {
  if (REST_URL && REST_TOK) {
    const r = await fetch(`${REST_URL}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${REST_TOK}`, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
    if (!r.ok) throw new Error("Redis HTTP " + r.status);
    return r.json();
  }
  if (TCP_URL) return runTcp(cmds);
  return null;
}
