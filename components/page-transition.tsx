'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Route-change transition for the authenticated app shell. Remounts a thin
 * wrapper keyed by pathname so each page fades/slides in once. Sidebar and
 * Header live OUTSIDE this wrapper in (app)/layout.tsx, so they never
 * remount — only the page content animates.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
