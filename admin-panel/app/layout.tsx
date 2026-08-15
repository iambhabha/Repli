import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Repli Admin',
    template: '%s · Repli Admin',
  },
  description: 'Control center for the Repli WhatsApp sales bot.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#059669',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (password managers, the
    // Chrome automation extension) inject attributes on <html>/<body> before
    // React hydrates. That mismatch is theirs, not ours, and it drowns out
    // real hydration warnings if left on.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
