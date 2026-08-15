import { requireAdminApi } from '@/lib/auth/guard';
import { changeStock } from '@/lib/services/stock';
import { assert, handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

/**
 * §23. Accepts either an absolute `quantity` or a relative `delta` (the +/-
 * buttons). Both are clamped at zero server-side; the browser is never
 * trusted to keep stock non-negative.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ variantId: string }> }
) {
  return handle('stock.update', async () => {
    const admin = await requireAdminApi();
    const { variantId } = await params;
    const body = await readJson<{ quantity?: number; delta?: number }>(request);

    assert(
      body.quantity !== undefined || body.delta !== undefined,
      'Send either a quantity or a delta.'
    );

    const variant = await changeStock(variantId, body, admin);
    return ok(variant);
  });
}
