import { requireAdminApi } from '@/lib/auth/guard';
import { logAdminAction } from '@/lib/audit';
import { invalidateSettings } from '@/lib/cache';
import { removeMedia, signedUrl, uploadMedia } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BadRequest, handle, ok } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

const KEY = 'payment_qr';

/**
 * A short-lived link so the settings page can show the scanner it has.
 * The reference itself never leaves the server as something to fetch.
 */
export async function GET() {
  return handle('settings.qr.get', async () => {
    await requireAdminApi();
    return ok({ url: await signedUrl(await current(), 300) });
  });
}

async function current(): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from('app_settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle<{ value: string | null }>();
  return data?.value ?? null;
}

/**
 * The shop's UPI scanner.
 *
 * Stored as a reference to the private bucket, never a URL: the bot
 * downloads it with the shop's own credentials and sends the file. A URL in
 * this row would be a URL the bot could be pointed at anything and told to
 * send to a customer.
 *
 * Same order as every other upload here - new file first, row second, old
 * file last - so a failure never leaves the setting naming a file that is
 * not there. The UPI id in the payment message is untouched and remains the
 * fallback when no QR is set.
 */
export async function POST(request: Request) {
  return handle('settings.qr.set', async () => {
    const admin = await requireAdminApi();

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string') throw new BadRequest('Choose a QR image to upload.');

    const previous = await current();

    const upload = await uploadMedia('qr', 'payment-qr', file);
    if (!upload.ok || !upload.reference) throw new BadRequest(upload.reason ?? 'Upload failed.');

    const { error } = await supabaseAdmin()
      .from('app_settings')
      .upsert({ key: KEY, value: upload.reference }, { onConflict: 'key' });

    if (error) {
      await removeMedia(upload.reference);
      throw new Error(`settings.qr: ${error.message}`);
    }

    if (previous && previous !== upload.reference) await removeMedia(previous);

    await logAdminAction({
      actor: admin.email,
      action: 'SETTINGS_UPDATED',
      entityType: 'setting',
      entityId: KEY,
      details: { qr: 'uploaded' },
    });

    await invalidateSettings([KEY], 'panel:qr');
    return ok({ paymentQr: upload.reference }, { status: 201 });
  });
}

/** Back to the UPI id as text, which never stopped working. */
export async function DELETE() {
  return handle('settings.qr.clear', async () => {
    const admin = await requireAdminApi();
    const previous = await current();

    const { error } = await supabaseAdmin()
      .from('app_settings')
      .upsert({ key: KEY, value: '' }, { onConflict: 'key' });
    if (error) throw new Error(`settings.qr: ${error.message}`);

    await removeMedia(previous);
    await logAdminAction({
      actor: admin.email,
      action: 'SETTINGS_UPDATED',
      entityType: 'setting',
      entityId: KEY,
      details: { qr: 'removed' },
    });

    await invalidateSettings([KEY], 'panel:qr');
    return ok({ paymentQr: null });
  });
}
