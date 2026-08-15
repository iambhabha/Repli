import { requireAdminApi } from '@/lib/auth/guard';
import { listTemplates } from '@/lib/services/templates';
import { handle, ok } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle('templates.list', async () => {
    await requireAdminApi();
    const groups = await listTemplates();
    return ok({ groups });
  });
}
