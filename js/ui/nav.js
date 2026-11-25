/* Navigation: hide on scroll down / show on scroll up, switch ink/bone theme
   over light sections, mark the active section, drive the full-screen menu. */
import { ScrollTrigger, hasGSAP } from "../core/env.js";
import { scrollTo, stopScroll, startScroll } from "../core/scroll.js";

export function initNav() {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  const burger = nav.querySelector(".nav__burger");
  const menu = document.querySelector(".menu");

  /* --- scroll state --- */
  let last = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 24);
    const menuOpen = menu && menu.classList.contains("is-open");
    if (!menuOpen && Math.abs(y - last) > 6) {
      nav.classList.toggle("is-hidden", y > last && y > 400);
      last = y;
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* --- theme + active link --- */
  if (hasGSAP) {
    document.querySelectorAll("[data-nav-theme]").forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec,
        start: "top 36px",
        end: "bottom 36px",
        onToggle: (self) => {
          if (self.isActive) nav.dataset.theme = sec.dataset.navTheme;
          else if (nav.dataset.theme === sec.dataset.navTheme) delete nav.dataset.theme;
        },
      });
    });
    nav.querySelectorAll(".nav__link[href*='#']").forEach((link) => {
      const id = link.getAttribute("href").split("#")[1];
      const sec = id && document.getElementById(id);
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => link.classList.toggle("is-active", self.isActive),
      });
    });
  }

  /* --- menu --- */
  const setMenu = (open) => {
    if (!menu || !burger) return;
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.setAttribute("aria-hidden", String(!open));
    menu.inert = !open;
    nav.classList.remove("is-hidden");
    if (open) {
      nav.dataset.themeBefore = nav.dataset.theme || "";
      delete nav.dataset.theme;
      stopScroll();
    } else {
      if (nav.dataset.themeBefore) nav.dataset.theme = nav.dataset.themeBefore;
      startScroll();
    }
  };
  if (menu && burger) {
    menu.inert = true;
    burger.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
    window.addEventListener("keydown", (e) => e.key === "Escape" && menu.classList.contains("is-open") && setMenu(false));
    window.matchMedia("(min-width: 62rem)").addEventListener("change", (e) => e.matches && setMenu(false));
  }

  /* --- in-page anchors --- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href*='#']");
    if (!a) return;
    const url = new URL(a.href, location.href);
    const same = url.pathname.replace(/index\.html$/, "") === location.pathname.replace(/index\.html$/, "");
    if (!same || !url.hash) return;
    const target = document.querySelector(url.hash);
    if (!target) return;
    e.preventDefault();
    if (menu && menu.classList.contains("is-open")) setMenu(false);
    scrollTo(target, { offset: 0 });
    history.replaceState(null, "", url.hash);
  });
}
