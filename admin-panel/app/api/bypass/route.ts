import type { NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/auth/guard';
import { addBypass, listBypass } from '@/lib/services/bypass';
import { handle, ok, readJson } from '@/lib/utils/http';
import { parsePageParams } from '@/lib/utils/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handle('bypass.list', async () => {
    await requireAdminApi();

    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listBypass({ search: query.q }, parsePageParams(query));

    return ok(result);
  });
}

export async function POST(request: Request) {
  return handle('bypass.add', async () => {
    const admin = await requireAdminApi();
    const body = await readJson<{ phone?: string; name?: string; active?: boolean }>(request);

    const row = await addBypass({ phone: body.phone ?? '', name: body.name, active: body.active }, admin);
    return ok(row, { status: 201 });
  });
}
