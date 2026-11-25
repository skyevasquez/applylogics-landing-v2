/* Intro (the year counter) + hero (kinetic headline, entrance). */
import { gsap, ScrollTrigger, motion, fine, clamp, lerp, $, $$ } from "../core/env.js";
import { reveal } from "../ui/transition.js";
import { stopScroll, startScroll } from "../core/scroll.js";

const TOOLS = [
  [-10000, "Fire"],
  [-3500, "The wheel"],
  [1440, "The press"],
  [1879, "Electricity"],
  [1991, "The web"],
];

/* Counts from 10,000 BC to the current year, naming each era's tool as it
   passes, then hands over to the pixel wipe. */
/* `ready` resolves once the page underneath is built; the counter runs right
   away but holds before its exit until then. */
export function runLoader(ready = Promise.resolve()) {
  const el = $("#loader");
  if (!el) return reveal();
  if (!motion) {
    el.classList.add("is-done");
    return reveal();
  }
  const year = $("#loader-year");
  const suffix = $("#loader-suffix");
  const tool = $("#loader-tool");
  const bar = $("#loader-bar");
  const pct = $("#loader-pct");
  const now = new Date().getFullYear();

  let seen = false;
  try {
    seen = sessionStorage.getItem("als:seen") === "1";
    sessionStorage.setItem("als:seen", "1");
  } catch (e) {}

  stopScroll();
  const state = { p: 0 };
  const fmt = new Intl.NumberFormat("en-US");

  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        el.classList.add("is-done");
        startScroll();
        resolve();
      },
    });
    tl.to(state, {
      p: 1,
      duration: seen ? 1.1 : 2.5,
      ease: "power2.inOut",
      onUpdate: () => {
        /* time is not linear: millennia fly by, the last century crawls */
        const e = 1 - Math.pow(1 - state.p, 2.6);
        const y = Math.round(lerp(-10000, now, e));
        year.textContent = fmt.format(Math.abs(y));
        suffix.textContent = y < 0 ? "BC" : "AD";
        let name = TOOLS[0][1];
        for (const [from, label] of TOOLS) if (y >= from) name = label;
        if (state.p >= 1) name = "Intelligence";
        if (tool.textContent !== name) tool.textContent = name;
        bar.style.transform = `scaleX(${state.p})`;
        pct.textContent = String(Math.round(state.p * 100)).padStart(3, "0");
      },
    })
      .add(() => {
        tl.pause();
        ready.then(() => tl.resume(), () => tl.resume());
      })
      .to({}, { duration: seen ? 0.15 : 0.4 })
      .to(".loader__num, .loader__suffix", { yPercent: -115, duration: 0.7, ease: "power4.in", stagger: 0.05 })
      .to(".loader__row", { opacity: 0, duration: 0.3 }, "<0.2")
      .add(() => {
        /* swap the solid loader for the pixel wipe, already fully covering */
        document.documentElement.classList.add("is-arriving");
        el.classList.add("is-done");
      })
      .add(() => reveal())
      .to({}, { duration: 0.35 });
  });
}

export function initHero() {
  const hero = $(".hero");
  if (!hero) return { play() {} };
  const lines = $$(".hero__line-in", hero);
  const fades = $$("[data-hero-in]", hero);
  const meta = $$(".hero__meta span", hero);
  const nav = $(".nav");

  /* split the grotesque lines into characters for the kinetic effect */
  const chars = [];
  $$("[data-kinetic]", hero).forEach((el) => {
    const text = el.textContent;
    el.textContent = "";
    for (const ch of text) {
      if (ch === " ") {
        el.appendChild(document.createTextNode(" "));
        continue;
      }
      const s = document.createElement("span");
      s.className = "k";
      s.textContent = ch;
      el.appendChild(s);
      chars.push({ el: s, x: 0, y: 0, f: 0 });
    }
  });

  if (!motion) return { play() {} };

  gsap.set(lines, { yPercent: 118 });
  gsap.set(fades, { opacity: 0, y: 28 });
  gsap.set(meta, { opacity: 0 });
  gsap.set(nav, { yPercent: -120 });

  /* --- kinetic type: letters swell toward the pointer (variable font axes) --- */
  if (fine && chars.length) {
    let px = -9999;
    let py = -9999;
    let active = false;
    let visible = true;
    const measure = () => {
      chars.forEach((c) => {
        const r = c.el.getBoundingClientRect();
        c.x = r.left + r.width / 2;
        c.y = r.top + r.height / 2 + window.scrollY;
      });
    };
    hero.addEventListener("pointermove", (e) => {
      px = e.clientX;
      py = e.clientY + window.scrollY;
      active = true;
    });
    hero.addEventListener("pointerleave", () => (active = false));
    window.addEventListener("resize", () => setTimeout(measure, 200));
    ScrollTrigger.create({ trigger: hero, start: "top bottom", end: "bottom top", onToggle: (s) => (visible = s.isActive) });
    const R = Math.max(220, window.innerWidth * 0.2);
    gsap.ticker.add(() => {
      if (!visible) return;
      for (const c of chars) {
        const d = active ? Math.hypot(px - c.x, py - c.y) : 1e6;
        const t = Math.pow(clamp(1 - d / R), 1.6);
        if (Math.abs(t - c.f) < 0.002) continue;
        c.f = lerp(c.f, t, 0.14);
        c.el.style.setProperty("--w", (800 + 100 * c.f).toFixed(1));
        c.el.style.setProperty("--s", (112 + 13 * c.f).toFixed(2));
      }
    });
    hero.__measure = measure;
  }

  return {
    play() {
      const tl = gsap.timeline({ onComplete: () => hero.__measure && hero.__measure() });
      tl.to(lines, { yPercent: 0, duration: 1.35, ease: "expo.out", stagger: 0.11 }, 0.05)
        .to(nav, { yPercent: 0, duration: 1.1, ease: "expo.out", clearProps: "transform" }, 0.35)
        .to(meta, { opacity: 1, duration: 0.8, stagger: 0.1 }, 0.5)
        .to(fades, { opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.09 }, 0.6);
      return tl;
    },
  };
}
