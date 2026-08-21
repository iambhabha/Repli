import { ProductCard } from '@/components/ProductCard';
import {
  Bags,
  Booking,
  Footer,
  Hero,
  Nav,
  SectionHead,
  Ticker,
} from '@/components/Sections';
import { PRODUCTS } from '@/lib/catalogue';

/**
 * One page, numbered like a contents page.
 *
 * Five products do not need five routes. What they do need is an order that
 * matches how somebody decides: see the name, see the clothes, see the bag
 * and its chart, then read what booking actually commits you to, then find
 * the number to message.
 */
const RACKS = [
  { key: 'tshirt' as const, index: '01 — Aesthura', title: 'Tees' },
  { key: 'hoodie' as const, index: '02 — BAPE & more', title: 'Hoodies' },
];

export default function Home() {
  let plate = 0;

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Ticker />

        {RACKS.map((rack) => {
          const items = PRODUCTS.filter((p) => p.category === rack.key);
          if (items.length === 0) return null;

          return (
            <section key={rack.key} className="mx-auto max-w-[104rem] px-5 py-20 sm:py-28">
              <SectionHead id={rack.key} index={rack.index} title={rack.title} />
              <div className="mt-10 grid gap-x-8 gap-y-16 sm:grid-cols-2">
                {items.map((product) => {
                  plate += 1;
                  return (
                    <ProductCard
                      key={product.slug}
                      product={product}
                      index={String(plate).padStart(2, '0')}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        <Bags />
        <Booking />
      </main>
      <Footer />
    </>
  );
}
