// Lab for two, the client. ?room=<id> joins a room on relay.mjs. The shared state is a set of last-writer-wins registers
// (one per field) ordered by Lamport clock, then peer id: every write is stamped, the relay keeps the winner, and every
// peer that has seen the same writes holds the same state — two people turning the same crystal at once still agree.
// Fingertips travel in the board's own coordinates, so the other person's hands appear on YOUR crystal, wherever you
// pinned it in your room.
const ID = /^[a-z0-9]{6,16}$/;
const rnd = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

// The same total order as relay.mjs: clock, then peer, then the value.
const after = (a, b) => a[1] !== b[1] ? a[1] > b[1] : a[2] !== b[2] ? a[2] > b[2] : JSON.stringify(a[0]) > JSON.stringify(b[0]);

export const roomLink =() => { const u = new URL(location.href); u.searchParams.set('room', rnd(8)); return u.href; };

export function together({ current, apply, onPeers = () => {}, onHands = () => {} }) {
  const room = new URLSearchParams(location.search).get('room');
  if (!room || !ID.test(room)) return null;
  const peer = rnd(10);
  // known[k] = [value, clock, peer]: what this page holds for each field, stamped. A remote write is applied only if it
  // comes after that stamp — otherwise an older write that was still on its way would undo a newer local one.
  let clock = 0, known = {}, ready = false, applying = false, handsAt = 0;
  const post = body => fetch(`./room/${room}?peer=${peer}`, { method: 'POST', body: JSON.stringify(body), keepalive: true }).catch(() => {});
  const take = st => {
    const vals = {};
    for (const [k, w] of Object.entries(st || {})) {
      clock = Math.max(clock, w[1]);
      if (known[k] && !after(w, known[k])) continue;
      known[k] = w; vals[k] = w[0];
    }
    if (!Object.keys(vals).length) return;
    applying = true; try { apply(vals); } finally { applying = false; }
  };
  const api = {
    room, peer,
    // Called after every local change; sends only the fields that differ from what the room already holds.
    local(cur) {
      if (!ready || applying) return;
      const st = {};
      for (const [k, v] of Object.entries(cur)) if (JSON.stringify(v) !== JSON.stringify(known[k]?.[0])) { st[k] = [v, ++clock]; known[k] = [v, clock, peer]; }
      if (Object.keys(st).length) post({ state: st });
    },
    hands(pts) { const now = performance.now(); if (now - handsAt < 66) return; handsAt = now; post({ hands: pts }); },   // ≤ 15 Hz
  };
  const es = new EventSource(`./room/${room}/events?peer=${peer}`);
  setInterval(() => post({}), 20e3);                               // still here: the relay drops peers silent for a minute
  addEventListener('pagehide', () => { es.close(); navigator.sendBeacon(`./room/${room}?peer=${peer}`, JSON.stringify({ leave: true })); });
  es.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.snapshot) {
      // The first one in the room seeds it; everyone after takes the room's state instead of overwriting it.
      ready = true;
      if (Object.keys(msg.snapshot).length) take(msg.snapshot); else api.local(current());
    }
    if (msg.state) take(msg.state);
    if (msg.peers) onPeers(msg.peers.length);
    if (msg.hands) onHands(msg.from, msg.hands);
    if (msg.leave) onHands(msg.leave, []);
  };
  return api;
}
