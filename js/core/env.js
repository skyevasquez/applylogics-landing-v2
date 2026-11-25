/* Shared environment flags + tiny math helpers. GSAP and Lenis are loaded as
   classic deferred scripts (see the HTML), so they are globals by the time any
   module runs. */
export const gsap = window.gsap;
export const ScrollTrigger = window.ScrollTrigger;
export const SplitText = window.SplitText;

export const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
export const hasGSAP = !!(gsap && ScrollTrigger);
/* "motion" = we are allowed to, and able to, run the full choreography */
export const motion = hasGSAP && !reduced;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const map = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

if (hasGSAP) {
  gsap.registerPlugin(ScrollTrigger);
  if (SplitText) gsap.registerPlugin(SplitText);
  gsap.defaults({ ease: "power3.out", duration: 0.9 });
  ScrollTrigger.config({ ignoreMobileResize: true });
}

/* Resolves once webfonts are in, so text splitting measures the real glyphs. */
export const fontsReady =
  document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1800))])
    : Promise.resolve();
