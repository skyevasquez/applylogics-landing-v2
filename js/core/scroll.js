/* Smooth scroll (Lenis) wired into GSAP's ticker + ScrollTrigger.
   Touch devices and reduced-motion users keep native scrolling. */
import { gsap, ScrollTrigger, motion, fine } from "./env.js";

let lenis = null;

export function initScroll() {
  if (!motion || !fine || !window.Lenis) return null;
  lenis = new window.Lenis({ lerp: 0.105, wheelMultiplier: 1, anchors: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function scrollTo(target, opts = {}) {
  const offset = opts.offset ?? 0;
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: opts.duration ?? 1.4, immediate: !!opts.immediate });
    return;
  }
  const el = typeof target === "string" ? document.querySelector(target) : target;
  const y = typeof target === "number" ? target : el ? el.getBoundingClientRect().top + window.scrollY + offset : 0;
  window.scrollTo({ top: y, behavior: motion && !opts.immediate ? "smooth" : "auto" });
}

export const stopScroll = () => (lenis ? lenis.stop() : (document.documentElement.style.overflow = "hidden"));
export const startScroll = () => (lenis ? lenis.start() : (document.documentElement.style.overflow = ""));
export const getLenis = () => lenis;
