(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none)").matches;
  var hasGSAP = typeof gsap !== "undefined";

  if (hasGSAP) {
    document.documentElement.classList.add("has-gsap");
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ============ THREE.JS — particle grid / data field ============ */
  var threeOK = false;
  var mouse = { x: 0, y: 0 };
  (function initThree() {
    if (typeof THREE === "undefined" || prefersReduced) return;
    var canvas = document.getElementById("webgl");
    if (!canvas) return;

    try {
      var renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: false,
        alpha: true,
        powerPreference: "high-performance"
      });
      var DPR = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
      renderer.setPixelRatio(DPR);

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.set(0, 2.2, 7);
      camera.lookAt(0, 0, 0);

      var COLS = isTouch ? 70 : 110;
      var ROWS = isTouch ? 40 : 60;
      var COUNT = COLS * ROWS;
      var SPREAD_X = 26;
      var SPREAD_Z = 16;

      var positions = new Float32Array(COUNT * 3);
      var seeds = new Float32Array(COUNT);
      var i = 0;
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          positions[i * 3] = (c / (COLS - 1) - 0.5) * SPREAD_X;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = (r / (ROWS - 1) - 0.5) * SPREAD_Z;
          seeds[i] = Math.random() * Math.PI * 2;
          i++;
        }
      }

      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

      var mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uMouse: { value: new THREE.Vector2(0, 0) },
          uPixelRatio: { value: DPR }
        },
        vertexShader: [
          "uniform float uTime;",
          "uniform vec2 uMouse;",
          "uniform float uPixelRatio;",
          "attribute float aSeed;",
          "varying float vIntensity;",
          "void main() {",
          "  vec3 p = position;",
          "  float wave = sin(p.x * 0.45 + uTime * 0.8) * cos(p.z * 0.55 + uTime * 0.6);",
          "  float wave2 = sin(p.x * 0.12 + p.z * 0.2 + uTime * 0.4);",
          "  p.y += wave * 0.55 + wave2 * 0.8;",
          "  float md = distance(p.xz * 0.07, uMouse);",
          "  float lift = smoothstep(0.45, 0.0, md);",
          "  p.y += lift * 1.6;",
          "  float tw = 0.5 + 0.5 * sin(uTime * 2.0 + aSeed);",
          "  vIntensity = clamp(0.18 + lift * 1.2 + tw * 0.25 + max(wave, 0.0) * 0.3, 0.0, 1.0);",
          "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
          "  gl_Position = projectionMatrix * mv;",
          "  gl_PointSize = (1.6 + lift * 3.0 + tw * 0.8) * uPixelRatio * (8.0 / -mv.z);",
          "}"
        ].join("\n"),
        fragmentShader: [
          "varying float vIntensity;",
          "void main() {",
          "  vec2 uv = gl_PointCoord - 0.5;",
          "  float d = length(uv);",
          "  if (d > 0.5) discard;",
          "  float a = smoothstep(0.5, 0.0, d) * vIntensity;",
          "  gl_FragColor = vec4(0.0, 1.0, 0.533, a);",
          "}"
        ].join("\n")
      });

      var points = new THREE.Points(geo, mat);
      points.position.y = -1.4;
      scene.add(points);

      function resize() {
        var w = canvas.clientWidth || canvas.parentElement.clientWidth;
        var h = canvas.clientHeight || canvas.parentElement.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resize();
      window.addEventListener("resize", resize);

      var targetMouse = new THREE.Vector2(0, 0);
      window.addEventListener("pointermove", function (e) {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        targetMouse.set(mouse.x * 0.9, -mouse.y * 0.55);
      }, { passive: true });

      var clock = new THREE.Clock();
      var heroEl = document.getElementById("hero");
      var heroVisible = true;
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          heroVisible = entries[0].isIntersecting;
        }).observe(heroEl);
      }

      function tick() {
        requestAnimationFrame(tick);
        if (!heroVisible || document.hidden) return;
        var t = clock.getElapsedTime();
        mat.uniforms.uTime.value = t;
        mat.uniforms.uMouse.value.lerp(targetMouse, 0.06);
        camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.03;
        camera.position.y += (2.2 + mouse.y * 0.3 - camera.position.y) * 0.03;
        camera.lookAt(0, -0.4, 0);
        renderer.render(scene, camera);
      }
      tick();
      threeOK = true;
    } catch (err) {
      console.warn("WebGL init failed:", err);
    }
  })();

  /* ============ Loader ============ */
  (function loader() {
    var loaderEl = document.getElementById("loader");
    if (!loaderEl) return;
    if (prefersReduced || !hasGSAP) {
      loaderEl.style.display = "none";
      revealHero(true);
      return;
    }
    var cmdEl = document.getElementById("loader-cmd");
    var fill = document.getElementById("loader-bar-fill");
    var pct = document.getElementById("loader-pct");
    var cmd = "init --digital-solutions";
    var ci = 0;

    var typeInt = setInterval(function () {
      cmdEl.textContent = cmd.slice(0, ++ci);
      if (ci >= cmd.length) clearInterval(typeInt);
    }, 28);

    var prog = { v: 0 };
    gsap.to(prog, {
      v: 100,
      duration: 1.5,
      ease: "power2.inOut",
      delay: 0.45,
      onUpdate: function () {
        var p = Math.round(prog.v);
        fill.style.width = p + "%";
        pct.textContent = p + "%";
      },
      onComplete: function () {
        gsap.to(loaderEl, {
          yPercent: -100,
          duration: 0.7,
          ease: "power4.inOut",
          onComplete: function () { loaderEl.style.display = "none"; }
        });
        revealHero(false);
      }
    });
  })();

  function revealHero(instant) {
    var lines = document.querySelectorAll(".hero-line-inner");
    var fades = document.querySelectorAll("[data-hero-fade]");
    if (instant || !hasGSAP) {
      lines.forEach(function (l) { l.style.transform = "none"; });
      fades.forEach(function (f) { f.style.opacity = 1; });
      return;
    }
    gsap.to(lines, {
      y: 0,
      duration: 1.1,
      stagger: 0.12,
      ease: "power4.out",
      delay: 0.15
    });
    gsap.fromTo(fades,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: "power3.out", delay: 0.55 }
    );
  }

  if (!hasGSAP) revealHero(true);

  /* ============ GSAP scroll animations ============ */
  if (hasGSAP && !prefersReduced) {

    gsap.to("#scroll-progress", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: document.body, start: "top top", end: "max", scrub: 0.3 }
    });

    document.querySelectorAll("[data-split]").forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map(function (w) {
        return '<span class="word"><span class="word-inner">' + w + "</span></span>";
      }).join(" ");
      gsap.to(el.querySelectorAll(".word-inner"), {
        y: 0,
        duration: 0.9,
        stagger: 0.045,
        ease: "power4.out",
        scrollTrigger: { trigger: el, start: "top 85%" }
      });
    });

    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      gsap.fromTo(el,
        { opacity: 0, y: 36 },
        {
          opacity: 1, y: 0, duration: 0.85, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" }
        }
      );
    });

    document.querySelectorAll(".counter").forEach(function (el) {
      var target = parseInt(el.getAttribute("data-target"), 10);
      var obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%" },
        onUpdate: function () { el.textContent = Math.round(obj.v); }
      });
    });

    gsap.to("#marquee-track", {
      xPercent: -50,
      ease: "none",
      duration: 22,
      repeat: -1
    });

    if (!isTouch) {
      gsap.to(".hero-terminal", {
        y: -70,
        ease: "none",
        scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 0.5 }
      });
    }
  } else {
    document.querySelectorAll("[data-reveal], [data-split]").forEach(function (el) {
      el.style.opacity = 1;
    });
    document.querySelectorAll(".counter").forEach(function (el) {
      el.textContent = el.getAttribute("data-target");
    });
    document.querySelectorAll(".word-inner").forEach(function (el) { el.style.transform = "none"; });
  }

  /* ============ Nav scroll state ============ */
  var nav = document.getElementById("nav");
  function onScroll() {
    nav.classList.toggle("scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ============ Mobile menu ============ */
  var burger = document.getElementById("nav-burger");
  var menu = document.getElementById("mobile-menu");
  function closeMenu() {
    burger.classList.remove("open");
    menu.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  burger.addEventListener("click", function () {
    var open = !menu.classList.contains("open");
    burger.classList.toggle("open", open);
    menu.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
  });
  menu.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", closeMenu);
  });

  /* ============ Smooth anchor scroll ============ */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var y = target.getBoundingClientRect().top + window.scrollY - 70;
      if (hasGSAP && !prefersReduced) {
        gsap.to(window, { scrollTo: undefined, duration: 0 });
        window.scrollTo({ top: y, behavior: "smooth" });
      } else {
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    });
  });

  /* ============ Evolve section ============ */
  (function () {
    var video = document.getElementById("evolve-video");
    if (!video) return;
    if (prefersReduced) {
      video.removeAttribute("autoplay");
      video.pause();
    } else if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { video.play().catch(function () {}); }
          else { video.pause(); }
        });
      }, { threshold: 0.2 });
      io.observe(video);
    }
    if (hasGSAP && !prefersReduced) {
      gsap.from(".evolve-media", {
        opacity: 0, y: 60, scale: 0.96, duration: 1.1, ease: "power3.out",
        scrollTrigger: { trigger: ".evolve-media", start: "top 85%" }
      });
    }
  })();

  /* ============ Custom cursor + magnetic ============ */
  if (!isTouch && hasGSAP && !prefersReduced) {
    var dot = document.getElementById("cursor-dot");
    var ring = document.getElementById("cursor-ring");
    var dotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power2.out" });
    var dotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power2.out" });
    var ringX = gsap.quickTo(ring, "x", { duration: 0.32, ease: "power2.out" });
    var ringY = gsap.quickTo(ring, "y", { duration: 0.32, ease: "power2.out" });

    window.addEventListener("pointermove", function (e) {
      dotX(e.clientX); dotY(e.clientY);
      ringX(e.clientX); ringY(e.clientY);
    }, { passive: true });

    document.querySelectorAll("a, button, .service-row").forEach(function (el) {
      el.addEventListener("pointerenter", function () { ring.classList.add("is-hover"); });
      el.addEventListener("pointerleave", function () { ring.classList.remove("is-hover"); });
    });

    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      var xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
      el.addEventListener("pointermove", function (e) {
        var b = el.getBoundingClientRect();
        xTo((e.clientX - b.left - b.width / 2) * 0.25);
        yTo((e.clientY - b.top - b.height / 2) * 0.35);
      });
      el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });

    /* Tilt cards */
    document.querySelectorAll("[data-tilt]").forEach(function (card) {
      var rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power2.out" });
      var ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power2.out" });
      gsap.set(card, { transformPerspective: 800 });
      card.addEventListener("pointermove", function (e) {
        var b = card.getBoundingClientRect();
        ry(((e.clientX - b.left) / b.width - 0.5) * 7);
        rx(-((e.clientY - b.top) / b.height - 0.5) * 7);
      });
      card.addEventListener("pointerleave", function () { rx(0); ry(0); });
    });
  }

})();
