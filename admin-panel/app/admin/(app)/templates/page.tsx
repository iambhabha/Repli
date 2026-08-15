import type { Metadata } from 'next';

import { TemplateEditor } from '@/components/admin/TemplateEditor';
import { PageHeader } from '@/components/ui/PageHeader';
import { listTemplates } from '@/lib/services/templates';

export const metadata: Metadata = { title: 'Bot messages' };
export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const groups = await listTemplates();

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title="Bot messages"
        subtitle="Every sentence Repli says to a customer. Edit it here — no code, no restart."
      />

      <p className="max-w-3xl text-sm text-muted-foreground">
        Words in <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{'{{braces}}'}</code>{' '}
        are filled in by the bot — the product name, the total, the payment link. Keep them as they
        are and write whatever you like around them. Changes reach the bot within 15 seconds.
      </p>

      <TemplateEditor groups={groups} />
    </div>
  );
}
