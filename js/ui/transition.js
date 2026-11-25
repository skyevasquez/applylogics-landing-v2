/* Pixel wipe — pages cover and uncover themselves in blocks, like a display
   refreshing. Used for the intro reveal and for navigation between pages. */
import { gsap, motion } from "../core/env.js";

const KEY = "als:arriving";
let el = null;
let cells = [];

function build() {
  if (!el) {
    el = document.createElement("div");
    el.className = "pixel-wipe";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cols = w < 700 ? 6 : 12;
  const size = w / cols;
  const rows = Math.ceil(h / size);
  el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  el.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  el.innerHTML = "<i></i>".repeat(cols * rows);
  cells = Array.from(el.children);
  return { cols, rows };
}

/* Uncover the page. Returns a promise that resolves when the wipe is gone. */
export function reveal({ delay = 0 } = {}) {
  const root = document.documentElement;
  if (!motion) {
    root.classList.remove("is-arriving");
    return Promise.resolve();
  }
  const { cols, rows } = build();
  gsap.set(cells, { opacity: 1 });
  root.classList.remove("is-arriving");
  return new Promise((resolve) => {
    gsap.to(cells, {
      opacity: 0,
      duration: 0.01,
      delay,
      stagger: { amount: 0.62, grid: [rows, cols], from: "random", ease: "power1.in" },
      onComplete: () => {
        el.innerHTML = "";
        cells = [];
        resolve();
      },
    });
  });
}

/* Cover the page, then run `done` (usually a navigation). */
export function cover(done) {
  if (!motion) return done();
  const { cols, rows } = build();
  el.classList.add("is-covering");
  gsap.set(cells, { opacity: 0 });
  gsap.to(cells, {
    opacity: 1,
    duration: 0.01,
    stagger: { amount: 0.5, grid: [rows, cols], from: "random", ease: "power1.out" },
    onComplete: done,
  });
}

/* Intercept links to other pages of this site and play the wipe first. */
export function initPageLinks() {
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    let url;
    try {
      url = new URL(a.href, location.href);
    } catch (err) {
      return;
    }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
    const samePage = url.pathname.replace(/index\.html$/, "") === location.pathname.replace(/index\.html$/, "");
    if (samePage) return; // in-page anchors are handled by the scroller
    if (!motion) return;
    e.preventDefault();
    try {
      sessionStorage.setItem(KEY, "1");
    } catch (err) {}
    cover(() => (location.href = url.href));
  });

  /* back/forward cache: never come back to a covered page */
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && el) {
      el.classList.remove("is-covering");
      el.innerHTML = "";
      document.documentElement.classList.remove("is-arriving");
    }
  });
}

export function arrivedViaTransition() {
  try {
    const v = sessionStorage.getItem(KEY) === "1";
    sessionStorage.removeItem(KEY);
    return v;
  } catch (e) {
    return false;
  }
}
