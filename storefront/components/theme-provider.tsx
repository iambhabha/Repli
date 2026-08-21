'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * next-themes, pointed at the attribute this site already styles.
 *
 * The page was written against `data-theme="light" | "dark"` before any of
 * this was installed, so the provider is configured to write exactly that
 * rather than the library's default `class="dark"`. Nothing in globals.css
 * had to change, and there is still only one thing that decides the ground.
 *
 * `system` is the third option the tab strip offers. next-themes resolves it
 * to whichever the device is currently asking for and keeps it in step if
 * that changes mid-visit, so the attribute is always a real colour rather
 * than the word "system".
 *
 * The storage key is the library's default, `theme` - the same key the
 * hand-written toggle used, so anyone who had already chosen keeps their
 * choice instead of being reset by the upgrade.
 *
 * disableTransitionOnChange stops every colour on the page from animating
 * at once when the ground flips. Without it the swap crawls, because half
 * the site has a transition on its border or text colour.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
