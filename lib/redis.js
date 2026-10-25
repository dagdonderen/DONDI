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

// Kalıcı bağlantı havuzu: her istekte yeni TCP bağlantısı açılmaz. Hata/zaman aşımında bağlantı atılır, havuza dönmez.
const POOL_MAX = 4, idle = [];
function openSocket() {
  const u = new URL(TCP_URL);
  const secure = u.protocol === "rediss:";
  const opts = { host: u.hostname, port: Number(u.port) || 6379 };
  const sock = secure ? tls.connect({ ...opts, servername: u.hostname }) : net.connect(opts);
  sock.setKeepAlive(true, 30000); sock.setNoDelay(true);
  sock._auth = u.password ? [u.username && u.username !== "default" ? ["AUTH", decodeURIComponent(u.username), decodeURIComponent(u.password)] : ["AUTH", decodeURIComponent(u.password)]] : [];
  sock._ready = new Promise((res, rej) => { sock.once(secure ? "secureConnect" : "connect", res); sock.once("error", rej); });
  sock.on("error", () => sock.destroy());
  sock.on("close", () => { const i = idle.indexOf(sock); if (i >= 0) idle.splice(i, 1); });
  return sock;
}
function runTcp(cmds) {
  let sock = null;
  while (idle.length && !sock) { const s = idle.pop(); if (!s.destroyed) sock = s; }
  const fresh = !sock; if (fresh) sock = openSocket();
  const pre = fresh ? sock._auth : [];
  const all = [...pre, ...cmds];
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0), pos = 0, finished = false; const out = [];
    const cleanup = () => { clearTimeout(timer); sock.removeListener("data", onData); sock.removeListener("error", onErr); };
    const done = (err) => {
      if (finished) return; finished = true; cleanup();
      if (err || pos !== buf.length) { sock.destroy(); }
      else if (idle.length < POOL_MAX) idle.push(sock); else sock.end();
      err ? reject(err) : resolve(out.slice(pre.length));
    };
    const timer = setTimeout(() => done(new Error("Redis zaman aşımı")), 6000);
    const onErr = (e) => done(e);
    const onData = (d) => {
      buf = Buffer.concat([buf, d]);
      try {
        for (;;) {
          const r = parse(buf, pos); if (!r) break;
          pos = r.end;
          out.push(r.v instanceof Error ? { error: r.v } : { result: r.v });
          if (out.length === all.length) {
            const firstErr = out.find((x) => x.error);
            return done(firstErr ? firstErr.error : null);
          }
        }
      } catch (e) { done(e); }
    };
    sock.on("data", onData); sock.on("error", onErr);
    sock._ready.then(() => { if (!finished) sock.write(all.map(enc).join("")); }, (e) => done(e));
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
