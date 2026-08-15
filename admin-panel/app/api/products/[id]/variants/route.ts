import { requireAdminApi } from '@/lib/auth/guard';
import { createVariant, type VariantInput } from '@/lib/services/products';
import { handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('products.createVariant', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;
    const body = await readJson<VariantInput>(request);

    const variant = await createVariant({ ...body, productId: id }, admin);
    return ok(variant, { status: 201 });
  });
}
