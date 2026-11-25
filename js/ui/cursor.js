/* A square cursor — one pixel of the system — that grows over links and turns
   into a labelled tile over anything marked data-cursor="Label". */
import { gsap, motion, fine } from "../core/env.js";

export function initCursor() {
  if (!motion || !fine) return;
  const el = document.querySelector(".cursor");
  if (!el) return;
  const label = el.querySelector(".cursor__label");
  document.documentElement.classList.add("has-cursor");
  el.classList.add("is-hidden");

  const x = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3.out" });
  const y = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3.out" });
  let seen = false;

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      if (!seen) {
        seen = true;
        gsap.set(el, { x: e.clientX, y: e.clientY });
        el.classList.remove("is-hidden");
      }
      x(e.clientX);
      y(e.clientY);
    },
    { passive: true }
  );
  document.addEventListener("pointerleave", () => el.classList.add("is-hidden"));
  document.addEventListener("pointerenter", () => seen && el.classList.remove("is-hidden"));
  window.addEventListener("pointerdown", () => el.classList.add("is-down"));
  window.addEventListener("pointerup", () => el.classList.remove("is-down"));

  /* delegated so content injected later (demos, menus) just works */
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    const tagged = t.closest("[data-cursor]");
    const field = t.closest("input, textarea, select");
    const link = t.closest("a, button, [role='button'], label, summary");
    if (tagged && tagged.dataset.cursor) {
      label.textContent = tagged.dataset.cursor;
      el.classList.add("is-label");
      el.classList.remove("is-link");
    } else {
      el.classList.remove("is-label");
      el.classList.toggle("is-link", !!link && !field);
    }
    el.classList.toggle("is-field", !!field);
    el.style.opacity = field ? 0 : 1;
  });
}
