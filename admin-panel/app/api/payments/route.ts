import type { NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/auth/guard';
import { listPayments } from '@/lib/services/payments';
import { handle, ok } from '@/lib/utils/http';
import { parsePageParams } from '@/lib/utils/pagination';
import type { PaymentStatusFilter } from '@/types/payment';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handle('payments.list', async () => {
    await requireAdminApi();

    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listPayments(
      {
        search: query.q,
        status: (query.status as PaymentStatusFilter | undefined) ?? 'PROOF_RECEIVED',
      },
      parsePageParams(query)
    );

    return ok(result);
  });
}
