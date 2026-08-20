import { requireAdminApi } from '@/lib/auth/guard';
import { clearImage, setImage } from '@/lib/services/media';
import { signedUrl } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BadRequest, handle, ok } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

/**
 * A short-lived link, so the panel can show the picture it has.
 *
 * The reference itself is never handed to the browser as something to fetch:
 * the row holds `storage:bucket/key`, and only a signed URL valid for five
 * minutes leaves the server. The bucket stays private.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('product_variants.image.get', async () => {
    await requireAdminApi();
    const { id } = await params;

    const { data } = await supabaseAdmin()
      .from('product_variants')
      .select('image_path')
      .eq('id', id)
      .maybeSingle<{ image_path: string | null }>();

    return ok({ url: await signedUrl(data?.image_path ?? null, 300) });
  });
}

/**
 * One colour's own photo. Multipart rather than JSON, because the browser is
 * sending a file - and the file is validated by what it contains, not by what
 * the upload calls it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('variants.image.set', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string') throw new BadRequest('Choose an image to upload.');

    const result = await setImage("variant", id, file, admin);
    return ok(result, { status: 201 });
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle('variants.image.clear', async () => {
    const admin = await requireAdminApi();
    const { id } = await params;

    await clearImage("variant", id, admin);
    return ok({ id, imagePath: null });
  });
}
