import { useLayoutEffect, useRef } from 'react';

type IndicatorBox = { left: number; width: number; top: number; height: number };

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

/**
 * Shared selection pill that morphs between tabs with a stretchy bounce.
 * Mid-travel it expands to span old→new (liquid distortion), then settles
 * with a soft overshoot.
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
      applyBox(pill, to);
      fromRef.current = to;
      return;
    }

    const dx = to.left - from.left;
    const dist = Math.abs(dx);
    if (dist < 0.5 && Math.abs(to.width - from.width) < 0.5) {
      applyBox(pill, to);
      fromRef.current = to;
      return;
    }

    // Union of old + new frames — the pill “smears” across the gap.
    const spanLeft = Math.min(from.left, to.left);
    const spanRight = Math.max(from.left + from.width, to.left + to.width);
    const spanWidth = spanRight - spanLeft;
    const jelly = Math.min(1.12, 1 + dist / Math.max(spanWidth * 8, 1));
    const midWidth = spanWidth * jelly;
    const midLeft = spanLeft - (midWidth - spanWidth) / 2;
    const overshoot = Math.min(10, dist * 0.08) * Math.sign(dx || 1);

    animRef.current?.cancel();

    const animation = pill.animate(
      [
        {
          transform: `translate3d(${from.left}px, ${from.top}px, 0) scaleY(1)`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          borderRadius: '9999px',
          offset: 0,
        },
        {
          // Peak liquid stretch + vertical squash.
          transform: `translate3d(${midLeft}px, ${to.top + to.height * 0.06}px, 0) scaleY(0.82)`,
          width: `${midWidth}px`,
          height: `${to.height}px`,
          borderRadius: '1.65rem',
          offset: 0.4,
        },
        {
          // Bounce past the target, recover height.
          transform: `translate3d(${to.left + overshoot}px, ${to.top}px, 0) scaleY(1.06)`,
          width: `${to.width * 0.96}px`,
          height: `${to.height}px`,
          borderRadius: '9999px',
          offset: 0.72,
        },
        {
          transform: `translate3d(${to.left}px, ${to.top}px, 0) scaleY(1)`,
          width: `${to.width}px`,
          height: `${to.height}px`,
          borderRadius: '9999px',
          offset: 1,
        },
      ],
      {
        duration: 540,
        easing: 'cubic-bezier(0.22, 1.4, 0.36, 1)',
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
      className="shellui-floating-tab-indicator pointer-events-none absolute top-0 left-0 z-0 rounded-full bg-foreground/15 will-change-transform"
      style={{ opacity: 0, width: 0, height: 0 }}
    />
  );
}
