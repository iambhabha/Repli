'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils/cn';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

const EVENT = 'repli:toast';

/**
 * Deliberately tiny: a CustomEvent bus instead of a context provider, so any
 * client component can call toast() without threading props or wrapping trees.
 */
export function toast(text: string, tone: ToastTone = 'success') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<Omit<ToastMessage, 'id'>>(EVENT, { detail: { text, tone } }));
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

/** Same trick as the badges: fill for done, outline for wrong, quiet for FYI. */
const TONES: Record<ToastTone, string> = {
  success: 'border-transparent bg-foreground text-background',
  error: 'border-2 border-foreground bg-background text-foreground',
  info: 'border-border bg-card text-foreground',
};

export function Toaster() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    let counter = 0;

    function onToast(event: Event) {
      const detail = (event as CustomEvent<Omit<ToastMessage, 'id'>>).detail;
      const id = ++counter;
      setMessages((current) => [...current, { ...detail, id }]);
      window.setTimeout(() => {
        setMessages((current) => current.filter((message) => message.id !== id));
      }, 5000);
    }

    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  if (!messages.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      role="status"
      aria-live="polite"
    >
      {messages.map((message) => {
        const Icon = ICONS[message.tone];
        return (
          <div
            key={message.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
              TONES[message.tone]
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-sm">{message.text}</p>
            <button
              type="button"
              onClick={() => setMessages((current) => current.filter((m) => m.id !== message.id))}
              className="rounded p-0.5 opacity-60 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
