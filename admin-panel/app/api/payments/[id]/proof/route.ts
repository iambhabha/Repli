import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/auth/guard';
import { getPayment } from '@/lib/services/payments';
import { fileStream, resolveProof } from '@/lib/services/proofs';
import { toResponse } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Payment screenshots are private customer data. They are served through this
 * route - never as a public URL - so the admin session is checked on every
 * single view, and nothing is cached anywhere shared.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;

    const payment = await getPayment(id);
    if (!payment) {
      return NextResponse.json({ ok: false, error: 'Payment not found.' }, { status: 404 });
    }

    const location = await resolveProof(payment.proof_url, payment.proof_object);

    if (location.kind === 'url') {
      return NextResponse.redirect(location.url);
    }

    if (location.kind === 'file') {
      return new NextResponse(fileStream(location.absolutePath), {
        headers: {
          'content-type': location.contentType,
          'content-length': String(location.size),
          'cache-control': 'private, no-store',
          'content-disposition': `inline; filename="${payment.orderCode}-proof"`,
        },
      });
    }

    // Nothing to show: explain why in plain words rather than 404-ing.
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><title>Payment proof</title>` +
        `<body style="font-family:system-ui;padding:2rem;color:#334155">` +
        `<h1 style="font-size:1.125rem">Payment proof unavailable</h1>` +
        `<p style="max-width:34rem">${escapeHtml(location.reason)}</p></body>`,
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  } catch (error) {
    return toResponse(error, 'payments.proof');
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
