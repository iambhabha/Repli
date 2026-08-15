'use client';

import { Loader2, MessageSquareText, RotateCcw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import type { TemplateGroup, TemplateItem, TemplateLanguage } from '@/lib/services/templates';

const LANGUAGES: Array<{ code: TemplateLanguage; label: string }> = [
  { code: 'hi', label: 'Hinglish' },
  { code: 'en', label: 'English' },
];

/**
 * §"main apne aap message change kar sakun": every sentence Repli says,
 * editable per language, with the placeholders spelled out so nobody has to
 * guess what {{total}} means.
 */
export function TemplateEditor({ groups }: { groups: TemplateGroup[] }) {
  const [language, setLanguage] = useState<TemplateLanguage>('hi');

  if (!groups.length) {
    return (
      <div className="card max-w-4xl">
        <EmptyState
          title="No messages to edit yet."
          hint="Start the bot once (npm start). It copies its messages into the database on startup, and they appear here."
          icon={<MessageSquareText className="h-6 w-6" />}
        />
      </div>
    );
  }

  const editedCount = groups
    .flatMap((group) => group.items)
    .filter((item) => item.edited[language]).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {LANGUAGES.map((entry) => (
            <button
              key={entry.code}
              type="button"
              onClick={() => setLanguage(entry.code)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                language === entry.code
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-card text-muted-foreground hover:bg-accent'
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          {editedCount > 0
            ? `${editedCount} message${editedCount > 1 ? 's' : ''} changed from the default`
            : 'All messages are the originals'}
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.category} className="space-y-3">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {group.label}
          </h2>
          {group.items.map((item) => (
            <TemplateCard key={item.key} item={item} language={language} />
          ))}
        </section>
      ))}
    </div>
  );
}

function TemplateCard({ item, language }: { item: TemplateItem; language: TemplateLanguage }) {
  const router = useRouter();
  const original = item.bodies[language] ?? '';
  const [value, setValue] = useState(original);
  const [busy, setBusy] = useState(false);

  // The parent re-renders with fresh data after a save; re-sync when the
  // language tab changes or the server sends something new.
  const [syncedTo, setSyncedTo] = useState(`${language}:${original}`);
  if (syncedTo !== `${language}:${original}`) {
    setSyncedTo(`${language}:${original}`);
    setValue(original);
  }

  const dirty = value !== original;
  const isDefault = value.trim() === (item.defaults[language] ?? '').trim();

  async function save() {
    setBusy(true);
    try {
      await api.put(`/api/templates/${item.key}`, { language, body: value });
      toast('Message saved. The bot picks it up within 15 seconds.');
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the message.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const row = await api.put<{ body: string }>(`/api/templates/${item.key}`, {
        language,
        reset: true,
      });
      setValue(row.body);
      toast('Original wording restored.');
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not reset the message.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            {item.label}
            {!isDefault ? <Badge tone="brand">EDITED</Badge> : null}
          </p>
          {item.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
          ) : null}
        </div>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {item.key}
        </code>
      </div>

      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={Math.min(14, Math.max(3, value.split('\n').length + 1))}
        spellCheck={false}
        className="input mt-3 h-auto resize-y font-mono text-[13px] leading-relaxed"
      />

      {item.placeholders.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Placeholders:</span>
          {item.placeholders.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setValue((current) => `${current}{{${name}}}`)}
              title="Click to add"
              className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:bg-accent"
            >
              {`{{${name}}}`}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">This message takes no placeholders.</p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
        {!isDefault ? (
          <button type="button" onClick={reset} disabled={busy} className="btn-secondary py-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to original
          </button>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="btn-primary py-1.5 text-xs"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </div>
  );
}
