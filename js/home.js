/* ApplyLogics Studio — home page entry. */
import { gsap, ScrollTrigger, motion, hasGSAP, fontsReady, clamp, lerp, $ } from "./core/env.js";
import { initScroll, scrollTo } from "./core/scroll.js";
import { initCursor } from "./ui/cursor.js";
import { initMagnetic } from "./ui/magnetic.js";
import { initNav } from "./ui/nav.js";
import { initClock } from "./ui/clock.js";
import { initPixelGlyphs } from "./ui/pixel-matrix.js";
import { initPageLinks, arrivedViaTransition, reveal } from "./ui/transition.js";
import { runLoader, initHero } from "./sections/intro.js";
import { initMarquee, initManifesto, initFilm, initEras } from "./sections/story.js";
import { initReveals, initServices, initSolutions, initSignal, initCta } from "./sections/work.js";
import { ERAS } from "./gl/glyphs.js";

window.__alsBooted = true;
const root = document.documentElement;
if (!motion) root.classList.add("calm");

const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* The director decides, from scroll position alone, what the voxel stage is:
   which glyph, where it sits, how dissolved it is. Being a pure function of
   scroll makes it correct after reloads, jumps and resizes. */
function direct(stage, eras) {
  const hero = $(".hero");
  const film = $(".film");
  const erasEl = $(".eras");
  const services = $(".services");
  const signal = $(".signal");
  const cta = $(".cta");
  const make = (vars) => ScrollTrigger.create(vars);

  const sHero = make({ trigger: hero, start: "top top", end: "bottom top" });
  const sFilm = make({ trigger: film, start: "top top", end: "bottom bottom" });
  const sErasIn = make({ trigger: erasEl, start: "top bottom", end: "top top" });
  const sSolid = make({ trigger: services, start: "top top", endTrigger: signal, end: "bottom bottom" });
  const sCta = make({ trigger: cta, start: "top bottom", end: "top 12%" });

  const place = () => {
    const wide = window.innerWidth / window.innerHeight > 1.15;
    return wide
      ? { hero: [0.245, 0.12, 0.9], eras: [0.22, 0.04, 0.82], cta: [0.27, 0.07, 0.9] }
      : { hero: [0, 0.2, 0.5], eras: [0, 0.21, 0.46], cta: [0, 0.2, 0.5] };
  };
  let P = place();
  window.addEventListener("resize", () => (P = place()));

  const api = { started: false };
  const setPlace = ([x, y, scale], dy = 0) => {
    stage.target.x = x;
    stage.target.y = y + dy;
    stage.target.scale = scale;
  };

  gsap.ticker.add(() => {
    if (!api.started) return;
    const y = window.scrollY;
    let shape = "mark";
    let opacity = 1;
    let scatter = 0;

    if (y < sFilm.start) {
      /* hero → mission: the mark lets go into dust */
      const p = sHero.progress;
      scatter = smooth(0.06, 0.82, p);
      opacity = lerp(1, 0.6, scatter);
      setPlace(P.hero, p * 0.16);
      stage.target.tilt = p * 0.9;
    } else if (y < sSolid.start) {
      /* film (covered) → eras: dust gathers into each tool in turn */
      shape = ERAS[eras.index] ? ERAS[eras.index].key : "fire";
      scatter = 1 - smooth(0.2, 1, sErasIn.progress);
      opacity = y <= sFilm.end ? 0 : 1;
      setPlace(P.eras);
      stage.target.tilt = 0;
    } else {
      /* solid sections (covered) → call to action: the mark returns */
      scatter = 1 - smooth(0.05, 1, sCta.progress);
      opacity = y < sSolid.end ? 0 : 1;
      setPlace(P.cta);
      stage.target.tilt = (1 - sCta.progress) * -0.6;
    }

    stage.scatter = scatter;
    stage.target.opacity = opacity;
    if (shape !== stage.shape) {
      const unseen = scatter > 0.96 || stage.now.opacity < 0.03;
      stage.setShape(shape, { immediate: unseen, duration: 1.5 });
    }
  });

  api.start = () => {
    /* first appearance: dust assembles into the mark */
    const y = window.scrollY;
    if (y < sFilm.start && sHero.progress < 0.05) {
      setPlace(P.hero);
      stage.now.x = stage.target.x;
      stage.now.y = stage.target.y;
      stage.now.scale = stage.target.scale;
      stage.setShape("mark", { duration: 2.6 });
    }
    api.started = true;
  };
  return api;
}

async function boot() {
  if (hasGSAP) {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (!location.hash) window.scrollTo(0, 0);
  }

  initScroll();
  initCursor();
  initNav();
  initClock();
  initPageLinks();
  initPixelGlyphs();
  const arriving = arrivedViaTransition();

  /* Settle the intro before any awaits: the overlay is on screen from first
     paint, so either run (and scroll-lock) it now or take it down now. */
  const loader = $("#loader");
  let markReady;
  const ready = new Promise((r) => (markReady = r));
  let intro;
  if (motion && !arriving && !location.hash) {
    intro = runLoader(ready);
  } else {
    if (loader) loader.classList.add("is-done");
    /* reduced motion: nothing to cover; transitions and deep links stay covered until built */
    intro = motion ? ready.then(() => reveal()) : reveal();
  }

  await fontsReady;

  /* order matters: ScrollTriggers are created top-to-bottom so pin spacing adds up */
  const hero = initHero();
  initMarquee();
  initManifesto();
  initFilm();
  const eras = initEras();
  initServices();
  try {
    const lab = await import("./sections/lab.js");
    if (lab.initLab) lab.initLab();
  } catch (e) {
    /* the lab is optional; the page stands without it */
  }
  initSolutions();
  initSignal();
  initCta();
  initReveals();
  initMagnetic();
  initPixelGlyphs();

  /* the stage loads in parallel with the intro and joins when ready */
  let director = null;
  let introDone = false;
  if (motion) {
    import("./gl/stage.js")
      .then((m) => m.createStage($("#stage"), { compact: window.innerWidth < 800 }))
      .then((stage) => {
        if (!stage) return;
        root.classList.add("has-stage");
        director = direct(stage, eras);
        ScrollTrigger.refresh();
        if (introDone) director.start();
        window.__stage = stage;
      })
      .catch(() => {});
  }

  if (hasGSAP) ScrollTrigger.refresh();

  markReady();
  await intro;
  if (motion) hero.play();
  introDone = true;
  if (director) director.start();

  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) scrollTo(target, { immediate: true });
  }
}

boot();
