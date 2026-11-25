/* Elements marked data-magnetic lean toward the pointer and spring back. */
import { gsap, motion, fine } from "../core/env.js";

export function initMagnetic(root = document) {
  if (!motion || !fine) return;
  root.querySelectorAll("[data-magnetic]").forEach((el) => {
    if (el.__magnetic) return;
    el.__magnetic = true;
    const strength = parseFloat(el.dataset.magnetic) || 0.3;
    const xTo = gsap.quickTo(el, "x", { duration: 0.9, ease: "elastic.out(1, 0.45)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.9, ease: "elastic.out(1, 0.45)" });
    el.addEventListener("pointermove", (e) => {
      const b = el.getBoundingClientRect();
      xTo((e.clientX - (b.left + b.width / 2)) * strength);
      yTo((e.clientY - (b.top + b.height / 2)) * strength);
    });
    el.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}
