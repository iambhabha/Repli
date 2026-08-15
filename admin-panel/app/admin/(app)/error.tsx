'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/States';

/**
 * §34: the owner sees one sentence. The real error goes to the console (and,
 * in production, to the server logs) - never to the screen.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  return (
    <div className="card">
      <ErrorState
        action={
          <button type="button" onClick={reset} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        }
      />
    </div>
  );
}
