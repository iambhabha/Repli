import { requireAdminApi } from '@/lib/auth/guard';
import { rejectPayment } from '@/lib/services/orders';
import { handle, ok } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('orders.rejectPayment', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;

    const result = await rejectPayment(decodeURIComponent(id), admin);
    return ok(result);
  });
}
