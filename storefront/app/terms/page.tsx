import type { Metadata } from 'next';
import { Clause, LegalShell, Points } from '@/components/Legal';
import { SHOP, rupees } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Terms & conditions — AESTHURA × 3POINTER.CLUB',
  description:
    'How booking works, what the advance does, delivery times, and how returns and refunds are handled.',
};

/**
 * The shop's actual rules, written down.
 *
 * Every clause here already governs what the bot says on WhatsApp - the
 * advance amounts, the lot, the lead times, the fact that nothing is
 * confirmed until a person has checked the payment. Publishing them changes
 * nothing about how the shop works; it just means a customer can read the
 * rules before paying instead of discovering them afterwards.
 *
 * The figures come from lib/catalogue.ts, which is the same catalogue the
 * cards on the front page are printed from. A price cannot drift out of step
 * between the two pages because there is only one of it.
 */
export default function TermsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Terms & conditions"
      updated="21 August 2026"
      intro="Short version: an advance reserves your size, a person checks every payment before anything is confirmed, and pieces are made or sourced to order - so they take time. The rest of this page is that, in detail."
    >
      <Clause n="01" title="Who you are buying from">
        <p>
          AESTHURA (printed tees and hoodies) and 3POINTER.CLUB (bags), based
          in {SHOP.city}. Orders are placed over WhatsApp on{' '}
          {`+${SHOP.whatsapp}`}. This website is a catalogue - it does not take
          payment and does not place orders on its own.
        </p>
      </Clause>

      <Clause n="02" title="Prices">
        <p>
          All prices are in Indian rupees and include what is shown on the
          page. The price that applies is the one quoted to you in chat at the
          time you book. Prices can change for future orders; a change never
          applies to an order already reserved.
        </p>
      </Clause>

      <Clause n="03" title="The advance">
        <p>
          Booking is by advance: {rupees(500)} on a tee, {rupees(1500)} on a
          hoodie. The advance is part of the price, not a fee on top - the
          balance is what is left after it.
        </p>
        <p>
          What the advance buys is a reserved size in the current lot. The
          balance falls due when your piece is ready, before it is despatched.
        </p>
      </Clause>

      <Clause n="04" title="When an order actually exists">
        <p>
          After you pay, you send the screenshot and a person checks it against
          the account. Until that check passes, nothing is confirmed - an
          automated reply saying your screenshot arrived is not a confirmation
          that the money did.
        </p>
        <p>
          The shop may decline an order before confirming it, for example if a
          lot fills up or a colour cannot be sourced. If that happens after you
          have paid an advance, the advance is returned.
        </p>
      </Clause>

      <Clause n="05" title="How long things take">
        <Points
          items={[
            'Tees go into manufacturing after booking. Manufacturing is generally 15-20 days, and the overall wait is usually 20-30 days.',
            'Hoodies are special orders, generally 15-20 days.',
            'Bags are made to order in the colour you pick, once that colour is confirmed with the supplier.',
            'These are honest estimates from past orders, not guaranteed dates.',
          ]}
        />
      </Clause>

      <Clause n="06" title="Limited lots">
        <p>
          Tees are made in lots. Your advance holds your size in the lot that
          is running when you book. If that lot is already full, you will be
          told before you pay, and the wait is for the next one.
        </p>
      </Clause>

      <Clause n="07" title="Colours and sizes">
        <p>
          The bag comes in twenty-four colours off a printed chart. The shop
          does not hold counted stock of each one - you choose from the chart
          and availability is confirmed with the supplier before any payment is
          taken. Hoodie sizes and colours are confirmed the same way.
        </p>
        <p>
          Photographs and the colour chart are shot as accurately as the shop
          can manage, but screens differ. A slight difference in shade is not a
          fault.
        </p>
      </Clause>

      <Clause n="08" title="Cash on delivery">
        <p>
          COD is available on tees for {rupees(200)} extra, making the total{' '}
          {rupees(2699)}. It is not offered on every item, and the shop will
          say so in chat if it is not available for yours.
        </p>
      </Clause>

      <Clause n="09" title="Delivery and pickup">
        <p>
          {SHOP.shipping} You are responsible for giving a correct and complete
          address; a parcel returned because the address was wrong or nobody
          could be reached can be re-sent, with shipping payable again.
        </p>
      </Clause>

      <Clause n="10" title="Returns, exchanges and refunds">
        <p>
          Returns and exchanges are accepted within 2 days of delivery, for a
          piece that is unworn, unwashed and in the condition it arrived in.
        </p>
        <p>
          A piece that arrives damaged, or is not what you ordered, is the
          shop&apos;s problem to fix - message with a photograph and it will be
          sorted. Refunds, returns and exchanges are always handled by a person
          rather than automatically, and are decided case by case.
        </p>
      </Clause>

      <Clause n="11" title="Messages you will receive">
        <p>
          Ordering means the shop will message you on WhatsApp about that
          order. Replies are written with the help of an AI assistant, which
          cannot create an order or confirm a payment - see the privacy policy
          for what it does with your messages.
        </p>
      </Clause>

      <Clause n="12" title="Brand names">
        <p>
          Brand names used to describe what a piece is - a design, a style, a
          make - belong to their owners. Using them here describes the goods
          and does not claim any association with those companies.
        </p>
      </Clause>

      <Clause n="13" title="Law">
        <p>
          These terms are governed by the laws of India, and disputes fall to
          the courts at Mumbai.
        </p>
      </Clause>
    </LegalShell>
  );
}
