import { requireAdminApi } from '@/lib/auth/guard';
import { deactivateVariant, updateVariant, type VariantInput } from '@/lib/services/products';
import { handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('variants.update', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;
    const body = await readJson<VariantInput>(request);

    const variant = await updateVariant(id, body, admin);
    return ok(variant);
  });
}

/**
 * Soft delete. Old orders point at their variant, so the row has to survive -
 * it is only hidden from the bot.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('variants.delete', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;

    await deactivateVariant(id, admin);
    return ok({ id, active: false });
  });
}
