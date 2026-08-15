import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="text-sm font-bold tracking-widest text-brand-mark uppercase">REPLI</p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That link does not point anywhere in the admin panel.
        </p>
        <Link href="/admin/dashboard" className="btn-primary mt-6">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
