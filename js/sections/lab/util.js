/* Shared helpers for the Lab exhibits. */

/* Calls cb(true|false) whenever the element becomes active (on screen and the
   tab is visible) or inactive. Returns a getter for the current state. */
export function onActive(el, cb) {
  let onScreen = !("IntersectionObserver" in window);
  let active = null;
  const update = () => {
    const next = onScreen && !document.hidden;
    if (next === active) return;
    active = next;
    cb(active);
  };
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        update();
      },
      { rootMargin: "80px 0px" }
    ).observe(el);
  }
  document.addEventListener("visibilitychange", update);
  update();
  return () => !!active;
}

/* Runs cb once, the first time at least `threshold` of el is on screen. */
export function onFirstView(el, cb, threshold = 0.35) {
  if (!("IntersectionObserver" in window)) return cb();
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      cb();
    },
    { threshold }
  );
  io.observe(el);
}

export const cssVar = (el, name, fallback) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;
export const pad2 = (n) => String(n).padStart(2, "0");
