import { logAdminAction } from '@/lib/audit';
import { requireAdminApi } from '@/lib/auth/guard';
import { getSettings, updateSettings, type SettingsUpdate } from '@/lib/services/settings';
import { handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle('settings.get', async () => {
    await requireAdminApi();
    return ok(await getSettings());
  });
}

/**
 * §26-27. Writes straight to `app_settings`, which the bot reads on a ten
 * second cache - so the bot switch really is a bot switch.
 */
export async function PUT(request: Request) {
  return handle('settings.update', async () => {
    const admin = await requireAdminApi();
    const body = await readJson<SettingsUpdate>(request);

    const settings = await updateSettings(body);

    if (body.botEnabled !== undefined) {
      await logAdminAction({
        actor: admin.email,
        action: body.botEnabled ? 'BOT_ENABLED' : 'BOT_DISABLED',
        entityType: 'settings',
        entityId: 'bot_enabled',
      });
    }

    const { botEnabled: _botEnabled, ...rest } = body;
    if (Object.keys(rest).length) {
      await logAdminAction({
        actor: admin.email,
        action: 'SETTINGS_UPDATED',
        entityType: 'settings',
        details: rest,
      });
    }

    return ok(settings);
  });
}
