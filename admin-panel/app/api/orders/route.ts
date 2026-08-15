import type { NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/auth/guard';
import { listOrders, type OrderFilters } from '@/lib/services/orders';
import { handle, ok } from '@/lib/utils/http';
import { parsePageParams } from '@/lib/utils/pagination';
import type { OrderStatusFilter } from '@/types/order';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handle('orders.list', async () => {
    await requireAdminApi();

    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listOrders(
      {
        search: query.q,
        status: (query.status as OrderStatusFilter | undefined) ?? 'ALL',
        sort: query.sort as OrderFilters['sort'],
      },
      parsePageParams(query)
    );

    return ok(result);
  });
}
