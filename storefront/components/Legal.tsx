import { Footer, Nav } from '@/components/Sections';

/**
 * The frame every written page sits in.
 *
 * Policy pages are the one place on this site where somebody is reading
 * rather than looking, so the poster type steps back and the measure is held
 * narrow. Everything else - the bar, the foot, the two grounds - stays
 * exactly as it is on the shop, because a terms page that looks like it came
 * from a different website is a terms page nobody trusts.
 */
export function LegalShell({
  eyebrow,
  title,
  updated,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[104rem] px-5 py-16 sm:py-24">
        <div className="border-b border-line pb-8">
          <span className="label block text-hot">{eyebrow}</span>
          <h1 className="poster mt-4 text-[clamp(2.5rem,8vw,6rem)]">{title}</h1>
          <p className="label mt-6 text-dim">Last updated {updated}</p>
        </div>

        <p className="mt-10 max-w-2xl text-base leading-relaxed text-mid">{intro}</p>

        <div className="mt-4 max-w-2xl">{children}</div>

        <a href="/" className="label mt-14 inline-block border-b-2 border-hot pb-1 text-fg">
          ← Back to the shop
        </a>
      </main>
      <Footer />
    </>
  );
}

/** One numbered clause. The number is the margin note, not the heading. */
export function Clause({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-8">
      <div className="flex items-baseline gap-4">
        <span className="label shrink-0 text-hot">{n}</span>
        <h2 className="poster text-2xl">{title}</h2>
      </div>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-mid">{children}</div>
    </section>
  );
}

/** A plain list inside a clause. */
export function Points({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="shrink-0 text-hot">/</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
