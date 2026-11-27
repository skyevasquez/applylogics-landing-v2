/* Live studio time. Ocala, Florida runs on US Eastern time. */
export function initClock() {
  const nodes = document.querySelectorAll("[data-clock]");
  if (!nodes.length) return;
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch (e) {
    return;
  }
  const tick = () => {
    const t = fmt.format(new Date()).replace(/^24/, "00");
    nodes.forEach((n) => (n.textContent = t));
  };
  tick();
  setInterval(tick, 1000);
}
