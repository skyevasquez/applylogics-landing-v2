# ApplyLogics Website

Modern landing page for [applylogics.com](https://applylogics.com).

## Stack
- Vanilla HTML / CSS / JS (no build step)
- [GSAP](https://greensock.com/gsap/) + ScrollTrigger for scroll animations
- [Three.js](https://threejs.org/) for the hero particle field
- Static asset hosting, no backend required

## Files
- `index.html` — landing page
- `contact.html` — project brief / contact page
- `style.css`, `contact.css` — page styles
- `main.js`, `contact.js` — page scripts (GSAP, Three.js, ScrollTrigger)
- `serve.js` — minimal Node static file server
- `assets/` — logo mark and looped intro video

## Local development
```bash
node serve.js          # http://localhost:8643
```

## Brand theme
- Background `#0C0C0C`, secondary `#161616`
- Accent `#00FF88` (terminal green)
- Monospace: JetBrains Mono; Headlines: Space Grotesk

## Notes
- Designed mobile-first; verified at 390px and 1440px viewports
- Respects `prefers-reduced-motion`
- Honors WCAG AA contrast for body text and links
