import { useLayoutEffect, useRef } from 'react';

type IndicatorBox = { left: number; width: number; top: number; height: number };

/** Baseline travel speed for a typical adjacent hop (px / ms). */
const INDICATOR_SPEED_PX_PER_MS = 0.85;
/**
 * Distance → time exponent. 1 = fully linear; lower = long hops stay relatively faster.
 * e.g. 0.75 → 4× distance ≈ 2.8× duration instead of 4×.
 */
const INDICATOR_DISTANCE_EXPONENT = 0.75;
/** Reference distance (px) where travel time matches pure linear speed. */
const INDICATOR_DISTANCE_REF_PX = 90;
/** Fixed settle after arrival — not mixed into travel. */
const INDICATOR_SETTLE_MS = 80;
/** Short press-scale on the whole floating nav — runs with the pill travel. */
const NAV_CLICK_SCALE = 0.96;
const NAV_CLICK_SCALE_MS = 200;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Brief scale pulse on the glass bar so a tab change feels like a tap. */
function playNavClickScale(nav: HTMLElement): Animation {
  return nav.animate(
    [
      { transform: 'scale(1)' },
      { transform: `scale(${NAV_CLICK_SCALE})`, offset: 0.35 },
      { transform: 'scale(1)' },
    ],
    {
      duration: NAV_CLICK_SCALE_MS,
      easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    },
  );
}

function readBox(nav: HTMLElement, tab: HTMLElement): IndicatorBox {
  const navRect = nav.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  return {
    left: tabRect.left - navRect.left,
    width: tabRect.width,
    top: tabRect.top - navRect.top,
    height: tabRect.height,
  };
}

function applyBox(pill: HTMLElement, box: IndicatorBox) {
  pill.style.transform = `translate3d(${box.left}px, ${box.top}px, 0)`;
  pill.style.width = `${box.width}px`;
  pill.style.height = `${box.height}px`;
}

function centerX(box: IndicatorBox): number {
  return box.left + box.width / 2;
}

/** Sub-linear travel time: longer hops take longer, but less than 1:1 with distance. */
function travelMsForDistance(dist: number): number {
  if (dist < 0.5) return 0;
  const linearRefMs = INDICATOR_DISTANCE_REF_PX / INDICATOR_SPEED_PX_PER_MS;
  return linearRefMs * Math.pow(dist / INDICATOR_DISTANCE_REF_PX, INDICATOR_DISTANCE_EXPONENT);
}

/**
 * Travel time grows with distance (sub-linear); settle is appended after.
 * Keyframe offsets scale so morph timing tracks that travel window.
 */
function timingForDistance(dist: number): { duration: number; tMid: number; tArrive: number } {
  const travelMs = travelMsForDistance(dist);
  const duration = Math.round(travelMs + INDICATOR_SETTLE_MS);
  const tArrive = travelMs <= 0 ? 0.55 : travelMs / duration;
  return { duration, tMid: tArrive * 0.5, tArrive };
}

/**
 * Shared selection pill that slides between tabs.
 * Mid-travel it widens and squashes (shape morph) while the center still
 * covers the full gap; then a short settle. The whole floating nav gets a
 * short press-scale in parallel so the change reads as a tap.
 */
export function FloatingTabIndicator({
  navRef,
  activeEl,
}: {
  navRef: React.RefObject<HTMLElement | null>;
  activeEl: HTMLElement | null;
}) {
  const pillRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<IndicatorBox | null>(null);
  const animRef = useRef<Animation | null>(null);
  const clickAnimRef = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;

    if (!activeEl) {
      pill.style.opacity = '0';
      fromRef.current = null;
      return;
    }

    const to = readBox(nav, activeEl);
    const from = fromRef.current;
    pill.style.opacity = '1';

    if (!from || prefersReducedMotion()) {
      animRef.current?.cancel();
      clickAnimRef.current?.cancel();
      applyBox(pill, to);
      fromRef.current = to;
      return;
    }

    const fromCx = centerX(from);
    const toCx = centerX(to);
    const dx = toCx - fromCx;
    const dist = Math.abs(dx);
    if (dist < 0.5 && Math.abs(to.width - from.width) < 0.5) {
      applyBox(pill, to);
      fromRef.current = to;
      return;
    }

    // Stretch toward the span while the center still travels halfway — full slide, visible morph.
    const spanLeft = Math.min(from.left, to.left);
    const spanRight = Math.max(from.left + from.width, to.left + to.width);
    const spanWidth = spanRight - spanLeft;
    const baseMidWidth = (from.width + to.width) / 2;
    const midWidth = baseMidWidth + (spanWidth - baseMidWidth) * 0.35;
    const midCx = fromCx + dx * 0.5;
    const midLeft = midCx - midWidth / 2;
    const overshoot = Math.min(4, dist * 0.03) * Math.sign(dx || 1);
    const { duration, tMid, tArrive } = timingForDistance(dist);

    animRef.current?.cancel();
    clickAnimRef.current?.cancel();
    clickAnimRef.current = playNavClickScale(nav);

    const animation = pill.animate(
      [
        {
          transform: `translate3d(${from.left}px, ${from.top}px, 0) scaleY(1)`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          offset: 0,
        },
        {
          transform: `translate3d(${midLeft}px, ${to.top + to.height * 0.05}px, 0) scaleY(0.84)`,
          width: `${midWidth}px`,
          height: `${to.height}px`,
          offset: tMid,
        },
        {
          transform: `translate3d(${to.left + overshoot}px, ${to.top}px, 0) scaleY(1.05)`,
          width: `${to.width}px`,
          height: `${to.height}px`,
          offset: Math.min(tArrive, 0.98),
        },
        {
          transform: `translate3d(${to.left}px, ${to.top}px, 0) scaleY(1)`,
          width: `${to.width}px`,
          height: `${to.height}px`,
          offset: 1,
        },
      ],
      {
        duration,
        // Linear timing so distance maps 1:1 to travel time (bounce lives in keyframes).
        easing: 'linear',
        fill: 'forwards',
      },
    );

    animRef.current = animation;
    animation.finished
      .then(() => {
        if (animRef.current !== animation) return;
        applyBox(pill, to);
        animation.cancel();
      })
      .catch(() => {
        /* cancelled */
      });

    fromRef.current = to;
  }, [navRef, activeEl]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(() => {
      const pill = pillRef.current;
      if (!pill || !activeEl || animRef.current?.playState === 'running') return;
      const box = readBox(nav, activeEl);
      applyBox(pill, box);
      fromRef.current = box;
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, [navRef, activeEl]);

  return (
    <div
      ref={pillRef}
      aria-hidden
      className="shellui-floating-tab-indicator pointer-events-none absolute top-0 left-0 z-0 will-change-transform"
      style={{ opacity: 0, width: 0, height: 0 }}
    />
  );
}
