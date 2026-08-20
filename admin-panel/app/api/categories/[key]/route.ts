import { requireAdminApi } from '@/lib/auth/guard';
import { type CategoryInput, deactivateCategory, updateCategory } from '@/lib/services/categories';
import { handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ key: string }> }) {
  return handle('categories.update', async () => {
    const admin = await requireAdminApi();
    const { key } = await params;
    const body = await readJson<CategoryInput>(request);
    return ok(await updateCategory(key, body, admin));
  });
}

/**
 * Hidden, not deleted. `products.category` points at this key, so the row has
 * to survive; the bot simply stops offering it.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  return handle('categories.deactivate', async () => {
    const admin = await requireAdminApi();
    const { key } = await params;
    await deactivateCategory(key, admin);
    return ok({ key, active: false });
  });
}
