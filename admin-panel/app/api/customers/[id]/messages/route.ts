import { requireAdminApi } from '@/lib/auth/guard';
import { getCustomerDetail } from '@/lib/services/customers';
import { getCustomerMessages } from '@/lib/services/messages';
import { fail, handle, ok } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

/** §31: the full chat history for one customer. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('customers.messages', async () => {
    await requireAdminApi();
    const { id } = await params;

    const detail = await getCustomerDetail(id);
    if (!detail) return fail('Customer not found.', 404);

    const messages = await getCustomerMessages(detail.customer.phone);
    return ok({ phone: detail.customer.phone, messages });
  });
}
