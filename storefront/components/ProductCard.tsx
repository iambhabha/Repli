import { Product, rupees, whatsappLink } from '@/lib/catalogue';

/**
 * A plate, not a card.
 *
 * The first version was the shape every generated shop uses - rounded
 * corners, a soft border, the name and price stacked politely underneath.
 * This one is laid out like a page in a lookbook instead: the photograph
 * runs to the edges of its box, the index number and the price sit on top of
 * it in the margins, and the name is set in poster type large enough to
 * carry the row.
 *
 * The order of the information still follows the shop's sales memory - the
 * picture leads, the price is present but not shouted, and nothing claims
 * stock the shop has not counted.
 */
export function ProductCard({ product, index }: { product: Product; index: string }) {
  const [front, ...rest] = product.images;
  const back = rest[rest.length - 1];

  /**
   * The shirts were shot full-length in portrait, so a square-ish frame cut
   * straight through the model's head. A tall frame cropped high keeps the
   * print - the thing being sold - in the middle of the plate.
   */
  const fit =
    product.fit === 'contain' ? 'object-contain' : 'object-cover object-[50%_20%]';

  return (
    <article className="group">
      <div className="relative aspect-3/4 overflow-hidden border border-line bg-plate">
        {front ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={front}
              alt={`${product.name} ${product.colour}`}
              className={`absolute inset-0 h-full w-full ${fit} transition-opacity duration-500 group-hover:opacity-0`}
              loading="lazy"
            />
            {back && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={back}
                alt={`${product.name}, other side`}
                className={`absolute inset-0 h-full w-full ${fit} opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
                loading="lazy"
              />
            )}
          </>
        ) : (
          /**
           * No photograph yet.
           *
           * The hoodies are special orders and the shop has not shot them. A
           * stock picture of somebody else's hoodie is the one thing the
           * sales memory forbids outright, so the plate says so and still
           * lets you ask.
           */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <span className="hatch absolute inset-0 text-ghost" aria-hidden />
            <span className="poster relative text-[clamp(3rem,7vw,5rem)] text-ghostink">
              {product.name.split(' ')[0]}
            </span>
            <span className="label relative bg-bg px-3 py-2 text-dim">
              Photos on request
            </span>
          </div>
        )}

        {/* Set on the ground rather than blended into the photograph - over a
            bright frame a difference blend turned the number to mud. */}
        <span className="label absolute left-0 top-0 bg-bg px-3 py-2 text-fg">
          {index}
        </span>
        <span className="label absolute right-0 top-0 bg-bg px-3 py-2 text-fg">
          {rupees(product.price)}
        </span>
      </div>

      <div className="mt-4 flex items-start justify-between gap-6 border-t border-line pt-4">
        <div>
          <h3 className="poster text-[clamp(1.5rem,3vw,2.25rem)]">{product.name}</h3>
          <p className="label mt-2 text-dim">
            {product.colour}
            {product.sizes.length > 0 && ` — ${product.sizes.join(' / ')}`}
          </p>
          {product.booking > 0 && (
            <p className="label mt-1 text-hot">{rupees(product.booking)} reserves it</p>
          )}
        </div>

        <a
          href={whatsappLink(
            `Hi! I want the ${product.name}${
              product.colour.includes('colour') || product.colour === 'On request'
                ? ''
                : ` (${product.colour})`
            }.`
          )}
          className="label shrink-0 border-b-2 border-hot pb-1 text-fg transition-colors hover:text-hot"
        >
          Enquire →
        </a>
      </div>

      <p className="mt-4 max-w-md text-sm leading-relaxed text-dim">{product.blurb}</p>
    </article>
  );
}
