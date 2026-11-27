/* Services · solutions · results · call to action · shared scroll reveals. */
import { gsap, ScrollTrigger, SplitText, motion, fine, $, $$ } from "../core/env.js";
import { getPixelMatrix } from "../ui/pixel-matrix.js";

const INK = "#00170c";

/* ---------- generic reveals ---------- */
export function initReveals(root = document) {
  if (!motion) return;

  /* headings: lines rise out of masks */
  $$("[data-split]", root).forEach((el) => {
    if (el.__split || !SplitText) return;
    el.__split = true;
    SplitText.create(el, {
      type: "lines",
      mask: "lines",
      linesClass: "split-line",
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 112,
          duration: 1.15,
          ease: "expo.out",
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: "top 86%", once: true },
        });
      },
    });
  });

  /* everything else: a short rise */
  const items = $$("[data-reveal]", root).filter((el) => !el.__reveal);
  items.forEach((el) => (el.__reveal = true));
  gsap.set(items, { opacity: 0, y: 26 });
  ScrollTrigger.batch(items, {
    start: "top 90%",
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.95, ease: "power3.out", stagger: 0.08 }),
  });
}

/* ---------- services ---------- */
export function initServices() {
  const rows = $$(".svc");
  if (!rows.length) return;

  if (fine) {
    rows.forEach((row) => {
      const canvas = $(".svc__glyph", row);
      const on = () => {
        const pm = getPixelMatrix(canvas);
        if (!pm) return;
        pm.color = INK;
        pm.play();
      };
      const off = () => {
        const pm = getPixelMatrix(canvas);
        if (!pm) return;
        pm.color = getComputedStyle(document.documentElement).getPropertyValue("--signal").trim() || "#00ff88";
        pm.draw();
      };
      row.addEventListener("pointerenter", on);
      row.addEventListener("focus", on);
      row.addEventListener("pointerleave", off);
      row.addEventListener("blur", off);
    });
  }

  if (!motion) return;
  rows.forEach((row) => {
    gsap.from([$(".svc__idx", row), $(".svc__name", row), $(".svc__desc", row)], {
      opacity: 0,
      y: 34,
      duration: 1,
      ease: "power3.out",
      stagger: 0.07,
      scrollTrigger: { trigger: row, start: "top 90%", once: true },
    });
  });
}

/* ---------- solutions: a grid that lights up around the pointer ---------- */
export function initSolutions() {
  const cards = $$(".sol");
  if (!cards.length) return;
  cards.forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
    card.addEventListener("pointerenter", () => {
      const pm = getPixelMatrix($(".sol__glyph", card));
      if (pm && motion) pm.play();
    });
  });
  if (!motion) return;
  gsap.set(cards, { opacity: 0, y: 44 });
  ScrollTrigger.batch(cards, {
    start: "top 88%",
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: "power3.out", stagger: 0.1 }),
  });
}

/* ---------- results: odometer numerals ---------- */
export function initSignal() {
  const odos = $$(".odo");
  if (!odos.length || !motion) return;
  odos.forEach((el) => {
    const value = el.dataset.odo || el.textContent.trim();
    el.setAttribute("aria-label", value);
    el.setAttribute("role", "img");
    el.textContent = "";
    const cols = [];
    Array.from(value).forEach((ch, i) => {
      const col = document.createElement("span");
      col.className = "odo__col";
      col.setAttribute("aria-hidden", "true");
      const digit = parseInt(ch, 10);
      const spins = 10 * (i + 1) + digit; // later digits travel further
      for (let k = 0; k <= spins; k++) {
        const s = document.createElement("span");
        s.textContent = String(k % 10);
        col.appendChild(s);
      }
      el.appendChild(col);
      cols.push({ col, spins });
    });
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () =>
        cols.forEach(({ col, spins }, i) =>
          gsap.to(col, {
            yPercent: -(spins / (spins + 1)) * 100,
            duration: 1.6 + i * 0.3,
            ease: "expo.out",
          })
        ),
    });
  });

  const stats = $$(".stat");
  gsap.from($$(".stat__label, .stat__num sup"), {
    opacity: 0,
    duration: 1,
    stagger: 0.06,
    scrollTrigger: { trigger: ".stats", start: "top 85%", once: true },
  });
  return stats;
}

/* ---------- call to action ---------- */
export function initCta() {
  const section = $(".cta");
  if (!section || !motion) return;
  const lines = $$(".cta__line", section).map((line) => {
    const inner = document.createElement("span");
    while (line.firstChild) inner.appendChild(line.firstChild);
    line.appendChild(inner);
    return inner;
  });
  gsap.from(lines, {
    yPercent: 118,
    duration: 1.4,
    ease: "expo.out",
    stagger: 0.12,
    scrollTrigger: { trigger: section, start: "top 55%", once: true },
  });
}
