'use client';

import { useEffect, useRef } from 'react';

/**
 * The new theme wipes across the page, and you can read it the whole way.
 *
 * The first attempt grew a disc of flat colour over everything. It moved,
 * but it hid the page while it did - all you watched was a coloured circle,
 * and the site only reappeared once it was over. What should be visible is
 * the thing that is actually changing: the same headline, the same prices,
 * in the other ground.
 *
 * So this uses view transitions. The browser keeps a live picture of the
 * page as it was, applies the change underneath, takes a second picture, and
 * hands both to CSS - so the new page is revealed through a growing circle
 * with all of its text intact, over the old page with all of its text
 * intact. Nothing is covered up at any point.
 *
 * The awkward part is that next-themes flips the attribute itself, outside
 * any callback we could wrap. The fix is to catch the flip and undo it in
 * the same microtask - before the browser has had a chance to paint it - and
 * then perform it again inside the transition. The reverted state is never
 * seen, because a MutationObserver callback runs ahead of rendering.
 */
export function ThemeSweep({ children }: { children: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const root = document.documentElement;

    type WithTransition = Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> };
    };
    const start = (document as WithTransition).startViewTransition?.bind(document);

    /**
     * No support, or the visitor has asked for less motion: the theme still
     * changes, it simply changes at once. An instant switch is a perfectly
     * good switch - it is the half-second of hidden page that was the
     * problem, not the absence of an effect.
     */
    if (!start) return;

    /** Where the press landed, read before React or next-themes touch it. */
    function remember(event: PointerEvent) {
      origin.current = { x: event.clientX, y: event.clientY };
    }

    /** Set while we are undoing and redoing, so we ignore our own writes. */
    let ours = false;

    const watcher = new MutationObserver((records) => {
      if (ours) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const record = records[records.length - 1];
      const before = record.oldValue;
      const after = root.getAttribute('data-theme');
      if (before === after) return;

      // Put it back. This is a microtask; nothing has been painted yet.
      ours = true;
      if (before === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', before);

      const point = origin.current ?? {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };

      /** Far enough to reach the furthest corner, or a corner finishes late. */
      const reach = Math.hypot(
        Math.max(point.x, window.innerWidth - point.x),
        Math.max(point.y, window.innerHeight - point.y)
      );

      root.style.setProperty('--sweep-x', `${point.x}px`);
      root.style.setProperty('--sweep-y', `${point.y}px`);
      root.style.setProperty('--sweep-r', `${reach}px`);

      const transition = start(() => {
        if (after === null) root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', after);
      });

      transition.finished.finally(() => {
        ours = false;
      });
    });

    watcher.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
      attributeOldValue: true,
    });

    const node = host.current;
    node?.addEventListener('pointerdown', remember, true);

    return () => {
      watcher.disconnect();
      node?.removeEventListener('pointerdown', remember, true);
    };
  }, []);

  return <div ref={host}>{children}</div>;
}
