(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none)").matches;
  var hasGSAP = typeof gsap !== "undefined";

  /* ============ Custom cursor ============ */
  var dot = document.getElementById("cursor-dot");
  var ring = document.getElementById("cursor-ring");
  if (!isTouch && dot && ring) {
    document.body.classList.add("custom-cursor");
    var cx = 0, cy = 0, rx = 0, ry = 0;
    window.addEventListener("mousemove", function (e) {
      cx = e.clientX; cy = e.clientY;
      dot.style.transform = "translate(" + cx + "px," + cy + "px)";
    });
    (function loop() {
      rx += (cx - rx) * 0.16;
      ry += (cy - ry) * 0.16;
      ring.style.transform = "translate(" + rx + "px," + ry + "px)";
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll("a, button, input, select, textarea").forEach(function (el) {
      el.addEventListener("mouseenter", function () { ring.classList.add("hover"); });
      el.addEventListener("mouseleave", function () { ring.classList.remove("hover"); });
    });
  }

  /* ============ Magnetic buttons ============ */
  if (!isTouch && hasGSAP && !prefersReduced) {
    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.25, duration: 0.4 });
      });
      el.addEventListener("mouseleave", function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
      });
    });
  }

  /* ============ Mobile menu ============ */
  var burger = document.getElementById("nav-burger");
  var menu = document.getElementById("mobile-menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = !menu.classList.contains("open");
      burger.classList.toggle("open", open);
      menu.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        burger.classList.remove("open");
        menu.classList.remove("open");
        document.body.style.overflow = "";
      });
    });
  }

  /* ============ Entrance animations ============ */
  if (!hasGSAP || prefersReduced) {
    document.querySelectorAll(".hero-line-inner").forEach(function (l) { l.style.transform = "none"; });
  }
  if (hasGSAP && !prefersReduced) {
    gsap.to(".hero-line-inner", { yPercent: 0, y: 0, duration: 0.9, stagger: 0.12, ease: "power4.out", delay: 0.15 });
    gsap.from(".section-tag", { opacity: 0, y: 16, duration: 0.6, delay: 0.1 });
    gsap.from(".contact-sub, .contact-channels .channel", { opacity: 0, y: 24, duration: 0.7, stagger: 0.08, delay: 0.5, ease: "power3.out" });
    gsap.from(".contact-form", { opacity: 0, y: 36, duration: 0.9, delay: 0.35, ease: "power3.out" });
  }

  /* ============ Form submit ============ */
  var form = document.getElementById("contact-form");
  var note = document.getElementById("form-note");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var msg = form.message.value.trim();
      if (!name || !email || !msg) {
        note.textContent = "// error: please fill in the required fields";
        note.className = "form-note mono err";
        return;
      }
      var service = form.service.value || "Not specified";
      var phone = form.phone.value.trim() || "Not provided";
      var subject = "New Project Brief — " + name;
      var body = "Name: " + name + "\nEmail: " + email + "\nPhone: " + phone + "\nService: " + service + "\n\nProject details:\n" + msg;
      note.textContent = "// opening your email client…";
      note.className = "form-note mono ok";
      window.location.href = "mailto:hello@applylogics.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  }

  /* ============ Topic preselect from URL ============ */
  var topicMap = {
    "web-design": "Web Design & Development",
    "ai-automation": "AI Business Automation",
    "business-automation": "AI Business Automation",
    "hosting": "Hosting & Server Setup",
    "technical-infrastructure": "Hosting & Server Setup",
    "custom-dev": "Custom Development",
    "digital-presence": "Web Design & Development",
    "ongoing-partnership": "Maintenance & Support"
  };
  var topic = new URLSearchParams(window.location.search).get("topic");
  if (topic && form && topicMap[topic]) {
    form.service.value = topicMap[topic];
  }
})();
