import type { NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/auth/guard';
import { type CategoryInput, createCategory, listCategories } from '@/lib/services/categories';
import { handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handle('categories.list', async () => {
    await requireAdminApi();
    const includeInactive = request.nextUrl.searchParams.get('all') === '1';
    return ok({ categories: await listCategories(includeInactive) });
  });
}

export async function POST(request: Request) {
  return handle('categories.create', async () => {
    const admin = await requireAdminApi();
    const body = await readJson<CategoryInput>(request);
    return ok(await createCategory(body, admin), { status: 201 });
  });
}
