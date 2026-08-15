'use client';

import { CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { AuthFormSplitScreen, type AuthFormValues } from '@/components/ui/login';
import { createClient } from '@/lib/supabase/client';

/**
 * Supabase Auth email + password, wrapped around the split-screen form.
 *
 * Signing in only gets you a session; the server still checks the email
 * against `admin_users` before any data loads, so a stranger who somehow
 * obtains a Supabase account still sees nothing.
 */
export function LoginForm({ businessName }: { businessName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  async function handleLogin(values: AuthFormValues) {
    const supabase = createClient({ rememberMe: values.rememberMe });

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });

    if (error) {
      // Never distinguish "no such user" from "wrong password".
      throw new Error('Incorrect email or password.');
    }

    const target = next && next.startsWith('/admin') ? next : '/admin/dashboard';
    router.replace(target);
    router.refresh();
  }

  return (
    <AuthFormSplitScreen
      title="Welcome back"
      description={`Sign in to run ${businessName} from one screen.`}
      onSubmit={handleLogin}
      imageSrc="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=60&w=1200"
      imageAlt="A small retail shop counter"
      logo={
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            R
          </span>
          <span className="text-lg font-bold tracking-widest text-brand-mark">REPLI</span>
        </div>
      }
      footer={<p className="text-xs">Only allow-listed admin accounts can sign in.</p>}
      imageOverlay={
        <div className="max-w-sm text-white">
          <p className="text-sm font-medium tracking-widest text-white/70 uppercase">
            Repli control center
          </p>
          <h2 className="mt-3 text-3xl leading-tight font-semibold">
            Every chat, order and rupee in one place.
          </h2>
          <ul className="mt-6 space-y-2.5 text-sm text-white/80">
            <li className="flex items-center gap-2.5">
              <MessageCircle className="size-4 shrink-0" />
              Read the whole WhatsApp thread and reply as yourself
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 shrink-0" />
              No payment is ever confirmed without you
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="size-4 shrink-0" />
              Stock, prices and the bot switch, live
            </li>
          </ul>
        </div>
      }
    />
  );
}
