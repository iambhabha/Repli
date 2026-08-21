import type { Metadata } from 'next';
import { Anton, Space_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

/**
 * Two faces, doing two different jobs.
 *
 * Anton is a condensed poster grotesque - it is the type on flyers taped to
 * a wall, and set large it carries the whole page without a single graphic.
 * Space Mono handles every label, price and caption, because the shop's own
 * material prices things in boxes and a monospace makes a number look
 * measured rather than decorative.
 *
 * The first version of this page used the system sans for everything at
 * heavy weight with tight tracking, which is the default look of every site
 * generated in an afternoon. Type is most of what makes a page feel made by
 * somebody, so it is worth the two font files.
 */
const display = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const mono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AESTHURA × 3POINTER.CLUB',
  description:
    'Streetwear tees, BAPE hoodies and Nike Elite backpacks. Booked on WhatsApp, shipped across India from Dadar, Mumbai.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /**
     * suppressHydrationWarning is required, not decorative: next-themes
     * writes data-theme onto this element before React hydrates, so the
     * server's markup and the browser's genuinely differ by one attribute
     * and that difference is the point.
     */
    <html lang="en" className={`${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
