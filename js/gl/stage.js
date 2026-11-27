/* The voxel stage.
   A few thousand instanced cubes that assemble into the ApplyLogics mark, break
   apart into dust, and re-form as each of the six era glyphs. One draw call;
   all motion (morph arcs, dissolve, pointer push, scan line) runs in the vertex
   shader. The page drives it through `stage.target` (placement), `setShape()`
   and `stage.scatter`. */
import { MARK, ERAS, cells } from "./glyphs.js";
import { gsap, clamp, lerp } from "../core/env.js";

const LATTICE = 36; // every glyph is resolved onto a 36 × 36 voxel lattice
const FOV = 30;
const CAM_Z = 100;

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/* small deterministic PRNG so the sculpture is identical on every visit */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* glyph bitmap → voxel positions, ordered top-to-bottom so that a morph reads
   as a re-stacking rather than a random shuffle */
function voxelise(glyph, depth) {
  const k = LATTICE / glyph.length;
  const pts = [];
  const half = (LATTICE - 1) / 2;
  for (const [cx, cy] of cells(glyph)) {
    for (let sy = 0; sy < k; sy++)
      for (let sx = 0; sx < k; sx++)
        for (let d = 0; d < depth; d++)
          pts.push([cx * k + sx - half, half - (cy * k + sy), d - (depth - 1) / 2]);
  }
  pts.sort((a, b) => b[1] - a[1] || a[0] - b[0] || a[2] - b[2]);
  return pts;
}

const VERT = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec2 aLit;
  attribute vec3 aDust;
  attribute vec4 aSeed;

  uniform float uTime;
  uniform float uMix;
  uniform float uScatter;
  uniform float uCube;
  uniform float uHover;
  uniform float uScan;
  uniform vec2 uPointer;
  uniform vec3 uColA;
  uniform vec3 uColB;

  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vCol;
  varying float vLit;
  varying float vHot;
  varying float vDepth;

  mat3 rotAxis(vec3 a, float ang) {
    float s = sin(ang), c = cos(ang), o = 1.0 - c;
    return mat3(
      o * a.x * a.x + c,       o * a.x * a.y + a.z * s, o * a.z * a.x - a.y * s,
      o * a.x * a.y - a.z * s, o * a.y * a.y + c,       o * a.y * a.z + a.x * s,
      o * a.z * a.x + a.y * s, o * a.y * a.z - a.x * s, o * a.z * a.z + c
    );
  }
  float ease(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

  void main() {
    /* per-cube morph progress, staggered so the form re-stacks in a wave */
    float t = clamp(uMix * 1.5 - aSeed.x * 0.5, 0.0, 1.0);
    float e = ease(t);
    float flight = sin(e * 3.14159265);

    vec3 p = mix(aFrom, aTo, e);
    float ang = flight * (aSeed.y - 0.5) * 2.2;
    float cs = cos(ang), sn = sin(ang);
    p.xz = mat2(cs, -sn, sn, cs) * p.xz;
    p.z += flight * (3.0 + aSeed.z * 12.0);

    float lit = mix(aLit.x, aLit.y, e);

    /* dust drifts forever */
    vec3 drift = vec3(
      sin(uTime * 0.11 + aSeed.x * 6.2832),
      cos(uTime * 0.09 + aSeed.y * 6.2832),
      sin(uTime * 0.07 + aSeed.z * 6.2832)
    ) * 1.8;

    /* dissolve: the whole form lets go into the dust field */
    float sc = clamp(uScatter * 1.7 - aSeed.w * 0.7, 0.0, 1.0);
    sc = ease(sc);
    p = mix(p, aDust, sc);
    lit *= 1.0 - sc;
    p += drift * (1.0 - lit);

    /* idle breathing across the lit form */
    float wave = sin(p.x * 0.21 + p.y * 0.16 + uTime * 1.05);
    p.z += wave * 0.6 * lit;

    /* pointer: cubes lean out of the form toward the viewer */
    vec2 d = p.xy - uPointer;
    float push = smoothstep(8.5, 0.0, length(d)) * uHover * lit;
    p.z += push * 6.0;
    p.xy += normalize(d + 0.0001) * push * 1.3;

    /* a scan line climbs the form */
    float scan = smoothstep(1.4, 0.0, abs(p.y - uScan)) * lit;
    float blink = step(0.992, fract(aSeed.w * 7.13 + uTime * 0.21)) * lit;

    float size = uCube * mix(0.2, 1.0, lit) * (1.0 - 0.3 * flight) * (1.0 + push * 0.25);
    float tumble = flight * 6.2832 * (aSeed.z - 0.5) * 2.0 + (1.0 - lit) * (uTime * 0.35 + aSeed.x * 6.2832);
    mat3 r = rotAxis(normalize(aSeed.xyz - 0.5 + 0.0001), tumble);

    vec4 mv = modelViewMatrix * vec4(p + r * (position * size), 1.0);
    gl_Position = projectionMatrix * mv;

    vNormal = normalize(normalMatrix * (r * normal));
    vLocal = position;
    vLit = lit;
    vHot = clamp(push * 1.1 + scan * 0.7 + blink * 0.9, 0.0, 1.6);
    vCol = mix(uColA, uColB, smoothstep(0.0, 1.0, uMix));
    vDepth = -mv.z;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uFade;
  varying vec3 vNormal;
  varying vec3 vLocal;
  varying vec3 vCol;
  varying float vLit;
  varying float vHot;
  varying float vDepth;

  void main() {
    vec3 n = normalize(vNormal);
    float key = clamp(dot(n, normalize(vec3(0.45, 0.75, 0.55))), 0.0, 1.0);
    float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0);

    /* luminous edges: the second-largest local coordinate approaches 1 on an edge */
    vec3 a = abs(vLocal) * 2.0;
    float second = max(min(a.x, a.y), max(min(a.y, a.z), min(a.x, a.z)));
    float edge = smoothstep(0.8, 0.96, second);

    vec3 body = vCol * (0.05 + 0.34 * key + 0.1 * rim);
    vec3 col = body + vCol * edge * 0.5 + mix(vCol, vec3(1.0), 0.35) * vHot;

    vec3 dust = mix(vec3(0.93, 0.92, 0.89), vCol, 0.3) * (0.18 + 0.42 * key + edge * 0.25);
    col = mix(dust, col, vLit);

    /* far cubes sink into the dark */
    float fog = smoothstep(${(CAM_Z + 4).toFixed(1)}, ${(CAM_Z + 60).toFixed(1)}, vDepth);
    col *= 1.0 - fog * 0.9;

    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;

const HALO_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const HALO_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uCol;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.4) * uAlpha;
    gl_FragColor = vec4(uCol * a, a);
  }
`;

export async function createStage(canvas, { compact = false } = {}) {
  let THREE;
  try {
    THREE = await import("../vendor/three.module.min.js");
  } catch (e) {
    return null;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
  camera.position.z = CAM_Z;
  const group = new THREE.Group();
  scene.add(group);

  /* ---- shapes ---- */
  const depth = compact ? 2 : 3;
  const shapes = { mark: { pts: voxelise(MARK, depth), col: hex("#00ff88") } };
  ERAS.forEach((era) => (shapes[era.key] = { pts: voxelise(era.glyph, depth), col: hex(era.color) }));
  const maxPts = Math.max(...Object.values(shapes).map((s) => s.pts.length));
  const N = maxPts + (compact ? 260 : 620);

  const rnd = mulberry(20260);
  const dust = new Float32Array(N * 3);
  const seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    /* a wide, shallow cloud that fills the frame at any aspect ratio */
    dust[i * 3] = (rnd() - 0.5) * 150;
    dust[i * 3 + 1] = (rnd() - 0.5) * 84;
    dust[i * 3 + 2] = -46 + rnd() * 62;
    seed[i * 4] = rnd();
    seed[i * 4 + 1] = rnd();
    seed[i * 4 + 2] = rnd();
    seed[i * 4 + 3] = rnd();
  }

  /* resolve a shape onto the N instances: its points are spread evenly through
     the instance list, everything left over stays dust */
  function resolve(key) {
    const pos = new Float32Array(dust);
    const lit = new Float32Array(N);
    if (key && shapes[key]) {
      const pts = shapes[key].pts;
      const K = pts.length;
      for (let j = 0; j < K; j++) {
        const i = Math.floor((j * N) / K);
        pos[i * 3] = pts[j][0];
        pos[i * 3 + 1] = pts[j][1];
        pos[i * 3 + 2] = pts[j][2];
        lit[i] = 1;
      }
    }
    return { pos, lit };
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = box.index;
  geo.setAttribute("position", box.getAttribute("position"));
  geo.setAttribute("normal", box.getAttribute("normal"));
  geo.instanceCount = N;

  const blank = resolve(null);
  const aFrom = new THREE.InstancedBufferAttribute(new Float32Array(blank.pos), 3);
  const aTo = new THREE.InstancedBufferAttribute(new Float32Array(blank.pos), 3);
  const aLit = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2);
  geo.setAttribute("aFrom", aFrom);
  geo.setAttribute("aTo", aTo);
  geo.setAttribute("aLit", aLit);
  geo.setAttribute("aDust", new THREE.InstancedBufferAttribute(dust, 3));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4));

  const uniforms = {
    uTime: { value: 0 },
    uMix: { value: 1 },
    uScatter: { value: 0 },
    uCube: { value: 0.8 },
    uHover: { value: 0 },
    uScan: { value: -30 },
    uFade: { value: 1 },
    uPointer: { value: new THREE.Vector2(999, 999) },
    uColA: { value: new THREE.Vector3(...shapes.mark.col) },
    uColB: { value: new THREE.Vector3(...shapes.mark.col) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  group.add(mesh);

  const haloUniforms = { uCol: { value: new THREE.Vector3(...shapes.mark.col) }, uAlpha: { value: 0 } };
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: haloUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    })
  );
  halo.position.z = -8;
  halo.renderOrder = -1;
  group.add(halo);

  /* ---- state the page drives ---- */
  const stage = {
    ready: true,
    count: N,
    /* placement, in viewport fractions from centre (x right, y up); scale 1 =
       the lattice spans ~2/3 of the viewport height */
    target: { x: 0, y: 0, scale: 1, opacity: 0, tilt: 0 },
    now: { x: 0, y: 0, scale: 1, opacity: 0, tilt: 0 },
    scatter: 0,
    shape: null,
    running: true,
  };

  let current = { key: null, ...blank };
  let morph = null;
  let visW = 1;
  let visH = 1;
  let lightness = 0; // how much of the form is assembled, for the halo

  function commit(next, key) {
    aFrom.array.set(next.pos);
    aTo.array.set(next.pos);
    for (let i = 0; i < N; i++) {
      aLit.array[i * 2] = next.lit[i];
      aLit.array[i * 2 + 1] = next.lit[i];
    }
    aFrom.needsUpdate = aTo.needsUpdate = aLit.needsUpdate = true;
    const col = key && shapes[key] ? shapes[key].col : current.key ? shapes[current.key].col : shapes.mark.col;
    uniforms.uColA.value.set(...col);
    uniforms.uColB.value.set(...col);
    uniforms.uMix.value = 1;
    current = { key, ...next };
  }

  stage.setShape = (key, { immediate = false, duration = 1.7 } = {}) => {
    if (key === stage.shape) return;
    stage.shape = key;
    if (morph) {
      morph.kill();
      morph = null;
      commit(current.pending, current.pendingKey);
    }
    const next = resolve(key);
    if (immediate) {
      commit(next, key);
      return;
    }
    aFrom.array.set(current.pos);
    aTo.array.set(next.pos);
    for (let i = 0; i < N; i++) {
      aLit.array[i * 2] = current.lit[i];
      aLit.array[i * 2 + 1] = next.lit[i];
    }
    aFrom.needsUpdate = aTo.needsUpdate = aLit.needsUpdate = true;
    const from = current.key && shapes[current.key] ? shapes[current.key].col : shapes[key] ? shapes[key].col : shapes.mark.col;
    const to = key && shapes[key] ? shapes[key].col : from;
    uniforms.uColA.value.set(...from);
    uniforms.uColB.value.set(...to);
    uniforms.uMix.value = 0;
    current.pending = next;
    current.pendingKey = key;
    morph = gsap.to(uniforms.uMix, {
      value: 1,
      duration,
      ease: "none",
      onComplete: () => {
        morph = null;
        commit(next, key);
      },
    });
  };

  /* ---- pointer ---- */
  const pointer = { x: 0, y: 0, nx: 0, ny: 0, active: 0, last: 0 };
  const onMove = (e) => {
    if (e.pointerType === "touch") return;
    pointer.nx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ny = -((e.clientY / window.innerHeight) * 2 - 1);
    pointer.last = performance.now();
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  /* ---- size ---- */
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    visH = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360);
    visW = visH * camera.aspect;
  }
  resize();
  let rt;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(resize, 120);
  };
  window.addEventListener("resize", onResize);

  /* ---- frame ---- */
  let first = true;
  function frame(time, dt) {
    const n = stage.now;
    const tg = stage.target;
    const k = first ? 1 : 1 - Math.pow(0.0015, Math.min(dt, 100) / 1000); // framerate-independent ease
    first = false;
    n.x = lerp(n.x, tg.x, k);
    n.y = lerp(n.y, tg.y, k);
    n.scale = lerp(n.scale, tg.scale, k);
    n.tilt = lerp(n.tilt, tg.tilt, k);
    n.opacity = lerp(n.opacity, tg.opacity, Math.min(1, k * 1.6));
    canvas.style.opacity = n.opacity < 0.004 ? "0" : n.opacity.toFixed(3);
    if (!stage.running || n.opacity < 0.004 || document.hidden) return;

    pointer.x = lerp(pointer.x, pointer.nx, 0.06);
    pointer.y = lerp(pointer.y, pointer.ny, 0.06);
    const moving = performance.now() - pointer.last < 2200 ? 1 : 0;
    pointer.active = lerp(pointer.active, moving, 0.05);

    const s = (visH / 53.6) * n.scale * (53.6 / 54); // lattice units → world units
    group.scale.setScalar(s);
    group.position.set(n.x * visW, n.y * visH, 0);
    group.rotation.y = pointer.x * 0.32 + Math.sin(time * 0.23) * 0.07 + n.tilt;
    group.rotation.x = -pointer.y * 0.16 + Math.cos(time * 0.19) * 0.04;

    /* pointer on the z = 0 plane, in lattice units relative to the form */
    uniforms.uPointer.value.set(
      ((pointer.x * visW) / 2 - group.position.x) / s,
      ((pointer.y * visH) / 2 - group.position.y) / s
    );
    uniforms.uHover.value = pointer.active;
    uniforms.uTime.value = time;
    uniforms.uScatter.value = stage.scatter;
    uniforms.uScan.value = ((time * 9) % 70) - 26;

    const mix = uniforms.uMix.value;
    const litNow = current.key ? 1 : 0;
    const litNext = morph ? (current.pendingKey ? 1 : 0) : litNow;
    lightness = lerp(litNow, litNext, mix) * (1 - clamp(stage.scatter * 1.4));
    haloUniforms.uAlpha.value = lerp(haloUniforms.uAlpha.value, 0.2 * lightness, 0.08);
    haloUniforms.uCol.value.lerpVectors(uniforms.uColA.value, uniforms.uColB.value, mix);

    renderer.render(scene, camera);
  }
  const tick = (time, dt) => frame(time, dt);
  gsap.ticker.add(tick);

  stage.resize = resize;
  stage.uniforms = uniforms;
  stage.destroy = () => {
    gsap.ticker.remove(tick);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("resize", onResize);
    renderer.dispose();
  };
  return stage;
}
