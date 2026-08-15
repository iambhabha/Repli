import { logAdminAction } from '@/lib/audit';
import type { AdminSession } from '@/lib/auth/guard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BadRequest } from '@/lib/utils/http';

export type TemplateLanguage = 'hi' | 'en';

export const TEMPLATE_LANGUAGES: Array<{ code: TemplateLanguage; label: string }> = [
  { code: 'hi', label: 'Hinglish' },
  { code: 'en', label: 'English' },
];

export interface MessageTemplateRow {
  key: string;
  language: TemplateLanguage;
  body: string;
  default_body: string;
  label: string;
  description: string | null;
  placeholders: string[];
  category: string;
  sort_order: number;
  updated_at: string;
}

/** One message, with both languages side by side - that is how it is edited. */
export interface TemplateItem {
  key: string;
  label: string;
  description: string | null;
  placeholders: string[];
  category: string;
  sortOrder: number;
  bodies: Record<TemplateLanguage, string>;
  defaults: Record<TemplateLanguage, string>;
  edited: Record<TemplateLanguage, boolean>;
}

export interface TemplateGroup {
  category: string;
  label: string;
  items: TemplateItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  greeting: 'First contact',
  product: 'Choosing a product',
  quantity: 'Quantity',
  details: 'Name and address',
  order: 'Order',
  payment: 'Payment',
  closing: 'Handover and help',
  general: 'Other',
};

const CATEGORY_ORDER = [
  'greeting',
  'product',
  'quantity',
  'details',
  'order',
  'payment',
  'closing',
  'general',
];

/**
 * Every message the bot can send, grouped the way the conversation happens.
 *
 * The rows are seeded by the bot on startup (src/bot/templates.js), so this
 * list is empty until the bot has run at least once against this database -
 * which is exactly when the panel has something real to edit.
 */
export async function listTemplates(): Promise<TemplateGroup[]> {
  const { data, error } = await supabaseAdmin()
    .from('message_templates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`templates.list: ${error.message}`);

  const rows = (data ?? []) as MessageTemplateRow[];
  const byKey = new Map<string, TemplateItem>();

  for (const row of rows) {
    let item = byKey.get(row.key);
    if (!item) {
      item = {
        key: row.key,
        label: row.label,
        description: row.description,
        placeholders: row.placeholders ?? [],
        category: row.category,
        sortOrder: row.sort_order,
        bodies: { hi: '', en: '' },
        defaults: { hi: '', en: '' },
        edited: { hi: false, en: false },
      };
      byKey.set(row.key, item);
    }

    item.bodies[row.language] = row.body;
    item.defaults[row.language] = row.default_body;
    item.edited[row.language] = row.body.trim() !== row.default_body.trim();
  }

  const items = [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);

  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);
}

/** Placeholders the bot knows how to fill for this message. */
async function allowedPlaceholders(key: string): Promise<string[]> {
  const { data } = await supabaseAdmin()
    .from('message_templates')
    .select('placeholders')
    .eq('key', key)
    .limit(1)
    .maybeSingle<{ placeholders: string[] }>();

  return data?.placeholders ?? [];
}

export function findPlaceholders(body: string): string[] {
  return [...body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1] as string);
}

export async function updateTemplate(
  key: string,
  language: TemplateLanguage,
  body: string,
  admin: AdminSession
): Promise<MessageTemplateRow> {
  const text = body.trim();
  if (!text) throw new BadRequest('The message cannot be empty.');
  if (text.length > 4000) throw new BadRequest('That message is too long for WhatsApp.');

  /**
   * Reject unknown placeholders instead of saving them.
   *
   * The bot leaves an unrecognised {{name}} in the text rather than blanking
   * the line, so a typo would go out to a real customer looking like a bug.
   * Far better to refuse the save and say which word is wrong.
   */
  const allowed = await allowedPlaceholders(key);
  const unknown = [...new Set(findPlaceholders(text))].filter((name) => !allowed.includes(name));
  if (unknown.length) {
    throw new BadRequest(
      `Unknown placeholder${unknown.length > 1 ? 's' : ''}: ${unknown.map((n) => `{{${n}}}`).join(', ')}. ` +
        (allowed.length ? `This message can use: ${allowed.map((n) => `{{${n}}}`).join(', ')}.` : 'This message takes no placeholders.')
    );
  }

  const { data, error } = await supabaseAdmin()
    .from('message_templates')
    .update({ body: text })
    .eq('key', key)
    .eq('language', language)
    .select('*')
    .single<MessageTemplateRow>();

  if (error) throw new Error(`templates.update: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: 'TEMPLATE_UPDATED',
    entityType: 'template',
    entityId: `${key}:${language}`,
    details: { label: data.label, length: text.length },
  });

  return data;
}

/** Put back the wording Repli shipped with. */
export async function resetTemplate(
  key: string,
  language: TemplateLanguage,
  admin: AdminSession
): Promise<MessageTemplateRow> {
  const { data: current, error: readError } = await supabaseAdmin()
    .from('message_templates')
    .select('default_body')
    .eq('key', key)
    .eq('language', language)
    .maybeSingle<{ default_body: string }>();

  if (readError) throw new Error(`templates.reset: ${readError.message}`);
  if (!current) throw new BadRequest('That message does not exist.');

  const { data, error } = await supabaseAdmin()
    .from('message_templates')
    .update({ body: current.default_body })
    .eq('key', key)
    .eq('language', language)
    .select('*')
    .single<MessageTemplateRow>();

  if (error) throw new Error(`templates.reset: ${error.message}`);

  await logAdminAction({
    actor: admin.email,
    action: 'TEMPLATE_RESET',
    entityType: 'template',
    entityId: `${key}:${language}`,
  });

  return data;
}

/**
 * Render a template the way the bot would, for the panel's own outgoing
 * messages (payment verified, rejected, cancelled). Same table, same words -
 * so a confirmation sent from the dashboard is identical to one sent by the
 * bot, including any wording the owner changed.
 */
export async function renderTemplate(
  key: string,
  language: TemplateLanguage,
  vars: Record<string, string | number>
): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from('message_templates')
    .select('body')
    .eq('key', key)
    .eq('language', language)
    .maybeSingle<{ body: string }>();

  if (!data?.body) return null;

  const filled = data.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name] ?? '') : match
  );

  // Optional lines such as {{sizeLine}} leave a blank line behind when empty.
  return filled
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
