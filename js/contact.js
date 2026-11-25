/* ApplyLogics Studio — contact / project brief (entry module). */
import { gsap, motion, $, $$ } from "./core/env.js";
import { initScroll } from "./core/scroll.js";
import { initCursor } from "./ui/cursor.js";
import { initMagnetic } from "./ui/magnetic.js";
import { initNav } from "./ui/nav.js";
import { initClock } from "./ui/clock.js";
import { initPixelGlyphs, getPixelMatrix } from "./ui/pixel-matrix.js";
import { initPageLinks, reveal, arrivedViaTransition } from "./ui/transition.js";

window.__alsBooted = true;

const TO = "hello@applylogics.com";

/* ?topic= values used by links on the home page → service chip value */
const TOPICS = {
  "web-design": "Web Design & Development",
  "digital-presence": "Web Design & Development",
  "ai-automation": "AI Business Automation",
  "business-automation": "AI Business Automation",
  hosting: "Hosting & Server Setup",
  "technical-infrastructure": "Hosting & Server Setup",
  consulting: "Technology Consulting",
  "custom-dev": "Custom Development",
  support: "Maintenance & Support",
  "ongoing-partnership": "Maintenance & Support",
};

/* ---------- shared chrome ---------- */
arrivedViaTransition(); // clear the flag; this page always plays its entrance
initScroll();
initCursor();
initMagnetic();
initNav();
initClock();
initPixelGlyphs();
initPageLinks();

/* ---------- entrance ---------- */
function entrance() {
  const root = document.documentElement;
  if (!motion) {
    root.classList.add("is-ready");
    return;
  }
  const lines = $$(".contact-title .line-in");
  const ins = $$("[data-in]");
  gsap.set(lines, { y: 0, yPercent: 115 }); // y:0 overrides the CSS pre-state GSAP would otherwise keep as px
  gsap.set(ins, { opacity: 0, y: 28 });
  root.classList.add("is-ready");
  gsap
    .timeline({ delay: 0.3 })
    .to(lines, { yPercent: 0, duration: 1.15, ease: "power4.out", stagger: 0.11 })
    .to(ins, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.07, clearProps: "transform" }, 0.3);
}
reveal();
entrance();

/* ---------- the brief ---------- */
const form = $("#brief");
if (form) initBrief(form);

function initBrief(form) {
  const status = $("#brief-status");
  const submit = $(".brief-submit", form);
  const copyBtn = $("#brief-copy");
  const meter = $("#brief-meter");
  const meterCells = $$(".brief-meter__cells i", form);
  const count = $("#brief-count");
  const glyphCanvas = $("#brief-glyph");
  const glyphBox = glyphCanvas && glyphCanvas.closest(".brief-glyph");
  const glyphLabel = $("#brief-glyph-label");
  const radios = $$("input[name='service']", form);
  const area = form.elements.message;

  /* required fields and their rules */
  const rules = {
    name: (v) => (v ? "" : "Add your name so we know who to reply to."),
    email: (v) =>
      !v
        ? "Add an email address so we can reply."
        : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
        ? ""
        : "That email doesn't look right. Check it for a typo.",
    message: (v) => (v ? "" : "Tell us a little about the project, even a sentence or two."),
  };
  const fields = Object.keys(rules).map((name) => {
    const input = form.elements[name];
    const wrap = input.closest("[data-field]");
    return { name, input, wrap, error: $(".brief-error", wrap), touched: false };
  });

  const value = (name) => (form.elements[name].value || "").trim();

  function check(f, { show } = { show: true }) {
    const msg = rules[f.name](value(f.name));
    f.wrap.classList.toggle("is-valid", !msg);
    if (show) {
      f.wrap.classList.toggle("is-invalid", !!msg);
      f.error.textContent = msg;
      if (msg) f.input.setAttribute("aria-invalid", "true");
      else f.input.removeAttribute("aria-invalid");
    } else if (!msg) {
      /* silently clear an error the moment the field becomes good */
      f.wrap.classList.remove("is-invalid");
      f.error.textContent = "";
      f.input.removeAttribute("aria-invalid");
    }
    return !msg;
  }

  /* completion meter — twelve pixels, four per required field */
  let lit = 0;
  function updateMeter() {
    const done = fields.filter((f) => !rules[f.name](value(f.name))).length;
    const target = Math.round((done / fields.length) * meterCells.length);
    meterCells.forEach((c, i) => {
      const on = i < target;
      if (on && !c.classList.contains("is-on") && motion) {
        c.classList.add("is-pop");
        setTimeout(() => c.classList.remove("is-pop"), 180 + (i - lit) * 40);
      }
      c.classList.toggle("is-on", on);
    });
    lit = target;
    count.textContent = String(done);
    meter.classList.toggle("is-complete", done === fields.length);
  }

  fields.forEach((f) => {
    f.input.addEventListener("blur", () => {
      if (value(f.name) || f.touched) {
        f.touched = true;
        check(f);
      }
    });
    f.input.addEventListener("input", () => {
      check(f, { show: f.wrap.classList.contains("is-invalid") });
      updateMeter();
    });
  });

  /* optional phone: just show the "good" pixel once something is typed */
  const phone = form.elements.phone;
  phone.addEventListener("input", () => phone.closest("[data-field]").classList.toggle("is-valid", !!phone.value.trim()));

  /* textarea grows with its content */
  const grow = () => {
    area.style.height = "auto";
    area.style.height = area.scrollHeight + 2 + "px";
  };
  area.addEventListener("input", grow);
  window.addEventListener("resize", grow);

  /* service chips drive the glyph */
  function setService(radio, animate = true) {
    const pm = glyphCanvas && getPixelMatrix(glyphCanvas);
    const fieldset = radio.closest("[data-field]");
    if (fieldset) fieldset.classList.add("is-valid");
    if (pm) pm.set(radio.dataset.glyphName || "mark", { animate });
    if (glyphLabel) glyphLabel.textContent = radio.value;
    if (glyphBox) glyphBox.classList.add("is-set");
  }
  radios.forEach((r) => r.addEventListener("change", () => r.checked && setService(r)));

  /* ?topic= preselect */
  const topic = new URLSearchParams(location.search).get("topic");
  const wanted = topic && TOPICS[topic.toLowerCase()];
  if (wanted) {
    const r = radios.find((x) => x.value === wanted);
    if (r) {
      r.checked = true;
      setService(r, false);
      const pm = getPixelMatrix(glyphCanvas);
      if (pm && motion) {
        /* the canvas draws itself in when it scrolls into view — keep it blank until then */
        pm.cells.fill(0);
        pm.draw();
      }
    }
  }

  /* compose — same format the studio's inbox already receives */
  function compose() {
    const name = value("name");
    const checked = radios.find((r) => r.checked);
    const subject = "New Project Brief — " + name;
    const body =
      "Name: " + name +
      "\nEmail: " + value("email") +
      "\nPhone: " + (value("phone") || "Not provided") +
      "\nService: " + (checked ? checked.value : "Not specified") +
      "\n\nProject details:\n" + value("message");
    const href = "mailto:" + TO + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    return { subject, body, href };
  }

  function say(text, kind) {
    status.textContent = text;
    status.className = "brief-status is-shown" + (kind ? " is-" + kind : "");
  }

  function validateAll() {
    let first = null;
    fields.forEach((f) => {
      f.touched = true;
      if (!check(f) && !first) first = f;
    });
    updateMeter();
    if (first) {
      const n = fields.filter((f) => f.wrap.classList.contains("is-invalid")).length;
      say(n === 1 ? "One field still needs attention. It's marked above." : n + " fields still need attention. They're marked above.", "error");
      first.input.focus({ preventScroll: false });
      if (motion) {
        submit.classList.remove("is-shake");
        void submit.offsetWidth;
        submit.classList.add("is-shake");
      }
      return false;
    }
    return true;
  }

  function celebrate() {
    if (!motion) return;
    gsap.fromTo(meterCells, { scale: 1 }, { scale: 1.8, duration: 0.14, stagger: 0.035, yoyo: true, repeat: 1, ease: "power2.out" });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateAll()) return;
    const brief = compose();
    form.dataset.mailto = brief.href;
    celebrate();
    say("Opening your email app with the brief filled in. Press send there to deliver it — we'll respond within one business day. Nothing happened? Use Copy brief instead.", "ok");
    window.location.href = brief.href;
  });

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (err) {
      return false;
    }
  }

  copyBtn.addEventListener("click", async () => {
    if (!validateAll()) return;
    const brief = compose();
    const text = "To: " + TO + "\nSubject: " + brief.subject + "\n\n" + brief.body;
    form.dataset.brief = text;
    const ok = await copyText(text);
    if (ok) {
      celebrate();
      say("Brief copied. Paste it into an email to " + TO + " and we'll respond within one business day.", "ok");
    } else {
      say("Couldn't reach the clipboard on this device. Email " + TO + " or call 352-858-0481 and we'll take it from there.", "error");
    }
  });

  updateMeter();
  grow();
}
