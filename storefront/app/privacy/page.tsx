import type { Metadata } from 'next';
import { Clause, LegalShell, Points } from '@/components/Legal';
import { SHOP } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Privacy policy — AESTHURA × 3POINTER.CLUB',
  description:
    'What the shop collects when you order on WhatsApp, why, where it is kept, and how to have it removed.',
};

/**
 * Written from what this shop actually does, not from a template.
 *
 * Every claim on this page is traceable to the system behind it: the tables
 * the bot writes to, the private storage bucket the payment screenshots go
 * into, the fact that a person - never the model - confirms a payment. That
 * is the only kind of privacy policy worth publishing, because a generic one
 * would describe cookies and trackers this site does not have while staying
 * silent about the screenshot of a customer's bank app that it does hold.
 */
export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Privacy policy"
      updated="21 August 2026"
      intro="This shop runs on WhatsApp. Almost everything it knows about you, you typed into a chat - your name, where to send the parcel, and a screenshot of a payment. This page says what happens to it."
    >
      <Clause n="01" title="Who this is">
        <p>
          AESTHURA (printed tees and hoodies) and 3POINTER.CLUB (bags) are
          trading names of the same shop, based in {SHOP.city}. Orders are
          taken over WhatsApp on {`+${SHOP.whatsapp}`}, which is also where you
          reach a person about anything on this page.
        </p>
      </Clause>

      <Clause n="02" title="What is collected">
        <Points
          items={[
            'Your WhatsApp number, and the name you give when ordering.',
            'The delivery address you send: street, city, state and PIN code.',
            'What you chose - design, colour, size, quantity - and the order and payment amounts.',
            'The payment screenshot you send, and what it says.',
            'The messages of the conversation itself, so the shop can pick up where you left off.',
          ]}
        />
      </Clause>

      <Clause n="03" title="What is never collected">
        <p>
          No card numbers, UPI PINs, bank logins, CVVs or passwords - ever.
          Payment happens in your own UPI app, on a scanner the shop sends;
          nothing on our side sees or asks for those details. If a message
          ever asks you for a PIN or an OTP, it is not from this shop.
        </p>
        <p>
          This website itself sets no tracking cookies, runs no analytics and
          loads nothing from an advertising network. The only thing it stores
          in your browser is which colour scheme you picked.
        </p>
      </Clause>

      <Clause n="04" title="Why it is collected">
        <p>
          To take the order, reserve your size, confirm the payment, send the
          parcel to the right address, and answer you later if something needs
          sorting out. Nothing is collected for advertising, and nothing is
          sold or shared with anyone who is not needed to get the parcel to
          you.
        </p>
      </Clause>

      <Clause n="05" title="An assistant reads your messages">
        <p>
          Replies on WhatsApp are written with the help of an AI assistant. It
          reads what you send in order to work out what you are asking for -
          a design, a size, a question about price - and the shop&apos;s own
          records supply every fact it states.
        </p>
        <p>
          It cannot create an order and cannot confirm a payment. Both of
          those are done by the shop&apos;s own system after a person has
          checked the payment. When your message contains your address, the
          address itself is removed before anything is sent to the assistant.
        </p>
      </Clause>

      <Clause n="06" title="Where it is kept">
        <p>
          In a private database and file store run for this shop, reachable
          only with the shop&apos;s own credentials. Payment screenshots go
          into a private bucket - they are never given a public link, and the
          shop&apos;s staff open them through short-lived links that expire
          within minutes.
        </p>
      </Clause>

      <Clause n="07" title="Who can see it">
        <Points
          items={[
            'The people who run the shop.',
            'The courier, who is given the name, address and phone number needed to deliver.',
            'The suppliers who make or source your piece - told what to make, not who you are.',
            'Anyone the law requires, if it comes to that.',
          ]}
        />
      </Clause>

      <Clause n="08" title="How long it is kept">
        <p>
          Order records - what was bought, for how much, and where it went -
          are kept as the shop&apos;s business records. Chat history and the
          state of a conversation are working data and are cleared from time
          to time. Ask and your details can be removed sooner, except where a
          record has to be kept for tax or accounting.
        </p>
      </Clause>

      <Clause n="09" title="What you can ask for">
        <p>
          Message the shop on WhatsApp and ask for a copy of what is held
          about you, a correction to it, or its deletion. It is the same
          number you ordered from, and a person will handle it.
        </p>
      </Clause>

      <Clause n="10" title="Changes">
        <p>
          If this policy changes, the date at the top changes with it. The
          version on this page is the one that applies.
        </p>
      </Clause>
    </LegalShell>
  );
}
