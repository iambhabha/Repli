import { requireAdminApi } from '@/lib/auth/guard';
import { getCustomerDetail } from '@/lib/services/customers';
import { fail, handle, ok } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('customers.detail', async () => {
    await requireAdminApi();
    const { id } = await params;

    const detail = await getCustomerDetail(id);
    if (!detail) return fail('Customer not found.', 404);

    return ok(detail);
  });
}
