import type { NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/auth/guard';
import { listStock, type StockFilters } from '@/lib/services/stock';
import { handle, ok } from '@/lib/utils/http';
import { parsePageParams } from '@/lib/utils/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handle('stock.list', async () => {
    await requireAdminApi();

    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listStock(
      {
        search: query.q,
        level: (query.level as StockFilters['level']) ?? 'ALL',
        productId: query.productId,
      },
      parsePageParams(query, 50)
    );

    return ok(result);
  });
}
