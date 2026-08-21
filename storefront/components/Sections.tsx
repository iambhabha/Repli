import { Theme } from '@/components/ui/theme';
import { Mark } from '@/components/Mark';
import { ThemeSweep } from '@/components/ThemeSweep';
import { Wordmark, wordmarkAspect } from '@/components/Wordmark';
import {
  BAG_COLOURS,
  PRODUCTS,
  SHOP,
  rupees,
  whatsappLink,
} from '@/lib/catalogue';

/**
 * How the mark sits at the foot of the page.
 *
 * Kept together and named, because the three are arithmetically linked: the
 * crop box is sized from the mark's aspect ratio, the share of the width it
 * takes, and the share of it left showing. Change one in isolation and the
 * mark either leaves a gap under itself or loses the wrong amount.
 *
 * `tighten` closes the spacing between the letters - 0 is the artwork's own
 * tracking, 1 has them touching. `shown` is how much of the mark's height
 * survives the crop.
 */
const FOOT_TIGHTEN = 0.72;
const FOOT_WIDTH = 0.46;
const FOOT_SHOWN = 0.7;

/** A thin rule with a mono caption sitting on it - the page's only divider. */
function Rule({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-t border-line pt-3">
      {children && <span className="label text-dim">{children}</span>}
    </div>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/95 backdrop-blur">
      {/*
        Every link in the bar is rooted at "/".
        
        They were bare fragments - "#top", "#bag" - which worked on the shop
        and died everywhere else: tapping the name on the support page or the
        terms page looked for an anchor that was not on it and did nothing at
        all, leaving no way back to the shop from the pages the footer sends
        people to. "/#bag" reaches the section from any page there is.
      */}
      <nav className="mx-auto flex max-w-[104rem] items-center justify-between gap-6 px-5 py-3">
        {/*
          The mark alone.

          It ran as "AESTURA × 3POINTER.CLUB" set in the mono face, which put
          the shop's own artwork beside a typed imitation of a second name and
          made the bar read as a sentence. The mark is the mark; the other
          brand is named where it sells, on the bags.

          Sized by height, never by width. The artwork is 830 units wide and
          171 tall, so fixing the width would hand it a height it did not
          choose, and it would stop sitting level with the bar at some
          breakpoint.
        */}
        <a
          href="/"
          className="flex shrink-0 items-center gap-2.5 sm:gap-3"
          aria-label="AESTURA, back to the shop"
        >
          {/*
            The picture mark reads at a larger height than the wordmark.
            
            Its cap is a single peak with a lot of air either side of it, so
            matched to the letters it looked like the smaller of the two. A
            touch taller puts the two on the same optical line, which is not
            the same as the same measured height.

            Only the wordmark carries the label. Both marks say AESTURA, and
            announcing it twice in one link is how a screen reader ends up
            reading the shop's name three times before the nav.
          */}
          <Mark className="h-[1.6rem] w-auto sm:h-8" aria-hidden />

          {/*
            respond here too, and overflow-visible with it.

            The SVG clips to its own viewBox, which is cropped tight to the
            letters - so without this the glow is cut off at the edge of each
            glyph and the letter grows into nothing. The bar itself does not
            hide its overflow, so the light is free to fall onto the page
            below it, which is where a light should fall.
          */}
          <Wordmark respond className="h-[1.15rem] w-auto overflow-visible sm:h-6" />
        </a>

        <div className="hidden gap-8 md:flex">
          {[
            ['/#tshirt', 'Tees'],
            ['/#hoodie', 'Hoodies'],
            ['/#bag', 'Bags'],
            ['/#booking', 'Booking'],
          ].map(([href, text]) => (
            <a
              key={href}
              href={href}
              className="label text-dim transition-colors hover:text-fg"
            >
              {text}
            </a>
          ))}
        </div>

        <a
          href={whatsappLink('Hi!')}
          className="label bg-hot px-4 py-2 text-bg transition-colors hover:bg-fg"
        >
          WhatsApp
        </a>
      </nav>
    </header>
  );
}

/**
 * The name, set as large as the page will take.
 *
 * No photograph behind it and nothing floating over it. The two brands ARE
 * the hero - one prints the shirts, the other carries the bags - and a
 * lockup that fills the width says that faster than a sentence would.
 */
export function Hero() {
  return (
    <section id="top" className="border-b border-line">
      <div className="mx-auto max-w-[104rem] px-5 pb-10 pt-16 sm:pt-24">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="label text-hot">Dadar, Mumbai</span>
          <span className="hatch h-2 w-16 text-hot" aria-hidden />
          <span className="label text-dim">Ships pan India</span>
          <span className="label text-dim">Booked on WhatsApp</span>
        </div>

        <h1 className="poster mt-8 text-[clamp(2.75rem,11vw,9.5rem)]">
          <span className="block">Aesthura</span>
          <span className="block text-hot">3Pointer.club</span>
        </h1>

        <div className="mt-10 grid gap-8 border-t border-line pt-8 sm:grid-cols-3">
          {[
            ['What', 'Printed tees, BAPE hoodies, Nike Elite backpacks.'],
            ['How', 'Pick it in chat. An advance holds your size. Balance when it is ready.'],
            ['Who', 'A person confirms every colour, every payment, every order.'],
          ].map(([head, body]) => (
            <div key={head}>
              <p className="label text-hot">{head}</p>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-mid">{body}</p>
            </div>
          ))}
        </div>

        <a
          href={whatsappLink('Hi! I want to see what you have.')}
          className="label mt-10 inline-block bg-fg px-7 py-4 text-bg transition-colors hover:bg-hot"
        >
          Start on WhatsApp →
        </a>
      </div>
    </section>
  );
}

/**
 * The strip.
 *
 * Every fact on it is one a customer would otherwise have to ask for, and
 * all of them come from the shop's own answers. Written twice so the loop
 * has no seam.
 */
export function Ticker() {
  const items = [
    `${rupees(500)} reserves your size`,
    'Pickup from Dadar',
    'Pan India shipping',
    '2 day return & exchange',
    'COD on tees',
    '24 bag colours',
  ];
  const strip = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-line bg-hot py-2.5">
      <div className="ticker-track flex w-max">
        {strip.map((text, i) => (
          <span key={i} className="label flex items-center whitespace-nowrap text-bg">
            {text}
            <span className="mx-6 opacity-60">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SectionHead({
  id,
  index,
  title,
  note,
}: {
  id?: string;
  index: string;
  title: string;
  note?: string;
}) {
  return (
    <div id={id} className="scroll-mt-16 border-b border-line pb-6">
      {/* The index sits on its own line. Set beside a cap-height that tall it
          hung below the baseline and read as a mistake rather than a margin
          note. */}
      <span className="label block text-hot">{index}</span>
      <h2 className="poster mt-4 text-[clamp(2rem,5.5vw,4.25rem)]">{title}</h2>
      {note && <p className="mt-4 max-w-lg text-sm leading-relaxed text-dim">{note}</p>}
    </div>
  );
}

/**
 * Booking, on paper.
 *
 * The page turns white here on purpose. This is the part customers ask about
 * most and the part where money changes hands, so it is set like a printed
 * receipt - dark type, hard rules, numbers in the margin - and it reads as a
 * different kind of thing to the pictures above it.
 */
export function Booking() {
  const steps = [
    [
      '01',
      'Pick it',
      'Message the design and your size. We quote the price and what reserves it before anything else happens.',
    ],
    [
      '02',
      'Reserve it',
      `Pay the advance on the scanner we send - ${rupees(500)} on a tee, ${rupees(1500)} on a hoodie - and send the screenshot. A person checks it.`,
    ],
    [
      '03',
      'Pay the rest when it is ready',
      'Tees go into manufacturing after booking, usually 15-20 days. The balance is due when your piece is ready, not before.',
    ],
  ];

  return (
    <section id="booking" className="scroll-mt-16 bg-flip text-flipfg">
      <div className="mx-auto max-w-[104rem] px-5 py-20 sm:py-28">
        <div className="border-b-2 border-flipfg pb-6">
          <span className="label block text-hot">How it works</span>
          <h2 className="poster mt-4 text-[clamp(2rem,5.5vw,4.25rem)]">
            Booked, not gambled
          </h2>
        </div>

        <ol>
          {steps.map(([n, title, body]) => (
            <li
              key={n}
              className="grid gap-4 border-b border-flipfg/20 py-8 sm:grid-cols-[7rem_1fr_1.6fr] sm:gap-8"
            >
              <span className="poster text-5xl text-flipfg/25">{n}</span>
              <h3 className="poster text-3xl">{title}</h3>
              <p className="max-w-xl text-sm leading-relaxed text-flipfg/70">{body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 max-w-2xl text-xs leading-relaxed text-flipfg/50">
          The advance comes off the total - it is not a fee. COD is available on
          tees for {rupees(200)} extra. Refunds, returns and exchanges are
          handled by a person, not a bot.
        </p>
      </div>
    </section>
  );
}

/**
 * The bag, and the chart it is sold off.
 *
 * The chart is the product page - every colour, named, priced - so it is
 * printed here at the width it needs and the names are set beside it for
 * anyone reading on a phone.
 */
export function Bags() {
  const bag = PRODUCTS.find((p) => p.category === 'bag');
  if (!bag) return null;

  return (
    <section className="mx-auto max-w-[104rem] px-5 py-20 sm:py-28">
      <SectionHead id="bag" index="03 — 3Pointer.club" title={bag.name} note={bag.blurb} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bag.images[0]}
            alt="The Nike Elite backpack colour chart - all twenty-four colours, priced"
            className="w-full"
            loading="lazy"
          />
        </div>

        <div>
          <p className="poster text-6xl">{rupees(bag.price)}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-dim">
            One price, every colour. Point at the one you want and we confirm
            it with our supplier before you pay anything.
          </p>

          <Rule>All 24 colours</Rule>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-mid">
            {BAG_COLOURS.map((c) => (
              <li key={c} className="flex items-baseline gap-2">
                <span className="text-hot">/</span>
                {c}
              </li>
            ))}
          </ul>

          <a
            href={whatsappLink('Hi! I want a bag - which colours can you confirm?')}
            className="label mt-8 inline-block bg-hot px-6 py-3.5 text-bg transition-colors hover:bg-fg"
          >
            Ask about a colour →
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * The foot: the useful facts, then the legal line, then the name as a mark.
 *
 * The wordmark at the bottom is set enormous and cropped by the edge of the
 * page on purpose - it is a stamp on the back of the sheet rather than
 * something to read, which is why it sits in the ghost tone and why nothing
 * of consequence is written inside it.
 */
export function Footer() {
  const year = 2026;

  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[104rem] px-5 pt-16">
        <div className="grid gap-8 border-b border-line pb-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Where', `${SHOP.city}. Pickup available.`],
            ['Shipping', SHOP.shipping],
            ['Returns', SHOP.returns],
            ['Help', 'Questions answered on the support page, or by a person on WhatsApp.'],
          ].map(([head, body]) => (
            <div key={head}>
              <p className="label text-hot">{head}</p>
              <p className="mt-3 text-sm leading-relaxed text-mid">{body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 py-10">
          <div className="flex flex-col gap-4">
            <p className="max-w-md text-xs leading-relaxed text-dim">
              Prices shown are current. Colours and sizes are confirmed before
              any payment is taken.
            </p>

            {/*
              The ground switch lives down here rather than in the bar.
              It is a preference, not a way through the shop, and the top of
              the page is for the four things somebody actually came for.
              "System" is the default: until it is touched, the page follows
              whatever the phone is already set to.
            */}
            <ThemeSweep>
              <div className="flex items-center gap-3">
                <span className="label text-dim">Theme</span>
                <Theme variant="tabs" size="md" showLabel themes={['light', 'dark', 'system']} />
              </div>
            </ThemeSweep>
          </div>

          <a
            href={whatsappLink('Hi!')}
            className="label bg-fg px-6 py-3.5 text-bg transition-colors hover:bg-hot"
          >
            Message the shop →
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-7">
          <p className="label text-mid">
            © Copyright {year} AESTHURA × 3POINTER.CLUB. All rights reserved.
          </p>

          <div className="flex flex-wrap gap-7">
            {[
              ['/support', 'Support'],
              ['/privacy', 'Privacy policy'],
              ['/terms', 'Terms & conditions'],
            ].map(([href, text]) => (
              <a
                key={href}
                href={href}
                className="label text-dim transition-colors hover:text-fg"
              >
                {text}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/*
        The real mark at the foot, not type imitating it.

        This was the word set in the poster face, which put a typed version of
        the shop's name at the bottom of the same page whose bar carries the
        actual artwork - two different letterforms claiming to be one name.
        Now it is the same vector, running off the bottom of the sheet the
        way a stamp does on the back of a bag tag.

        It is aria-hidden because the mark in the bar has already announced
        the shop and a screen reader should not read it twice.
      */}
      <div aria-hidden className="px-5 pt-6">
        {/*
          Room at the top, and nowhere else.

          The room has to be INSIDE something that clips, or it is not room -
          it is overflow, and overflow counts: the document went on for
          another 52px of empty scroll past the last thing anyone could see,
          which is the blank strip under the page. overflow-clip with a zero
          margin removes that contribution, but a zero margin also cuts the
          glow and the lifted letter off at the box edge.

          So the box is grown upwards by five rem and pulled back up by the
          same amount. Layout is unchanged, the extra height is empty space
          the letter can grow into, and it is all within the clip - so
          nothing escapes to lengthen the page. The bottom needs no room
          because the bottom is where the mark is deliberately cut, and the
          sides need none because the box is full width while the mark is
          under half of it.
        */}
        <div className="-mt-20 overflow-clip pt-20">
        {/*
          Cut at the bottom only, and nowhere else.

          overflow-hidden cropped all four sides, so the moment a letter grew
          under the cursor its top was sliced off against the box - the crop
          meant to hide part of the mark was also eating the hover. An inset
          clip with negative offsets on three sides leaves the top and the
          flanks open for the letter and its light, and still cuts the bottom
          exactly where the box ends.

          Zero height plus percentage padding, not aspect-ratio. aspect-ratio
          is only a PREFERRED size: once the box stopped hiding its overflow
          it simply grew to fit the mark, the bottom edge landed under the
          last pixel of it, and the crop quietly stopped existing - measured
          at 100% shown against a stated 90%. A definite height of zero cannot
          grow, and percentage padding resolves against the box's own width,
          which is what keeps the visible share the same at every window size.

          The box runs the full width even though the mark does not, which
          leaves the outermost letters somewhere to throw their glow.

          overflow-clip is what stops the page ending in nothing. clip-path
          hides the overhanging part of the mark but does not stop it
          counting: the document went on for another 52px of empty scroll
          past the last thing anyone could see. `clip` removes that
          contribution, and the clip-margin gives the glow and the lifted
          letter room to paint beyond the box anyway - which plain
          overflow-hidden would have taken away again.
        */}
        <div
          className="w-full"
          style={{
            height: 0,
            paddingBottom: `${(FOOT_SHOWN * FOOT_WIDTH * 100) / wordmarkAspect(FOOT_TIGHTEN)}%`,
          }}
        >
          <Wordmark
            respond
            tighten={FOOT_TIGHTEN}
            className="mx-auto block h-auto overflow-visible text-ghost"
            style={{ width: `${FOOT_WIDTH * 100}%` }}
          />
          </div>
        </div>
      </div>
    </footer>
  );
}
