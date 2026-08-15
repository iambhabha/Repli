import { requireAdminApi } from '@/lib/auth/guard';
import { getOrder } from '@/lib/services/orders';
import { fail, handle, ok } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('orders.get', async () => {
    await requireAdminApi();
    const { id } = await params;

    const order = await getOrder(decodeURIComponent(id));
    if (!order) return fail('Order not found.', 404);

    return ok(order);
  });
}
