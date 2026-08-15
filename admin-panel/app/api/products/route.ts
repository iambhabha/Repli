import type { NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/auth/guard';
import { createProduct, listProducts, type ProductFilters } from '@/lib/services/products';
import { handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handle('products.list', async () => {
    await requireAdminApi();

    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const products = await listProducts({
      search: query.q,
      status: (query.status as ProductFilters['status']) ?? 'ALL',
    });

    return ok({ products });
  });
}

export async function POST(request: Request) {
  return handle('products.create', async () => {
    const admin = await requireAdminApi();
    const body = await readJson<Parameters<typeof createProduct>[0]>(request);

    const product = await createProduct(body, admin);
    return ok(product, { status: 201 });
  });
}
