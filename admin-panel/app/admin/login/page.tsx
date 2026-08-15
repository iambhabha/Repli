import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { LoginForm } from '@/components/admin/LoginForm';
import { getAdminSession } from '@/lib/auth/guard';
import { getSettings } from '@/lib/services/settings';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Already signed in and allow-listed? Skip the form.
  const session = await getAdminSession();
  if (session) redirect('/admin/dashboard');

  // The shop's own name on its own sign-in screen.
  const settings = await getSettings().catch(() => ({ businessName: 'Repli' }));

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm businessName={settings.businessName} />
    </Suspense>
  );
}
