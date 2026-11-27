# ApplyLogics Studio

Website for [applylogics.com](https://applylogics.com) — a design and engineering studio in Ocala, Florida.

> Stay on the right side of history.

## Stack

No build step. Plain HTML, CSS and ES modules, served by a tiny Node static server.

- **GSAP 3.13** (+ ScrollTrigger, SplitText) for motion, **Lenis** for smooth scroll, **three.js** for the WebGL stage. All vendored in `js/vendor/`; nothing is loaded from a CDN.
- Fonts are self-hosted in `assets/fonts/`: Mona Sans (variable, weight + width), Instrument Serif, JetBrains Mono.

## Layout

```
index.html            home page
contact.html          project brief (opens the visitor's email app; there is no backend)
404.html              not-found page, served by serve.js
serve.js              static file server (PORT, default 8643)
css/
  base.css            design tokens, type, shared components (nav, buttons, cursor, footer)
  home.css            home sections
  lab.css             the three interactive exhibits
  contact.css         contact page
js/
  home.js             home entry + the "director" that maps scroll position to the voxel stage
  contact.js          contact entry
  core/               env flags, smooth scroll
  ui/                 cursor, magnetic buttons, nav, clock, pixel page transition, PixelMatrix (2D glyphs)
  gl/glyphs.js        every pixel glyph on the site (the mark, six eras, service icons)
  gl/stage.js         instanced-cube WebGL stage that morphs between glyphs
  sections/           intro + hero, story (marquee, mission, film, eras), work (services, solutions, results, CTA), lab
assets/               fonts, favicons, share images, film
```

## Local development

```bash
node serve.js          # http://localhost:8643
```

## Brand

- Ink `#060807`, bone `#EDEBE4`, signal green `#00FF88`.
- Three voices: Mona Sans (wide, heavy) for statements, Instrument Serif italic for the "studio" accent, JetBrains Mono for labels and data.
- The pixel "A" mark is the source of the whole visual system: glyphs, cursor, bullets and transitions are all built from the same square.

## Behaviour notes

- Honors `prefers-reduced-motion`: no smooth scroll, no pinned scenes, no WebGL; all content stays readable.
- Works without JavaScript and without WebGL (the eras fall back to 2D pixel glyphs).
- To change contact details, search for `352-858-0481` and `Ocala` across `index.html`, `contact.html` and `js/contact.js`.
