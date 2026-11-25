/* Marquee · mission text · film · the six eras. */
import { gsap, ScrollTrigger, motion, clamp, $, $$ } from "../core/env.js";

/* ---------- marquee: scroll velocity bends its speed and direction ---------- */
export function initMarquee() {
  const track = $("#marquee");
  if (!track || !motion) return;
  const tween = gsap.to(track, { xPercent: -50, duration: 34, ease: "none", repeat: -1 });
  let dir = 1;
  const settle = gsap.quickTo(tween, "timeScale", { duration: 0.8, ease: "power2.out" });
  ScrollTrigger.create({
    trigger: document.body,
    start: 0,
    end: "max",
    onUpdate: (self) => {
      const v = self.getVelocity();
      if (Math.abs(v) > 40) dir = v < 0 ? -1 : 1;
      settle(dir * (1 + Math.min(Math.abs(v) / 350, 7)));
    },
  });
  ScrollTrigger.addEventListener("scrollEnd", () => settle(dir));
}

/* ---------- mission: the paragraph lights up word by word as you read ---------- */
export function initManifesto() {
  const el = $("#manifesto-text");
  if (!el || !motion) return;

  const words = [];
  const wrap = (node, era) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(" "));
            return;
          }
          const s = document.createElement("span");
          s.className = "w";
          s.textContent = part;
          frag.appendChild(s);
          words.push({ el: s, era });
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1) {
        wrap(n, n.classList.contains("era-word") ? n : era);
      }
    });
  };
  el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
  wrap(el, null);

  const DIM = 0.13;
  const SPREAD = 5; // how many words are mid-fade at once
  const n = words.length;
  const paint = (p) => {
    const head = p * (n + SPREAD);
    for (let i = 0; i < n; i++) {
      const t = clamp((head - i) / SPREAD);
      words[i].el.style.setProperty("--o", (DIM + (1 - DIM) * t).toFixed(3));
      if (words[i].era) words[i].era.classList.toggle("is-lit", t > 0.55);
    }
  };
  paint(0);
  ScrollTrigger.create({
    trigger: el,
    start: "top 80%",
    end: "bottom 42%",
    scrub: true,
    onUpdate: (self) => paint(self.progress),
    onRefresh: (self) => paint(self.progress),
  });
}

/* ---------- film: a small window opens to full bleed ---------- */
export function initFilm() {
  const section = $(".film");
  if (!section) return;
  const video = $("#film-video");
  const toggle = $("#film-toggle");
  let userPaused = !motion;
  let inView = false;

  const sync = () => {
    if (!video) return;
    if (inView && !userPaused) video.play().catch(() => {});
    else video.pause();
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(userPaused));
      toggle.querySelector("span").textContent = userPaused ? "Play film" : "Pause film";
      toggle.dataset.cursor = userPaused ? "Play" : "Pause";
    }
  };
  if (toggle)
    toggle.addEventListener("click", () => {
      userPaused = !userPaused;
      sync();
    });
  if ("IntersectionObserver" in window && video) {
    new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting;
        sync();
      },
      { threshold: 0.15 }
    ).observe(section);
  }
  sync();
  if (!motion) return;

  const frame = $("#film-frame");
  const title = $("#film-title");
  const caption = $(".film__caption", section);
  const shade = $(".film__shade", section);
  const punch = $("#film-punch");
  const cs = getComputedStyle(frame);
  const from = {
    t: parseFloat(cs.getPropertyValue("--t")) || 50,
    x: parseFloat(cs.getPropertyValue("--x")) || 20,
    b: parseFloat(cs.getPropertyValue("--b")) || 6,
  };
  const win = { ...from };
  const apply = () => (frame.style.clipPath = `inset(${win.t}% ${win.x}% ${win.b}% ${win.x}%)`);
  apply();

  gsap.set(punch, { yPercent: 40, opacity: 0 });
  gsap
    .timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: section, start: "top top", end: "+=190%", pin: ".film__pin", scrub: true, anticipatePin: 1 },
    })
    .to(win, { t: 0, x: 0, b: 0, duration: 1, ease: "power2.inOut", onUpdate: apply }, 0)
    .to(title, { yPercent: -45, opacity: 0, duration: 0.45, ease: "power2.in" }, 0.08)
    .fromTo(video, { scale: 1.18 }, { scale: 1, duration: 1, ease: "power2.inOut" }, 0)
    .to(shade, { opacity: 1, duration: 0.3 }, 0.72)
    .to(caption, { opacity: 1, duration: 0.25 }, 0.8)
    .to(punch, { yPercent: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, 0.82)
    .to({}, { duration: 0.35 });
}

/* ---------- eras: a pinned walk through six tools ---------- */
export function initEras() {
  const section = $(".eras");
  const api = { index: 0, listeners: [], pinned: false, trigger: null };
  if (!section || !motion) return api;

  const eras = $$(".era", section);
  const ticks = $$(".eras__ticks span", section);
  const count = $("#eras-n");
  const bar = $("#eras-bar");
  const STEPS = eras.length;

  document.documentElement.classList.add("eras-pinned");
  api.pinned = true;

  /* mask the big serif names so they can slide in */
  eras.forEach((era) => {
    const name = $(".era__name", era);
    const inner = document.createElement("span");
    inner.style.display = "block";
    inner.textContent = name.textContent;
    name.textContent = "";
    name.appendChild(inner);
    name.style.overflow = "hidden";
    era.__parts = { inner, year: $(".era__year", era), text: $(".era__text", era) };
  });

  let active = 0;
  const show = (i, dir) => {
    if (i === active) return;
    const prev = eras[active];
    const next = eras[i];
    active = i;
    api.index = i;
    eras.forEach((e) => {
      gsap.killTweensOf([e, e.__parts.inner, e.__parts.year, e.__parts.text]);
      if (e !== prev && e !== next) {
        e.classList.remove("is-active");
        gsap.set(e, { opacity: 1 });
      }
    });
    gsap.to(prev, {
      opacity: 0,
      duration: 0.28,
      ease: "power1.in",
      onComplete: () => {
        prev.classList.remove("is-active");
        gsap.set(prev, { opacity: 1 });
      },
    });
    next.classList.add("is-active");
    gsap.set(next, { opacity: 1 });
    gsap.fromTo(next.__parts.inner, { yPercent: dir > 0 ? 112 : -112 }, { yPercent: 0, duration: 1.05, ease: "expo.out", delay: 0.16 });
    gsap.fromTo(
      [next.__parts.year, next.__parts.text],
      { opacity: 0, y: dir > 0 ? 22 : -22 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.09, delay: 0.24 }
    );
    ticks.forEach((t, k) => t.classList.toggle("is-active", k === i));
    if (count) count.textContent = String(i + 1).padStart(2, "0");
    api.listeners.forEach((fn) => fn(i, dir));
  };

  api.trigger = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => "+=" + Math.round(window.innerHeight * 0.8 * STEPS),
    pin: ".eras__pin",
    scrub: true,
    anticipatePin: 1,
    onUpdate: (self) => {
      const i = Math.min(STEPS - 1, Math.floor(self.progress * STEPS));
      show(i, self.direction);
      if (bar) bar.style.transform = `scaleX(${self.progress})`;
    },
  });
  return api;
}
