import { requireAdminApi } from '@/lib/auth/guard';
import { verifyPayment } from '@/lib/services/orders';
import { handle, ok } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * §19. Validates the admin, then hands the whole thing to
 * confirm_order_payment() - one database transaction that marks the payment
 * VERIFIED, confirms the order, decreases stock and switches the conversation
 * to HUMAN. The audit entry and the customer's WhatsApp confirmation follow.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('orders.verifyPayment', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;

    const result = await verifyPayment(decodeURIComponent(id), admin);
    return ok(result);
  });
}
