import { requireAdminApi } from '@/lib/auth/guard';
import { getNotifications } from '@/lib/services/notifications';
import { handle, ok } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle('notifications.list', async () => {
    await requireAdminApi();
    const notifications = await getNotifications();
    return ok({ notifications });
  });
}
