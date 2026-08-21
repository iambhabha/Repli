import type { Metadata } from 'next';
import { Footer, Nav } from '@/components/Sections';
import { SupportChat } from '@/components/SupportChat';
import { SHOP, whatsappLink } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Support — AESTHURA × 3POINTER.CLUB',
  description:
    'Answers to the common questions, right here. Anything else goes to a person on WhatsApp.',
};

export default function SupportPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[104rem] px-5 py-16 sm:py-24">
        <div className="border-b border-line pb-8">
          <span className="label block text-hot">Help</span>
          <h1 className="poster mt-4 text-[clamp(2.5rem,8vw,6rem)]">Support</h1>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <SupportChat />

          <div>
            <p className="text-base leading-relaxed text-mid">
              Most questions have a settled answer - what a tee costs, what the
              advance does, how long a lot takes. Those are answered on this
              page the moment you ask.
            </p>

            <p className="mt-4 text-base leading-relaxed text-mid">
              Anything about your own order - where it has got to, a size that
              did not fit, a payment that looks wrong - needs a person, and a
              person is on WhatsApp.
            </p>

            <div className="mt-8 border-t border-line pt-6">
              <p className="label text-hot">Talk to a person</p>
              <p className="mt-3 text-sm leading-relaxed text-mid">
                {`+${SHOP.whatsapp}`} · {SHOP.city}
              </p>
              <a
                href={whatsappLink('Hi! I need some help.')}
                className="label mt-5 inline-block bg-fg px-6 py-3.5 text-bg transition-colors hover:bg-hot"
              >
                Open WhatsApp →
              </a>
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <p className="label text-hot">Before you message</p>
              <p className="mt-3 text-sm leading-relaxed text-mid">
                If it is about an order, your booking number gets it answered
                faster. It is the <span className="text-fg">#REP-</span> number
                sent to you when the booking was made.
              </p>
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <p className="label text-hot">One warning</p>
              <p className="mt-3 text-sm leading-relaxed text-mid">
                The shop will never ask you for a UPI PIN, an OTP, a card
                number or a password. Payment happens in your own app, on the
                scanner we send. Anyone asking for those is not us.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
