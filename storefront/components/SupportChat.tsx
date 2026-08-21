'use client';

import { useEffect, useRef, useState } from 'react';
import { SHOP, whatsappLink } from '@/lib/catalogue';
import { TOPICS, Topic, topicFor } from '@/lib/support';
import { cn } from '@/lib/utils';

type Line = { from: 'shop' | 'you'; text: string };

/**
 * Support that answers here, and hands over when it cannot.
 *
 * This is not a live agent window and does not pretend to be one. The site
 * is a set of static files with nothing behind it, so a chat box that
 * accepted a message and showed it as sent would be dropping that message on
 * the floor - the worst possible thing for a support page to do.
 *
 * What it does instead: the questions the shop already has written answers
 * for are answered instantly, right here, with no waiting for anyone. Every
 * other question is handed to WhatsApp, where a person actually reads it.
 * The handover is visible and deliberate - the customer sees their question
 * going somewhere real rather than into a widget.
 */
export function SupportChat() {
  const [lines, setLines] = useState<Line[]>([
    { from: 'shop', text: 'Hey 👋 Ask anything about an order, a size, or a colour.' },
    {
      from: 'shop',
      text: 'The common ones are answered right here. Anything else goes to a person on WhatsApp.',
    },
  ]);
  const [typing, setTyping] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [handoff, setHandoff] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  /**
   * Keep the newest line in view - but only inside the transcript.
   *
   * scrollIntoView on its own drags the whole page down to the box on first
   * paint, which throws the reader out of the page they were reading. The
   * nearest-block form scrolls the panel and leaves the page alone.
   */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [lines, typing]);

  function say(topic: Topic, question: string) {
    setLines((prev) => [...prev, { from: 'you', text: question }]);
    setAsked((prev) => (prev.includes(topic.id) ? prev : [...prev, topic.id]));
    setTyping(true);

    /**
     * A short pause before the answer.
     *
     * The answer is already in memory and could appear instantly, but a
     * reply that lands in the same frame as the question reads as a canned
     * page rather than an answer. This is the only thing on the page that is
     * for effect, and it is deliberately brief.
     */
    window.setTimeout(() => {
      setTyping(false);
      setLines((prev) => [...prev, ...topic.answer.map((text) => ({ from: 'shop' as const, text }))]);
    }, 480);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question) return;

    const topic = topicFor(question);
    setDraft('');

    if (topic) {
      say(topic, question);
      return;
    }

    /**
     * Nothing stored matches, so it is not answered here.
     *
     * The question stays on screen and turns into a button that carries it
     * to WhatsApp verbatim, so nobody has to type it twice.
     */
    setLines((prev) => [
      ...prev,
      { from: 'you', text: question },
      {
        from: 'shop',
        text: 'I do not have a stored answer for that one - it needs a person. Send it across and someone will reply.',
      },
    ]);
    setHandoff(question);
  }

  const remaining = TOPICS.filter((topic) => !asked.includes(topic.id));

  return (
    <div className="border border-line">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <span className="label">Support</span>
        <span className="label flex items-center gap-2 text-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-hot" aria-hidden />
          Answers here · people on WhatsApp
        </span>
      </div>

      <div
        className="max-h-[26rem] space-y-3 overflow-y-auto bg-plate px-5 py-6"
        role="log"
        aria-live="polite"
      >
        {lines.map((line, i) => (
          <p
            key={i}
            className={cn(
              'max-w-[46ch] px-4 py-3 text-sm leading-relaxed',
              line.from === 'shop'
                ? 'bg-bg text-mid'
                : 'ml-auto bg-fg text-right text-bg'
            )}
          >
            {line.text}
          </p>
        ))}

        {typing && (
          <p className="label w-fit bg-bg px-4 py-3 text-dim" aria-label="Typing">
            ● ● ●
          </p>
        )}

        <div ref={endRef} />
      </div>

      {handoff && (
        <div className="border-t border-line px-5 py-4">
          <a
            href={whatsappLink(handoff)}
            className="label inline-block bg-hot px-5 py-3 text-bg transition-colors hover:bg-fg"
          >
            Send it to a person →
          </a>
        </div>
      )}

      {remaining.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <p className="label mb-3 text-dim">Answered instantly</p>
          <div className="flex flex-wrap gap-2">
            {remaining.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => say(topic, topic.ask)}
                className="border border-line px-3 py-2 text-xs text-mid transition-colors hover:border-hot hover:text-hot"
              >
                {topic.ask}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask something else…"
          aria-label="Ask a question"
          className="min-w-0 flex-1 bg-plate px-4 py-3 text-sm text-fg outline-none placeholder:text-dim focus:ring-1 focus:ring-hot"
        />
        <button type="submit" className="label bg-fg px-5 py-3 text-bg transition-colors hover:bg-hot">
          Ask
        </button>
      </form>

      <p className="border-t border-line px-5 py-4 text-xs leading-relaxed text-dim">
        Nothing typed here is stored or sent anywhere on its own. Questions
        that need a person open WhatsApp on {`+${SHOP.whatsapp}`}, where you
        send them yourself.
      </p>
    </div>
  );
}
