/* Exhibit A — a mini browser whose width you drag. The site inside is laid out
   at a "virtual" device width (320–1280 px) with real container queries, then
   scaled to fit the device frame, so the breakpoints are the genuine article. */
import { gsap, motion, clamp } from "../../core/env.js";
import { onFirstView } from "./util.js";

const V_MIN = 320;
const BREAKS = [
  { max: 599, name: "Phone", cols: "1 column" },
  { max: 959, name: "Tablet", cols: "2 columns" },
  { max: Infinity, name: "Desktop", cols: "3 columns" },
];
const bpOf = (v) => BREAKS.find((b) => v <= b.max);

export function initResponsive(root) {
  const stage = root.querySelector("[data-rsp-stage]");
  const device = root.querySelector("[data-rsp-device]");
  const view = root.querySelector("[data-rsp-view]");
  const site = root.querySelector("[data-rsp-site]");
  const slider = root.querySelector(".ex-rsp-handle--r");
  const handles = Array.from(root.querySelectorAll("[data-rsp-handle]"));
  const presets = Array.from(root.querySelectorAll("[data-rsp-preset]"));
  const out = {
    w: root.querySelector("[data-rsp-w]"),
    bp: root.querySelector("[data-rsp-bp]"),
    cols: root.querySelector("[data-rsp-cols]"),
    scale: root.querySelector("[data-rsp-scale]"),
    live: root.querySelector("[data-rsp-live]"),
  };
  if (!stage || !device || !site) return;

  let aMin = 280;
  let aMax = 800;
  let vMax = 1280;
  let viewH = 400;
  const state = { v: 1280 }; // what is rendered (may overshoot while springing)
  let target = 1280; // where we are heading (always in range)
  let shown = { w: -1, bp: "" };
  let touched = false;

  const aOf = (v) => aMin + ((v - V_MIN) / (vMax - V_MIN)) * (aMax - aMin);
  const vOf = (a) => V_MIN + ((a - aMin) / (aMax - aMin)) * (vMax - V_MIN);

  function measure() {
    const cs = getComputedStyle(stage);
    const inner = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (inner <= 0) return false;
    aMax = inner;
    vMax = aMax < 440 ? 1024 : 1280;
    aMin = clamp(aMax * 0.36, 150, 340);
    viewH = view.clientHeight;
    slider.setAttribute("aria-valuemax", String(vMax));
    return true;
  }

  function render() {
    const v = clamp(state.v, V_MIN * 0.93, vMax * 1.035);
    const a = aOf(v);
    const s = a / v;
    device.style.width = a.toFixed(2) + "px";
    site.style.width = v.toFixed(2) + "px";
    site.style.minHeight = (viewH / s).toFixed(1) + "px";
    site.style.transform = "scale(" + s.toFixed(5) + ")";

    const w = Math.round(clamp(v, V_MIN, vMax));
    if (w !== shown.w) {
      shown.w = w;
      out.w.textContent = w;
      out.scale.textContent = Math.round(s * 100);
      const bp = bpOf(w);
      if (bp.name !== shown.bp) {
        shown.bp = bp.name;
        out.bp.textContent = bp.name;
        out.cols.textContent = bp.cols;
        presets.forEach((b) => {
          const pv = b.dataset.rspPreset === "max" ? vMax : +b.dataset.rspPreset;
          b.setAttribute("aria-pressed", String(bpOf(pv).name === bp.name));
        });
      }
    }
  }

  function syncAria(announce) {
    const w = Math.round(target);
    const bp = bpOf(w);
    slider.setAttribute("aria-valuenow", String(w));
    slider.setAttribute("aria-valuetext", w + " pixels, " + bp.name + ", " + bp.cols);
    if (announce && out.live) out.live.textContent = w + " pixels wide. " + bp.name + " layout, " + bp.cols + ".";
  }

  function go(v, mode) {
    target = clamp(v, V_MIN, vMax);
    gsap && gsap.killTweensOf(state);
    if (!motion || mode === "set") {
      state.v = target;
      render();
    } else if (mode === "follow") {
      gsap.to(state, { v: target, duration: 0.16, ease: "power2.out", onUpdate: render });
    } else if (mode === "spring") {
      gsap.to(state, { v: target, duration: 1, ease: "elastic.out(1, 0.62)", onUpdate: render });
    } else {
      gsap.to(state, { v: target, duration: 1.05, ease: "expo.inOut", onUpdate: render });
    }
  }

  /* --- drag (both handles; the device is centred, so 1px of pointer = 2px of width) --- */
  handles.forEach((h) => {
    const dir = +h.dataset.rspHandle;
    h.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      e.preventDefault();
      touched = true;
      h.setPointerCapture(e.pointerId);
      stage.classList.add("is-dragging");
      const startX = e.clientX;
      const startA = aOf(target);
      let lastX = e.clientX;
      let lastT = performance.now();
      let vel = 0;

      const move = (ev) => {
        const now = performance.now();
        const dt = Math.max(1, now - lastT);
        vel = vel * 0.6 + ((ev.clientX - lastX) / dt) * 0.4;
        lastX = ev.clientX;
        lastT = now;
        go(vOf(clamp(startA + (ev.clientX - startX) * 2 * dir, aMin, aMax)), "follow");
      };
      const up = () => {
        h.removeEventListener("pointermove", move);
        h.removeEventListener("pointerup", up);
        h.removeEventListener("pointercancel", up);
        stage.classList.remove("is-dragging");
        if (performance.now() - lastT > 80) vel = 0;
        const thrown = clamp(aOf(target) + vel * dir * 2 * 110, aMin, aMax);
        go(vOf(thrown), "spring");
        syncAria(true);
      };
      h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", up);
      h.addEventListener("pointercancel", up);
    });
  });

  /* --- keyboard --- */
  slider.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 96 : 24;
    let v = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") v = target - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") v = target + step;
    else if (e.key === "PageDown") v = target - 160;
    else if (e.key === "PageUp") v = target + 160;
    else if (e.key === "Home") v = V_MIN;
    else if (e.key === "End") v = vMax;
    if (v === null) return;
    e.preventDefault();
    touched = true;
    go(v, "follow");
    syncAria(false);
  });

  /* --- presets --- */
  presets.forEach((b) =>
    b.addEventListener("click", () => {
      touched = true;
      go(b.dataset.rspPreset === "max" ? vMax : +b.dataset.rspPreset, "ease");
      syncAria(true);
    })
  );

  /* --- sizing --- */
  const refit = () => {
    if (!measure()) return;
    target = clamp(target, V_MIN, vMax);
    if (!gsap || !gsap.isTweening(state)) state.v = target;
    render();
    syncAria(false);
  };
  if ("ResizeObserver" in window) new ResizeObserver(refit).observe(stage);
  else window.addEventListener("resize", refit);
  measure();
  target = state.v = vMax;
  shown = { w: -1, bp: "" };
  render();
  syncAria(false);

  /* a single nudge on first view so it is obvious the thing is alive */
  if (motion)
    onFirstView(stage, () => {
      if (touched) return;
      gsap.delayedCall(0.5, () => {
        if (touched) return;
        go(768, "ease");
        syncAria(false);
      });
    });
}
