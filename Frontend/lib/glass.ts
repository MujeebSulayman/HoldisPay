"use client";

/*
 * Liquid glass (ported from Prinet): a WebGL backdrop (soft drifting color fields) with every
 * element marked `data-lg` drawn as real refracting glass on top. Falls back to plain CSS
 * glass when WebGL is unavailable or too slow. Follows the site theme (light / dark).
 */

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const MAXS = 14;

// uL blends the dark scene (0) into the light one (1).
const FS = `
precision highp float;
uniform vec2 uRes; uniform float uScale; uniform float uTime; uniform vec2 uMouse; uniform float uScroll; uniform int uN;
uniform vec4 uRect[${MAXS}]; uniform vec4 uMeta[${MAXS}]; uniform vec4 uTint[${MAXS}]; uniform float uL;

float blob(vec2 p, vec2 c, float r){ vec2 d = (p - c) / r; return exp(-dot(d, d)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 th(vec3 dark, vec3 light){ return mix(dark, light, uL); }

vec3 scene(vec2 p, float soft){
  vec2 q = p / uRes.y;
  q.y += uScroll / uRes.y * 0.18;
  float ar = uRes.x / uRes.y, t = uTime * 0.035;
  vec3 col = th(vec3(.010, .016, .026), vec3(.955, .968, .988));
  col = mix(col, th(vec3(.49, .84, 1.0), vec3(.70, .90, .97)), th(vec3(.10), vec3(.55)).x * blob(q, vec2(ar * .12 + .05 * sin(t * 1.1), -.05 + .05 * cos(t)), .55));
  col = mix(col, th(vec3(.05, .42, .58), vec3(.55, .80, .86)), th(vec3(.14), vec3(.45)).x * blob(q, vec2(ar * .78 + .08 * cos(t * .8), .02 + .06 * sin(t * .9)), .62));
  col = mix(col, th(vec3(.04, .06, .16), vec3(.84, .84, .98)), .45 * blob(q, vec2(ar * .22 + .06 * sin(t * .7), .60 + .08 * cos(t * .8)), .58));

  vec2 v = q / vec2(ar, 1.) - .5;
  col *= 1. - th(vec3(.35), vec3(.10)).x * dot(v, v);
  return clamp(col, 0., 1.);
}

float sdRB(vec2 p, vec2 h, float r){ vec2 q = abs(p) - h + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }

float field(vec2 p, float kind, out vec4 tint){
  float d = 1e5, best = 1e5; tint = vec4(0.);
  for (int i = 0; i < ${MAXS}; i++){
    if (i >= uN) break;
    if (abs(uMeta[i].y - kind) > .5) continue;
    vec4 r = uRect[i]; vec2 c = r.xy + r.zw * .5;
    float di = sdRB(p - c, r.zw * .5, min(uMeta[i].x, min(r.z, r.w) * .5));
    d = d > 9e4 ? di : smin(d, di, kind > .5 ? 9. : 2.);
    if (di < best){ best = di; tint = uTint[i]; }
  }
  return d;
}
float fieldD(vec2 p, float kind){ vec4 t; return field(p, kind, t); }

vec3 glass(vec2 p, float d, vec2 n, vec4 tint, float kind){
  float thick = kind > .5 ? 13. : 34.;
  float t = clamp(-d / thick, 0., 1.), e = 1. - t;
  float bend = pow(e, 1.7);
  vec2 off = -n * bend * thick * 1.15;
  float soft = kind > .5 ? .35 + .3 * t : smoothstep(0., .5, t) * .7;
  vec3 c;
  c.r = scene(p + off * 1.00, soft).r;
  c.g = scene(p + off * 1.03, soft).g;
  c.b = scene(p + off * 1.06, soft).b;
  float frost = kind > .5 ? .06 + .08 * t : mix(.04, .26, smoothstep(0., .5, t));
  c = mix(c, th(vec3(.022, .030, .044), vec3(.980, .986, .996)), frost);
  c = mix(c, tint.rgb, tint.a * (.6 + .4 * t));
  vec2 L = normalize(mix(vec2(-.35, -.94), normalize(uMouse - p + .001), .35));
  float facing = dot(n, L);
  float rim = pow(e, kind > .5 ? 5. : 7.);
  c += (max(facing, 0.) * .9 + .12) * rim * mix(.7, .45, uL);
  c += pow(max(-facing, 0.), 2.) * pow(e, 8.) * .25;
  c *= 1. - mix(.16, .08, uL) * smoothstep(.4, 1., e) * (.5 + .5 * max(-facing, 0.));
  float edgeLine = 1. - smoothstep(0., 1.3, abs(d + .6));
  c += edgeLine * (.16 + .45 * max(facing, 0.)) * mix(1., .6, uL);
  return c;
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uScale - gl_FragCoord.y) / uScale;
  vec3 col = scene(p, 0.);
  vec4 tS; float dS = field(p, 0., tS);
  float sh = fieldD(p - vec2(0., 16.), 0.);
  col *= 1. - mix(.5, .18, uL) * exp(-max(sh, 0.) / 30.) * step(0., dS);
  if (dS < 1.5){
    vec2 e = vec2(1., 0.);
    vec2 n = normalize(vec2(fieldD(p + e.xy, 0.) - fieldD(p - e.xy, 0.), fieldD(p + e.yx, 0.) - fieldD(p - e.yx, 0.)) + 1e-5);
    col = mix(col, glass(p, dS, n, tS, 0.), smoothstep(1., -1., dS));
  }
  vec4 tD; float dD = field(p, 1., tD);
  float shd = fieldD(p - vec2(0., 6.), 1.);
  col *= 1. - mix(.3, .12, uL) * exp(-max(shd, 0.) / 9.) * step(0., dD);
  if (dD < 1.5){
    vec2 e = vec2(1., 0.);
    vec2 n = normalize(vec2(fieldD(p + e.xy, 1.) - fieldD(p - e.xy, 1.), fieldD(p + e.yx, 1.) - fieldD(p - e.yx, 1.)) + 1e-5);
    col = mix(col, glass(p, dD, n, tD, 1.), smoothstep(1., -1., dD));
  }
  col += (hash(p + uTime) - .5) / 255.;
  gl_FragColor = vec4(col, 1.);
}`;
const VS = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;

// Glass tints per theme: [r, g, b, strength].
const TINTS: Record<"dark" | "light", Record<string, number[]>> = {
  dark: {
    surface: [0.016, 0.024, 0.032, 0.34],
    card: [0.016, 0.024, 0.032, 0.42],
    knob: [0.016, 0.024, 0.032, 0.58],
    steel: [0.72, 0.88, 0.95, 0.1],
  },
  light: {
    surface: [0.98, 0.985, 1, 0.34],
    card: [0.98, 0.985, 1, 0.46],
    knob: [1, 1, 1, 0.62],
    steel: [1, 1, 1, 0.2],
  },
};

const isPhone = () => window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
const isLight = () => document.documentElement.dataset.theme === "light";

function makeGL(cv: HTMLCanvasElement) {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = cv.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  } catch {}
  if (!gl) return null;
  const g = gl;
  const sh = (type: number, src: string) => {
    const s = g.createShader(type)!;
    g.shaderSource(s, src);
    g.compileShader(s);
    return g.getShaderParameter(s, g.COMPILE_STATUS) ? s : null;
  };
  const v = sh(g.VERTEX_SHADER, VS);
  const f = sh(g.FRAGMENT_SHADER, FS);
  if (!v || !f) return null;
  const prog = g.createProgram()!;
  g.attachShader(prog, v);
  g.attachShader(prog, f);
  g.linkProgram(prog);
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) return null;
  g.useProgram(prog);
  const b = g.createBuffer();
  g.bindBuffer(g.ARRAY_BUFFER, b);
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
  const loc = g.getAttribLocation(prog, "a");
  g.enableVertexAttribArray(loc);
  g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  const U: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ["uRes", "uScale", "uTime", "uMouse", "uScroll", "uN", "uRect", "uMeta", "uTint", "uL"]) {
    U[n] = g.getUniformLocation(prog, n);
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  const weak = (nav.deviceMemory && nav.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  let scale = Math.min(window.devicePixelRatio || 1, isPhone() ? (weak ? 0.55 : 0.75) : 1.25);
  const rect = new Float32Array(MAXS * 4);
  const meta = new Float32Array(MAXS * 4);
  const tint = new Float32Array(MAXS * 4);
  const morph = new WeakMap<Element, { x: number; v: number; start: number }>();
  const t0 = performance.now();
  let light = isLight() ? 1 : 0;
  let frames = 0;
  let acc = 0;
  let on = true;

  const resize = () => {
    cv.width = Math.round(cv.clientWidth * scale);
    cv.height = Math.round(cv.clientHeight * scale);
    g.viewport(0, 0, cv.width, cv.height);
  };
  resize();

  const collect = (now: number, dt: number) => {
    let n = 0;
    if (document.documentElement.classList.contains("scrolling")) return 0;
    const H = window.innerHeight;
    const tints = TINTS[isLight() ? "light" : "dark"];
    for (const el of document.querySelectorAll<HTMLElement>("[data-lg]")) {
      if (n >= MAXS) break;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.bottom < -60 || r.top > H + 60) continue;
      const kind = el.dataset.lg === "drop" ? 1 : 0;
      let m = morph.get(el);
      if (!m) {
        m = { x: reduced() ? 1 : 0, v: 0, start: now };
        morph.set(el, m);
      }
      // New glass grows out of a small pill with a spring.
      if ((now >= m.start && m.x < 1.0005) || Math.abs(m.v) > 0.001) {
        const a = -70 * (m.x - 1) - 15 * m.v;
        m.v += a * dt;
        m.x += m.v * dt;
      }
      if ((m.x > 0.55 || now - m.start > 900) && !el.classList.contains("lg-shown")) el.classList.add("lg-shown");
      const k = Math.max(0, m.x);
      const w0 = kind ? Math.min(r.height, r.width) : Math.min(r.width, 140);
      const h0 = kind ? r.height * 0.8 : Math.min(r.height, 60);
      const w = w0 + (r.width - w0) * k;
      const h = h0 + (r.height - h0) * Math.min(1.08, k);
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      rect.set([cx - w / 2, cy - h / 2, w, h], n * 4);
      const rad = el.dataset.lgR ? Number(el.dataset.lgR) : r.height / 2;
      meta.set([rad, kind, 0, 0], n * 4);
      tint.set(tints[el.dataset.lgTint ?? ""] ?? (kind ? tints.knob : tints.surface), n * 4);
      n++;
    }
    return n;
  };

  return {
    get on() {
      return on;
    },
    resize,
    draw(now: number, dt: number, mouse: [number, number]) {
      if (!on) return;
      const n = collect(now, Math.min(dt, 1 / 30));
      // Ease between themes instead of snapping.
      light += ((isLight() ? 1 : 0) - light) * Math.min(1, dt * 6);
      g.uniform2f(U.uRes, cv.clientWidth, cv.clientHeight);
      g.uniform1f(U.uScale, scale);
      g.uniform1f(U.uTime, reduced() ? 0 : (now - t0) / 1000);
      g.uniform2f(U.uMouse, mouse[0], mouse[1]);
      g.uniform1f(U.uScroll, window.scrollY);
      g.uniform1i(U.uN, n);
      g.uniform4fv(U.uRect, rect);
      g.uniform4fv(U.uMeta, meta);
      g.uniform4fv(U.uTint, tint);
      g.uniform1f(U.uL, light);
      g.drawArrays(g.TRIANGLES, 0, 3);
      // Drop resolution, then switch off entirely, if frames are too slow.
      frames++;
      acc += dt;
      if (frames === 60) {
        const avg = (acc / frames) * 1000;
        frames = 0;
        acc = 0;
        if (avg > 24 && scale > 0.5) {
          scale = Math.max(0.5, scale * 0.72);
          resize();
        } else if (avg > 30) this.off();
      }
    },
    off() {
      on = false;
      document.documentElement.classList.remove("gl");
      cv.style.display = "none";
      document.querySelectorAll("[data-lg]").forEach((el) => el.classList.add("lg-shown"));
    },
  };
}

export function startGlass(cv: HTMLCanvasElement) {
  const html = document.documentElement;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const weak = (nav.deviceMemory && nav.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  html.classList.toggle("lite", !!weak);
  const gl = makeGL(cv);
  if (gl) html.classList.add("gl");
  else cv.style.display = "none";
  let mouse: [number, number] = [window.innerWidth * 0.3, -300];
  const onMove = (e: PointerEvent) => {
    mouse = [e.clientX, e.clientY];
    if (reduced() || html.classList.contains("lite")) return;
    // Panels catch a soft highlight under the pointer.
    const el = (e.target as Element | null)?.closest?.(".glass") as HTMLElement | null;
    if (!el) return;
    const b = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - b.left}px`);
    el.style.setProperty("--my", `${e.clientY - b.top}px`);
  };
  let still: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    if (gl?.on) gl.resize();
  };
  // While scrolling, glass falls back to CSS so the backdrop never lags behind the page.
  const onScroll = () => {
    if (!html.classList.contains("scrolling")) html.classList.add("scrolling");
    clearTimeout(still);
    still = setTimeout(() => html.classList.remove("scrolling"), 160);
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("wheel", onScroll, { passive: true });
  window.addEventListener("touchmove", onScroll, { passive: true });
  let last = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    if (!document.hidden) {
      gl?.draw(now, dt || 1 / 60, mouse);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("wheel", onScroll);
    window.removeEventListener("touchmove", onScroll);
    clearTimeout(still);
    html.classList.remove("scrolling");
  };
}
