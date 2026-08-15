import { requireAdminApi } from '@/lib/auth/guard';
import {
  resetTemplate,
  updateTemplate,
  type TemplateLanguage,
} from '@/lib/services/templates';
import { assert, handle, ok, readJson } from '@/lib/utils/http';

export const dynamic = 'force-dynamic';

interface Body {
  language?: TemplateLanguage;
  body?: string;
  reset?: boolean;
}

/** Save new wording, or put the shipped wording back with `reset: true`. */
export async function PUT(request: Request, { params }: { params: Promise<{ key: string }> }) {
  return handle('templates.update', async () => {
    const admin = await requireAdminApi();
    const { key } = await params;
    const payload = await readJson<Body>(request);

    const language = payload.language;
    assert(language === 'hi' || language === 'en', 'Pick a language.');

    if (payload.reset) {
      return ok(await resetTemplate(key, language, admin));
    }

    assert(typeof payload.body === 'string', 'Send the message text.');
    return ok(await updateTemplate(key, language, payload.body, admin));
  });
}
