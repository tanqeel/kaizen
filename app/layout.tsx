import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SWRegister } from '@/components/SWRegister';

export const metadata: Metadata = {
  title: 'Kaizen School Management System',
  description:
    'Kaizen School Management System — attendance, academics, exams, fees, communication, and parent portal for Kaizen Model School.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Kaizen School Management System',
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Pre-paint theme script: reads localStorage 'kaizen-theme' and sets .dark on
 * <html> before first paint to avoid a light/dark flash. Defaults to light;
 * respects OS preference only when nothing is stored.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('kaizen-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
