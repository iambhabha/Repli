import { KeyRound } from 'lucide-react';

/**
 * Shown when the deployment has no Supabase credentials yet.
 *
 * A blank screen or "Something went wrong" would be a dead end: the person
 * looking at it is the one who can fix it, and they need to know exactly
 * which variables are missing and where to put them. Values are never shown
 * here - only names.
 */
export function NotConfigured({ missing }: { missing: string[] }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            R
          </span>
          <span className="text-lg font-bold tracking-widest text-brand-mark">REPLI</span>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
            <KeyRound className="size-5" />
          </div>

          <h1 className="text-lg font-semibold text-foreground">Almost there</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The panel is deployed, but it has no database credentials yet, so it cannot show you
            anything.
          </p>

          <p className="mt-5 text-sm font-medium text-foreground">Missing:</p>
          <ul className="mt-2 space-y-1">
            {missing.map((name) => (
              <li
                key={name}
                className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-[13px] text-foreground"
              >
                {name}
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">On Vercel</p>
            <p className="mt-1">
              Project → <span className="text-foreground">Settings</span> →{' '}
              <span className="text-foreground">Environment Variables</span> → add them, then
              redeploy.
            </p>
            <p className="mt-3 font-medium text-foreground">Locally</p>
            <p className="mt-1">
              Copy <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.example</code>{' '}
              to <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code>{' '}
              and fill it in.
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Nothing is exposed on this page — it only lists which variable names are missing.
        </p>
      </div>
    </main>
  );
}
