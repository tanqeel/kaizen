'use client';

import { useEffect } from 'react';

/** Registers /sw.js (scope: /) so the app-shell cache + /offline fallback work. */
export function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* SW registration is best-effort (e.g. private mode); the app works without it */
      });
    }
  }, []);
  return null;
}
