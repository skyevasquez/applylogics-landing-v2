/* PixelMatrix — draws a glyph from the shared bitmap set onto a 2D canvas and
   animates between glyphs cell by cell. Usage in HTML:
     <canvas class="px-glyph" data-glyph="icon-web"></canvas>
   Colour is taken from the canvas's CSS `color`, so it themes automatically. */
import { ICONS } from "../gl/glyphs.js";
import { gsap, motion } from "../core/env.js";

const registry = new WeakMap();

export class PixelMatrix {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.gap = opts.gap ?? 0.12; // fraction of a cell left empty
    this.size = opts.size ?? 12; // logical grid
    this.cells = new Float32Array(this.size * this.size); // current scale 0..1 per cell
    this.target = new Uint8Array(this.size * this.size);
    this.name = null;
    this.tween = null;
    this.resize = this.resize.bind(this);
    this.ro = "ResizeObserver" in window ? new ResizeObserver(this.resize) : null;
    if (this.ro) this.ro.observe(canvas);
    this.resize();
    registry.set(canvas, this);
    if (opts.glyph) this.set(opts.glyph, { animate: false });
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(1, Math.round(r.width * dpr));
    if (this.canvas.width !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
    this.color = getComputedStyle(this.canvas).color || "#00ff88";
    this.draw();
  }

  /* centre a glyph of any size inside the logical grid */
  _bitmap(name) {
    const g = typeof name === "string" ? ICONS[name] : name;
    const out = new Uint8Array(this.size * this.size);
    if (!g) return out;
    const oy = Math.floor((this.size - g.length) / 2);
    const ox = Math.floor((this.size - g[0].length) / 2);
    for (let y = 0; y < g.length; y++)
      for (let x = 0; x < g[y].length; x++) if (g[y][x]) out[(y + oy) * this.size + x + ox] = 1;
    return out;
  }

  set(name, { animate = true, duration = 0.7 } = {}) {
    this.name = name;
    this.target = this._bitmap(name);
    if (this.tween) this.tween.kill();
    if (!animate || !motion) {
      for (let i = 0; i < this.cells.length; i++) this.cells[i] = this.target[i];
      this.draw();
      return;
    }
    const from = Float32Array.from(this.cells);
    const delays = Float32Array.from(this.cells, () => Math.random() * 0.6);
    const state = { t: 0 };
    this.tween = gsap.to(state, {
      t: 1,
      duration,
      ease: "none",
      onUpdate: () => {
        for (let i = 0; i < this.cells.length; i++) {
          const local = Math.min(1, Math.max(0, (state.t - delays[i]) / 0.4));
          const e = 1 - Math.pow(1 - local, 3);
          this.cells[i] = from[i] + (this.target[i] - from[i]) * e;
        }
        this.draw();
      },
    });
  }

  /* blank → glyph, used when the canvas scrolls into view */
  play() {
    const name = this.name;
    this.cells.fill(0);
    this.set(name, { animate: true, duration: 0.9 });
  }

  draw() {
    const { ctx, canvas, size } = this;
    const w = canvas.width;
    const cell = w / size;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = this.color;
    for (let i = 0; i < this.cells.length; i++) {
      const s = this.cells[i];
      if (s < 0.02) continue;
      const x = i % size;
      const y = (i / size) | 0;
      const d = cell * (1 - this.gap) * s;
      const o = (cell - d) / 2;
      ctx.fillRect(Math.round(x * cell + o), Math.round(y * cell + o), Math.ceil(d), Math.ceil(d));
    }
  }
}

/* Auto-initialise every <canvas data-glyph>. Glyphs draw themselves in when
   they first scroll into view. */
export function initPixelGlyphs(root = document) {
  const list = Array.from(root.querySelectorAll("canvas[data-glyph]")).filter((c) => !registry.has(c));
  if (!list.length) return;
  const io =
    motion && "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              if (!en.isIntersecting) return;
              const pm = registry.get(en.target);
              if (pm) pm.play();
              io.unobserve(en.target);
            });
          },
          { threshold: 0.4 }
        )
      : null;
  list.forEach((c) => {
    c.setAttribute("aria-hidden", "true");
    const pm = new PixelMatrix(c, { glyph: c.dataset.glyph, size: parseInt(c.dataset.grid || "12", 10) });
    if (io && !c.hasAttribute("data-glyph-static")) {
      pm.cells.fill(0);
      pm.draw();
      io.observe(c);
    }
  });
}

export const getPixelMatrix = (canvas) => registry.get(canvas);
