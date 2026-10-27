/**
 * Windows layout desktop: calm dot field on a canvas.
 * Ported from the layouts redesign reference (`desk-dots.js`), itself derived from
 * the shellui.com hero dots: three to four times slower, half the travel, no pointer play.
 * Decorative only. The caller mounts it on an `aria-hidden` host.
 */
export const DESK_DOTS = {
  /** Grid spacing in px (same as the website). */
  spacing: 24,
  /** Dot radius in px. */
  radius: 1.1,
  /** Base alpha of `--foreground` in light mode. */
  alphaLight: 0.15,
  /** Base alpha of `--foreground` in dark mode. */
  alphaDark: 0.11,
  /** One dot in this many is tinted with `--primary`. */
  accentEvery: 11,
  /** Accent base alpha; rises with the gust. */
  accentAlpha: 0.22,
  /** Extra alpha at full displacement. */
  gustLift: 0.16,
  /** Max displacement in px. */
  gustPx: 3.5,
  /** Width of a wind front in px. */
  frontWidth: 170,
  /** Front slant in degrees. */
  slantDeg: 18,
  /** Time for one front to cross the desktop, ms range. */
  crossMs: [30000, 40000] as const,
  /** Gap between fronts, ms range. */
  everyMs: [9000, 15000] as const,
  spring: 0.035,
  damp: 0.88,
  /** Frame cap. */
  fps: 30,
  /** Device pixel ratio cap. */
  dprMax: 2,
} as const;

export type DeskDotsOptions = Partial<{
  [K in keyof typeof DESK_DOTS]: (typeof DESK_DOTS)[K] extends readonly [number, number]
    ? readonly [number, number]
    : number;
}>;

export interface DeskDotsHandle {
  /** True while the desktop is covered (maximized window) or a window is dragged or resized. */
  pause: (paused: boolean) => void;
  /** Draw count and total draw time, for profiling. */
  stats: { frames: number; ms: number };
  destroy: () => void;
}

type Rgb = [number, number, number];

const BUCKETS = 6;

/** Alpha for a bucket: base dots and accent dots rise with the gust. */
export function bucketAlpha(
  accent: boolean,
  bucket: number,
  dark: boolean,
  p: { alphaLight: number; alphaDark: number; accentAlpha: number; gustLift: number } = DESK_DOTS,
): number {
  const m = (bucket + 0.5) / BUCKETS;
  if (accent) return p.accentAlpha + p.gustLift * 1.6 * m;
  return (dark ? p.alphaDark : p.alphaLight) + p.gustLift * m;
}

/** Grid size for a host box: columns and rows of dots. */
export function gridSize(width: number, height: number, spacing: number = DESK_DOTS.spacing) {
  const cols = Math.max(0, Math.ceil(width / spacing));
  const rows = Math.max(0, Math.ceil(height / spacing));
  return { cols, rows, count: cols * rows };
}

/** Same 1 in N pattern as the reference: stable across relayouts. */
export function isAccentDot(col: number, row: number, every: number = DESK_DOTS.accentEvery) {
  return (col * 7 + row * 3) % every === 0;
}

export function mountDeskDots(host: HTMLElement, opts: DeskDotsOptions = {}): DeskDotsHandle {
  const P = { ...DESK_DOTS, ...opts };
  const stats = { frames: 0, ms: 0 };
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    return { pause: () => {}, stats, destroy: () => {} };
  }
  host.appendChild(canvas);
  host.setAttribute('data-live', 'true');

  const slant = Math.tan((P.slantDeg * Math.PI) / 180);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);

  let w = 0;
  let h = 0;
  let n = 0;
  let X = new Float32Array(0);
  let Y = new Float32Array(0);
  let OX = new Float32Array(0);
  let OY = new Float32Array(0);
  let VX = new Float32Array(0);
  let VY = new Float32Array(0);
  let S = new Float32Array(0);
  let PH = new Float32Array(0);
  let AC = new Uint8Array(0);
  let fronts: { t: number; v: number; x: number }[] = [];
  let nextAt = 0;
  let raf = 0;
  let last = 0;
  let paused = false;
  let settled = false;
  let destroyed = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let layoutTimer: ReturnType<typeof setTimeout> | undefined;
  let fg: Rgb = [17, 24, 39];
  let pr: Rgb = [227, 165, 18];
  let dark = false;

  // Theme colours: resolve any CSS colour (oklch included) through a 1 x 1 canvas.
  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  const toRgb = (css: string, fallback: Rgb): Rgb => {
    if (!pctx || !css) return fallback;
    pctx.clearRect(0, 0, 1, 1);
    pctx.fillStyle = '#000';
    pctx.fillStyle = css;
    pctx.fillRect(0, 0, 1, 1);
    const d = pctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };

  const paths: Path2D[] = new Array(BUCKETS * 2);
  function draw() {
    if (!ctx) return;
    const t0 = performance.now();
    ctx.clearRect(0, 0, w, h);
    for (let k = 0; k < paths.length; k++) paths[k] = new Path2D();
    for (let i = 0; i < n; i++) {
      const m = Math.min(1, Math.hypot(OX[i], OY[i]) / P.gustPx);
      const b = Math.min(BUCKETS - 1, (m * BUCKETS) | 0);
      const p = paths[AC[i] * BUCKETS + b];
      const x = X[i] + OX[i];
      const y = Y[i] + OY[i];
      p.moveTo(x + P.radius, y);
      p.arc(x, y, P.radius, 0, Math.PI * 2);
    }
    for (let a = 0; a < 2; a++) {
      const c = a ? pr : fg;
      for (let b = 0; b < BUCKETS; b++) {
        const al = bucketAlpha(a === 1, b, dark, P);
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${al.toFixed(3)})`;
        ctx.fill(paths[a * BUCKETS + b]);
      }
    }
    stats.frames++;
    stats.ms += performance.now() - t0;
  }

  function readTheme() {
    const cs = getComputedStyle(host);
    fg = toRgb(cs.getPropertyValue('--foreground').trim(), fg);
    pr = toRgb(cs.getPropertyValue('--primary').trim(), pr);
    dark = document.documentElement.classList.contains('dark');
    settled = false;
    draw();
  }

  function layout() {
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, P.dprMax);
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { cols, rows, count } = gridSize(w, h, P.spacing);
    n = count;
    X = new Float32Array(n);
    Y = new Float32Array(n);
    OX = new Float32Array(n);
    OY = new Float32Array(n);
    VX = new Float32Array(n);
    VY = new Float32Array(n);
    S = new Float32Array(n);
    PH = new Float32Array(n);
    AC = new Uint8Array(n);
    const x0 = (w - (cols - 1) * P.spacing) / 2;
    const y0 = P.spacing / 2;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++, i++) {
        X[i] = x0 + c * P.spacing;
        Y[i] = y0 + r * P.spacing;
        S[i] = 0.6 + Math.random() * 0.4;
        PH[i] = Math.random() * Math.PI * 2;
        AC[i] = isAccentDot(c, r, P.accentEvery) ? 1 : 0;
      }
    }
    settled = false;
    draw();
    kick();
  }

  function step(now: number) {
    raf = 0;
    if (paused || destroyed || document.hidden) return;
    if (now - last < 1000 / P.fps - 1) {
      raf = requestAnimationFrame(step);
      return;
    }
    last = now;
    if (!nextAt) nextAt = now + rnd(800, 2500);
    if (now >= nextAt) {
      fronts.push({
        t: now,
        v: (w + 2 * P.frontWidth + h * slant) / rnd(P.crossMs[0], P.crossMs[1]),
        x: 0,
      });
      nextAt = now + rnd(P.everyMs[0], P.everyMs[1]);
    }
    for (const f of fronts) f.x = (now - f.t) * f.v - P.frontWidth - h * slant;
    fronts = fronts.filter((f) => f.x < w + P.frontWidth);
    let energy = 0;
    for (let i = 0; i < n; i++) {
      let tx = 0;
      let ty = 0;
      for (const f of fronts) {
        const k = 1 - Math.abs(X[i] - f.x - (h - Y[i]) * slant) / P.frontWidth;
        if (k > 0) {
          const g = P.gustPx * S[i] * smooth(k);
          tx += g;
          ty += g * 0.25 * Math.sin(PH[i]);
        }
      }
      VX[i] = (VX[i] + (tx - OX[i]) * P.spring) * P.damp;
      VY[i] = (VY[i] + (ty - OY[i]) * P.spring) * P.damp;
      OX[i] += VX[i];
      OY[i] += VY[i];
      energy += Math.abs(VX[i]) + Math.abs(VY[i]) + Math.abs(OX[i]);
    }
    // Idle: no front on screen and every dot at rest. Stop until the next front.
    if (!fronts.length && energy < n * 0.002) {
      if (!settled) {
        OX.fill(0);
        OY.fill(0);
        draw();
        settled = true;
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(kick, Math.max(0, nextAt - performance.now()));
      return;
    }
    settled = false;
    draw();
    raf = requestAnimationFrame(step);
  }

  function kick() {
    if (!raf && !paused && !destroyed && !document.hidden) raf = requestAnimationFrame(step);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  const ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          clearTimeout(layoutTimer);
          layoutTimer = setTimeout(layout, 150);
        })
      : null;
  ro?.observe(host);
  // applyTheme writes vars inline on <html>, so watch style as well as class.
  const mo = new MutationObserver(readTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  const onVisibility = () => (document.hidden ? stop() : kick());
  document.addEventListener('visibilitychange', onVisibility);

  readTheme();
  layout();

  return {
    pause(value: boolean) {
      paused = value;
      if (paused) stop();
      else kick();
    },
    stats,
    destroy() {
      destroyed = true;
      stop();
      clearTimeout(idleTimer);
      clearTimeout(layoutTimer);
      ro?.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.remove();
      host.removeAttribute('data-live');
    },
  };
}
