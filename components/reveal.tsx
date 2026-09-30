'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * Scroll-reveal wrapper. Children start hidden+lifted (`.reveal`) and ease
 * into place when they enter the viewport. Fires once per element.
 * `delay` staggers siblings (ms). Safe under prefers-reduced-motion: the
 * global CSS guard makes the transition instant, and content still appears.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (very old browser / SSR edge): show immediately.
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style: CSSProperties | undefined =
    delay > 0 ? { transitionDelay: `${delay}ms` } : undefined;

  // `as` polymorphic ref: cast is safe — Tag is always a plain host element.
  const AnyTag = Tag as 'div';
  return (
    <AnyTag
      ref={ref as React.RefObject<HTMLDivElement>}
      style={style}
      className={`reveal ${className}`.trim()}
    >
      {children}
    </AnyTag>
  );
}
