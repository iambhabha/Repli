import { requireAdminApi } from '@/lib/auth/guard';
import { getProduct, updateProduct, type ProductInput } from '@/lib/services/products';
import { fail, handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('products.get', async () => {
    await requireAdminApi();
    const { id } = await params;

    const product = await getProduct(id);
    if (!product) return fail('Product not found.', 404);

    return ok(product);
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('products.update', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;
    const body = await readJson<ProductInput>(request);

    const product = await updateProduct(id, body, admin);
    return ok(product);
  });
}
