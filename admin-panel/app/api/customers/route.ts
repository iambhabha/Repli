import type { NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/auth/guard';
import { listCustomers, type CustomerFilters } from '@/lib/services/customers';
import { handle, ok } from '@/lib/utils/http';
import { parsePageParams } from '@/lib/utils/pagination';
import type { CustomerModeFilter } from '@/types/customer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handle('customers.list', async () => {
    await requireAdminApi();

    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listCustomers(
      {
        search: query.q,
        mode: (query.mode as CustomerModeFilter | undefined) ?? 'ALL',
        sort: query.sort as CustomerFilters['sort'],
      },
      parsePageParams(query)
    );

    return ok(result);
  });
}
