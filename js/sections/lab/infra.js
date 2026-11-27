/* Exhibit C — three nodes behind a load balancer, simulated. Requests flow as
   square dots; "Ship a release" does a rolling deploy, "Pull a plug" kills a
   node and lets the balancer route around it. Nothing here talks to a server. */
import { gsap, motion, clamp } from "../../core/env.js";
import { onActive, cssVar } from "./util.js";

const STATE_TEXT = { up: "Serving", draining: "Draining", updating: "Updating", down: "Offline", restarting: "Restarting" };
const SEG = [0.55, 0.8, 0.42]; // seconds: visitors→balancer, balancer→node, bounce back
const RATE = 7; // requests per second
const BUCKET = 0.25; // sparkline resolution, seconds

export function initInfra(root) {
  const box = root.querySelector("[data-inf]");
  if (!box) return;
  const q = (s) => root.querySelector(s);
  const map = q("[data-inf-map]");
  const canvas = q("[data-inf-canvas]");
  const spark = q("[data-inf-spark]");
  const srcEl = q("[data-inf-src]");
  const lbEl = q("[data-inf-lb]");
  const poolEl = q("[data-inf-pool]");
  const statusEl = q("[data-inf-status]");
  const statusText = statusEl.querySelector("span");
  const shipBtn = q("[data-inf-ship]");
  const plugBtn = q("[data-inf-plug]");
  const out = { served: q("[data-inf-served]"), dropped: q("[data-inf-dropped]"), release: q("[data-inf-release]"), lat: q("[data-inf-lat]") };
  const ctx = canvas.getContext("2d");
  const sctx = spark.getContext("2d");

  const nodes = Array.from(root.querySelectorAll("[data-inf-node]")).map((el, i) => ({
    el,
    name: "node-" + "abc"[i],
    state: "up",
    inRotation: true,
    ver: 4,
    load: 0,
    progress: -1,
    verEl: el.querySelector("[data-ver]"),
    stateEl: el.querySelector("[data-state-text]"),
    meter: el.querySelector("[data-meter]"),
  }));

  const col = {
    signal: cssVar(box, "--signal", "#00ff88"),
    bone: cssVar(box, "--bone", "#edebe4"),
    dim: cssVar(box, "--bone-3", "#7f827b"),
    fail: cssVar(box, "--era-fire", "#ff5a1f"),
  };

  let version = 4;
  let served = 0;
  let time = 0;
  let rr = 0;
  let spawnAcc = 0;
  let busy = false;
  let geom = null;
  let dpr = 1;
  let retryHeat = 0;
  let lat = 40;
  const dots = [];
  const tasks = [];
  /* start with a few minutes of ordinary history so the chart isn't born empty */
  const buckets = Array.from({ length: 260 }, () => ({
    n: Math.max(0, Math.round(RATE * BUCKET + (Math.random() - 0.5) * 2.2)),
    lat: 38 + (Math.random() - 0.5) * 5,
  }));
  buckets.push({ n: 0, lat: 40 });
  let bucketT = 0;
  let shownServed = -1;
  let lastSparkDraw = -1;

  /* --- sim clock helpers (only advance while the exhibit is active) --- */
  const wait = (s) => new Promise((r) => tasks.push({ at: time + s, fn: r }));
  const until = (cond) => new Promise((r) => tasks.push({ cond, fn: r }));
  const progress = async (node, s) => {
    const t0 = time;
    node.progress = 0;
    await until(() => {
      node.progress = clamp((time - t0) / s);
      return node.progress >= 1;
    });
    node.progress = -1;
  };

  function say(text, tone) {
    statusText.textContent = text;
    if (tone) statusEl.dataset.tone = tone;
    else delete statusEl.dataset.tone;
  }
  function setState(node, state) {
    node.state = state;
    node.el.dataset.state = state;
    node.stateEl.textContent = STATE_TEXT[state];
    node.verEl.textContent = "v1." + node.ver;
  }
  function refreshPool() {
    const n = nodes.filter((x) => x.inRotation).length;
    poolEl.textContent = n + " / 3 in rotation";
    if (n < 3) lbEl.dataset.degraded = "";
    else delete lbEl.dataset.degraded;
  }
  function setBusy(v) {
    busy = v;
    shipBtn.disabled = v;
    plugBtn.disabled = v;
  }
  const pick = () => {
    for (let i = 0; i < 3; i++) {
      const n = nodes[(rr + i) % 3];
      if (n.inRotation) {
        rr = (rr + i + 1) % 3;
        return n;
      }
    }
    return null;
  };
  const complete = (node) => {
    served++;
    node.load += 1;
    buckets[buckets.length - 1].n++;
  };

  /* --- the two scripts --- */
  async function ship() {
    if (busy) return;
    setBusy(true);
    const next = version + 1;
    const tag = "v1." + next;
    say("Building " + tag + "…", "warn");
    await wait(1.3);
    say("Running the test suite…", "warn");
    await wait(1.1);
    say("Tests passed. Rolling out one node at a time.");
    await wait(1);
    for (const n of nodes) {
      n.inRotation = false;
      refreshPool();
      setState(n, "draining");
      say("Draining " + n.name + ". The other two take its traffic.", "warn");
      await until(() => !dots.some((d) => d.node === n && d.seg === 1));
      await wait(0.5);
      setState(n, "updating");
      say("Updating " + n.name + " to " + tag + "…", "warn");
      await progress(n, 1.5);
      n.ver = next;
      setState(n, "up");
      n.inRotation = true;
      refreshPool();
      say(n.name + " is healthy on " + tag + ".");
      await wait(0.75);
    }
    version = next;
    out.release.textContent = tag;
    say(tag + " is live on all three nodes. Requests dropped: 0.");
    setBusy(false);
  }

  async function plug() {
    if (busy) return;
    setBusy(true);
    const n = nodes[Math.floor(Math.random() * 3)];
    setState(n, "down");
    say(n.name + " just lost power.", "fail");
    await wait(0.9);
    n.inRotation = false;
    refreshPool();
    say("Health check failed. " + n.name + " is out of rotation and its requests were retried elsewhere.", "fail");
    await wait(3.2);
    setState(n, "restarting");
    say(n.name + " is restarting…", "warn");
    await progress(n, 1.9);
    setState(n, "up");
    n.inRotation = true;
    refreshPool();
    say(n.name + " passed its health checks and rejoined. Requests dropped: 0.");
    setBusy(false);
  }
  shipBtn.addEventListener("click", ship);
  plugBtn.addEventListener("click", plug);

  /* --- geometry: polylines measured from the DOM so any layout works --- */
  function polyline(pts) {
    const lens = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(l);
      total += l;
    }
    return { pts, lens, total };
  }
  function at(path, t) {
    let d = clamp(t) * path.total;
    for (let i = 0; i < path.lens.length; i++) {
      if (d <= path.lens[i] || i === path.lens.length - 1) {
        const k = path.lens[i] ? d / path.lens[i] : 0;
        const a = path.pts[i];
        const b = path.pts[i + 1];
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      }
      d -= path.lens[i];
    }
    return path.pts[0];
  }
  function measure() {
    const m = map.getBoundingClientRect();
    if (!m.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(m.width * dpr);
    canvas.height = Math.round(m.height * dpr);
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { l: b.left - m.left, t: b.top - m.top, r: b.right - m.left, b: b.bottom - m.top, cx: b.left - m.left + b.width / 2, cy: b.top - m.top + b.height / 2 };
    };
    const s = r(srcEl);
    const l = r(lbEl);
    const ns = nodes.map((n) => r(n.el));
    const horizontal = ns[0].l > l.r - 4;
    let inPath;
    let outPaths;
    if (horizontal) {
      inPath = polyline([[s.r, s.cy], [l.l, l.cy]]);
      const mid = Math.round((l.r + ns[0].l) / 2);
      outPaths = ns.map((n) => polyline([[l.r, l.cy], [mid, l.cy], [mid, n.cy], [n.l, n.cy]]));
    } else {
      inPath = polyline([[s.cx, s.b], [l.cx, l.t]]);
      const mid = Math.round((l.b + ns[0].t) / 2);
      outPaths = ns.map((n) => polyline([[l.cx, l.b], [l.cx, mid], [n.cx, mid], [n.cx, n.t]]));
    }
    geom = { inPath, outPaths, w: m.width, h: m.height };

    const sb = spark.getBoundingClientRect();
    spark.width = Math.round(sb.width * dpr);
    spark.height = Math.round(sb.height * dpr);
    lastSparkDraw = -1;
  }

  /* --- drawing --- */
  function strokePath(path, color, alpha, dash) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    path.pts.forEach((p, i) => {
      const x = Math.round(p[0] * dpr) + 0.5;
      const y = Math.round(p[1] * dpr) + 0.5;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  function drawMap() {
    if (!geom) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(1, Math.round(dpr));
    strokePath(geom.inPath, col.bone, 0.28);
    nodes.forEach((n, i) => {
      if (n.state === "down") strokePath(geom.outPaths[i], col.fail, 0.55, [4 * dpr, 4 * dpr]);
      else if (!n.inRotation) strokePath(geom.outPaths[i], col.dim, 0.5, [4 * dpr, 4 * dpr]);
      else strokePath(geom.outPaths[i], col.bone, 0.28);
    });
    ctx.setLineDash([]);
    if (!motion) {
      ctx.globalAlpha = 1;
      return;
    }
    const size = Math.round(5 * dpr);
    for (const d of dots) {
      let p;
      if (d.seg === 0) p = at(geom.inPath, d.t);
      else if (d.seg === 1) p = at(geom.outPaths[nodes.indexOf(d.node)], d.t);
      else p = at(geom.outPaths[nodes.indexOf(d.node)], d.from * (1 - d.t));
      ctx.globalAlpha = d.seg === 0 ? Math.min(1, d.t * 5) : 1;
      ctx.fillStyle = d.seg === 2 ? col.fail : d.retried ? col.bone : col.signal;
      ctx.fillRect(Math.round(p[0] * dpr - size / 2), Math.round(p[1] * dpr - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  }
  function drawSpark() {
    const w = spark.width;
    const h = spark.height;
    if (!w) return;
    const step = Math.round(7 * dpr);
    const bar = Math.round(4 * dpr);
    const top = Math.round(26 * dpr);
    const usable = h - top;
    const frac = motion ? bucketT / BUCKET : 0;
    sctx.clearRect(0, 0, w, h);
    const peak = RATE * BUCKET * 2.1;
    const pts = [];
    for (let i = buckets.length - 1, k = 0; i >= 0; i--, k++) {
      const x = w - (k + frac) * step - bar;
      if (x < -step) break;
      const b = buckets[i];
      const bh = Math.max(dpr, Math.round(clamp(b.n / peak) * usable * 0.9));
      sctx.globalAlpha = k === 0 ? 0.9 : 0.45;
      sctx.fillStyle = col.dim;
      sctx.fillRect(Math.round(x), h - bh, bar, bh);
      const ly = top + (1 - clamp((b.lat - 22) / 62)) * (usable - 6 * dpr) + 2 * dpr;
      pts.push([x + bar / 2, ly]);
    }
    sctx.globalAlpha = 1;
    sctx.strokeStyle = col.signal;
    sctx.lineWidth = Math.max(1, 1.5 * dpr);
    sctx.lineJoin = "miter";
    sctx.beginPath();
    pts.forEach((p, i) => {
      // stepped line: it is a readout, not a curve
      if (!i) sctx.moveTo(p[0], Math.round(p[1]));
      else {
        sctx.lineTo(p[0], Math.round(pts[i - 1][1]));
        sctx.lineTo(p[0], Math.round(p[1]));
      }
    });
    sctx.stroke();
  }

  /* --- simulation step --- */
  function step(dt) {
    time += dt;

    for (let i = tasks.length - 1; i >= 0; i--) {
      const t = tasks[i];
      if (t.cond ? t.cond() : time >= t.at) {
        tasks.splice(i, 1);
        t.fn();
      }
    }

    spawnAcc += dt * RATE * (0.75 + Math.random() * 0.5);
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      if (motion) dots.push({ seg: 0, t: 0, node: null, retried: false, from: 1 });
      else {
        const n = pick();
        if (n) complete(n);
      }
    }

    for (let i = dots.length - 1; i >= 0; i--) {
      const d = dots[i];
      d.t += dt / SEG[d.seg];
      if (d.t < 1) continue;
      if (d.seg === 0 || d.seg === 2) {
        const n = pick();
        if (!n) {
          d.t = 1; // hold at the balancer until something is in rotation
          continue;
        }
        d.node = n;
        d.seg = 1;
        d.t = 0;
      } else if (d.node.state === "down") {
        // arrived at a dead node: bounce back and try another
        d.seg = 2;
        d.t = 0;
        d.from = 1;
        d.retried = true;
        retryHeat = Math.min(3, retryHeat + 0.6);
      } else {
        complete(d.node);
        dots.splice(i, 1);
      }
    }

    const healthy = Math.max(1, nodes.filter((n) => n.inRotation && n.state !== "down").length);
    retryHeat *= Math.exp(-dt * 1.6);
    const goal = 38 + 24 * (3 / healthy - 1) + retryHeat * 16 + (Math.random() - 0.5) * 5;
    lat += (goal - lat) * Math.min(1, dt * 4);

    for (const n of nodes) {
      n.load *= Math.exp(-dt / 0.85);
      const v = n.progress >= 0 ? n.progress : n.state === "up" || n.state === "draining" ? clamp(n.load / 4.2) : 0;
      n.meter.style.transform = "scaleX(" + v.toFixed(3) + ")";
    }

    bucketT += dt;
    while (bucketT >= BUCKET) {
      bucketT -= BUCKET;
      buckets[buckets.length - 1].lat = lat;
      buckets.push({ n: 0, lat });
      if (buckets.length > 400) buckets.shift();
      out.lat.textContent = Math.round(lat);
    }
    buckets[buckets.length - 1].lat = lat;

    if (served !== shownServed) {
      shownServed = served;
      out.served.textContent = served.toLocaleString("en-US");
    }
  }

  /* --- loop --- */
  let last = 0;
  let running = false;
  function frame() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    drawMap();
    if (motion) drawSpark();
    else if (Math.floor(time) !== lastSparkDraw) {
      lastSparkDraw = Math.floor(time);
      drawSpark();
    }
  }
  const useTicker = !!(gsap && gsap.ticker);
  let rafId = 0;
  const rafLoop = () => {
    frame();
    if (running) rafId = requestAnimationFrame(rafLoop);
  };
  onActive(box, (on) => {
    if (on === running) return;
    running = on;
    last = performance.now();
    if (useTicker) {
      if (on) gsap.ticker.add(frame);
      else gsap.ticker.remove(frame);
    } else if (on) rafId = requestAnimationFrame(rafLoop);
    else cancelAnimationFrame(rafId);
  });

  /* traffic is already mid-flight when the exhibit is first seen */
  if (motion) {
    for (let i = 0; i < 4; i++) dots.push({ seg: 0, t: (i + Math.random()) / 4, node: null, retried: false, from: 1 });
    for (let i = 0; i < 6; i++) dots.push({ seg: 1, t: (i + Math.random()) / 6, node: nodes[i % 3], retried: false, from: 1 });
  }

  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(map);
  else window.addEventListener("resize", measure);
  measure();
  refreshPool();
  drawMap();
  drawSpark();
}
