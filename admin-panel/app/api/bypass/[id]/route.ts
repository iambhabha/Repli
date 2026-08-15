import { requireAdminApi } from '@/lib/auth/guard';
import { removeBypass, updateBypass } from '@/lib/services/bypass';
import { handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('bypass.update', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;
    const body = await readJson<{ name?: string; active?: boolean }>(request);

    const row = await updateBypass(id, body, admin);
    return ok(row);
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('bypass.remove', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;

    await removeBypass(id, admin);
    return ok({ id });
  });
}
