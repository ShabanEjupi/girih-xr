// Lab for two: a tiny relay, no dependencies. Each room keeps one merged state (last-writer-wins registers ordered by
// Lamport clock, then peer id — so every peer that sees the same writes ends in the same state) and fans messages out.
//   GET  /room/<id>/events?peer=<p>   Server-Sent Events: a snapshot first, then every message from the other peers
//   POST /room/<id>?peer=<p>          {state:{field:[value, clock]}} merged and relayed, or {hands:[…]} relayed only
import http from 'node:http';

const PORT = 8323, MAX_BODY = 4096, MAX_PEERS = 6, MAX_ROOMS = 300, IDLE_MS = 3600e3;
const FIELDS = new Set(['mission', 'p', 'theta', 'phi']);
const rooms = new Map();   // id → { state: {field: [value, clock, peer]}, peers: Map(peer → res), at }
const ID = /^[a-z0-9]{6,16}$/;

export function merge(state, from, peer) {
  const changed = {};
  for (const [k, w] of Object.entries(from || {})) {
    if (!FIELDS.has(k) || !Array.isArray(w) || !Number.isSafeInteger(w[1])) continue;
    const have = state[k], cand = [w[0], w[1], peer];
    // A total order — clock, then peer, then the value itself — so the merge is a true join: any delivery order, same result.
    const after = (a, b) => a[1] !== b[1] ? a[1] > b[1] : a[2] !== b[2] ? a[2] > b[2] : JSON.stringify(a[0]) > JSON.stringify(b[0]);
    if (!have || after(cand, have)) { state[k] = cand; changed[k] = cand; }
  }
  return changed;
}

const send = (res, obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
// A peer leaves once: by its goodbye or by its stream closing, whichever comes first (a newer stream of the same peer stays).
function drop(r, peer, res) {
  if (!res || r.peers.get(peer) !== res) return;
  r.peers.delete(peer); r.seen.delete(peer);
  for (const o of r.peers.values()) send(o, { leave: peer, peers: [...r.peers.keys()] });
}
function room(id) {
  let r = rooms.get(id);
  if (!r) {
    if (rooms.size >= MAX_ROOMS) return null;
    r = { state: {}, peers: new Map(), seen: new Map(), at: Date.now() }; rooms.set(id, r);
  }
  r.at = Date.now(); return r;
}
setInterval(() => {
  const now = Date.now();
  for (const [id, r] of rooms) if (!r.peers.size && now - r.at > IDLE_MS) rooms.delete(id);
  for (const r of rooms.values()) for (const [peer, res] of r.peers) {
    if (now - (r.seen.get(peer) || 0) > 60e3) { drop(r, peer, res); res.end(); continue; }   // a crashed tab: no ping for a minute
    res.write(': keep-alive\n\n');                                    // CDN idle timeout is 100 s
  }
}, 25e3).unref();

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), m = u.pathname.match(/^\/room\/([^/]+)(\/events)?$/), peer = u.searchParams.get('peer') || '';
  if (!m || !ID.test(m[1]) || !ID.test(peer)) { res.writeHead(404).end(); return; }
  const r = room(m[1]);
  if (!r) { res.writeHead(503).end(); return; }
  r.seen.set(peer, Date.now());
  if (req.method === 'GET' && m[2]) {
    if (r.peers.size >= MAX_PEERS && !r.peers.has(peer)) { res.writeHead(429).end(); return; }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
    r.peers.get(peer)?.end(); r.peers.set(peer, res);
    send(res, { snapshot: r.state, peers: [...r.peers.keys()] });
    for (const [q, o] of r.peers) if (q !== peer) send(o, { join: peer, peers: [...r.peers.keys()] });
    req.on('close', () => drop(r, peer, res));
    return;
  }
  if (req.method !== 'POST' || m[2]) { res.writeHead(405).end(); return; }
  let body = '';
  req.on('data', c => { body += c; if (body.length > MAX_BODY) req.destroy(); });
  req.on('end', () => {
    let msg; try { msg = JSON.parse(body); } catch { res.writeHead(400).end(); return; }
    const out = { from: peer };
    // A closed tab says goodbye itself: through a CDN the event stream can linger long after the page is gone.
    if (msg.leave) { const o = r.peers.get(peer); drop(r, peer, o); o?.end(); res.writeHead(204).end(); return; }
    if (msg.state && typeof msg.state === 'object') {
      const ch = merge(r.state, msg.state, peer); if (Object.keys(ch).length) out.state = ch;
      // A write that lost to a concurrent one: tell the writer what won, so it converges too.
      const lost = Object.fromEntries(Object.keys(msg.state).filter(k => FIELDS.has(k) && r.state[k] && r.state[k][2] !== peer).map(k => [k, r.state[k]]));
      if (Object.keys(lost).length && r.peers.has(peer)) send(r.peers.get(peer), { from: 'relay', state: lost });
    }
    if (Array.isArray(msg.hands) && msg.hands.length <= 4) out.hands = msg.hands.map(h => Array.isArray(h) ? h.slice(0, 2).map(Number) : null);
    if (out.state || out.hands) for (const [q, o] of r.peers) if (q !== peer) send(o, out);
    res.writeHead(204).end();
  });
});
if (process.argv[1]?.endsWith('relay.mjs')) server.listen(PORT, () => console.log(`relay on :${PORT}`));
