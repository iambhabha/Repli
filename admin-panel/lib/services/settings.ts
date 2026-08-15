import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AppSettingRow } from '@/types/database';

import { unwrap } from './shared';

export interface RepliSettings {
  businessName: string;
  paymentLink: string;
  shippingCharge: number;
  lowStockThreshold: number;
  botEnabled: boolean;
}

export const SETTING_KEYS = {
  businessName: 'business_name',
  paymentLink: 'payment_link',
  shippingCharge: 'shipping_charge',
  lowStockThreshold: 'low_stock_threshold',
  botEnabled: 'bot_enabled',
} as const;

const DEFAULTS: RepliSettings = {
  businessName: 'Repli',
  paymentLink: '',
  shippingCharge: 0,
  lowStockThreshold: 3,
  botEnabled: true,
};

/**
 * app_settings is the same table the bot reads, so a change here changes what
 * the bot does - that is the whole point of the panel.
 */
export async function getSettings(): Promise<RepliSettings> {
  const rows = unwrap(
    await supabaseAdmin().from('app_settings').select('key,value'),
    'settings.list'
  ) as Pick<AppSettingRow, 'key' | 'value'>[];

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    businessName: map.get(SETTING_KEYS.businessName) || DEFAULTS.businessName,
    paymentLink: map.get(SETTING_KEYS.paymentLink) || DEFAULTS.paymentLink,
    shippingCharge: toNumber(map.get(SETTING_KEYS.shippingCharge), DEFAULTS.shippingCharge),
    lowStockThreshold: toNumber(
      map.get(SETTING_KEYS.lowStockThreshold),
      DEFAULTS.lowStockThreshold
    ),
    botEnabled: (map.get(SETTING_KEYS.botEnabled) ?? 'true') === 'true',
  };
}

/** Cheap single-value read for pages that only need the threshold. */
export async function getLowStockThreshold(): Promise<number> {
  const { data } = await supabaseAdmin()
    .from('app_settings')
    .select('value')
    .eq('key', SETTING_KEYS.lowStockThreshold)
    .maybeSingle<{ value: string | null }>();

  return toNumber(data?.value, DEFAULTS.lowStockThreshold);
}

export async function isBotEnabled(): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from('app_settings')
    .select('value')
    .eq('key', SETTING_KEYS.botEnabled)
    .maybeSingle<{ value: string | null }>();

  return (data?.value ?? 'true') === 'true';
}

export interface SettingsUpdate {
  businessName?: string;
  paymentLink?: string;
  shippingCharge?: number;
  lowStockThreshold?: number;
  botEnabled?: boolean;
}

export async function updateSettings(update: SettingsUpdate): Promise<RepliSettings> {
  const rows: { key: string; value: string; updated_at: string }[] = [];
  const now = new Date().toISOString();

  const push = (key: string, value: string) => rows.push({ key, value, updated_at: now });

  if (update.businessName !== undefined) push(SETTING_KEYS.businessName, update.businessName.trim());
  if (update.paymentLink !== undefined) push(SETTING_KEYS.paymentLink, update.paymentLink.trim());
  if (update.shippingCharge !== undefined) {
    push(SETTING_KEYS.shippingCharge, String(Math.max(0, Math.round(update.shippingCharge))));
  }
  if (update.lowStockThreshold !== undefined) {
    push(SETTING_KEYS.lowStockThreshold, String(Math.max(0, Math.round(update.lowStockThreshold))));
  }
  if (update.botEnabled !== undefined) {
    push(SETTING_KEYS.botEnabled, update.botEnabled ? 'true' : 'false');
  }

  if (rows.length) {
    const { error } = await supabaseAdmin()
      .from('app_settings')
      .upsert(rows, { onConflict: 'key' });
    if (error) throw new Error(`settings.update: ${error.message}`);
  }

  return getSettings();
}

export async function setBotEnabled(enabled: boolean): Promise<boolean> {
  await updateSettings({ botEnabled: enabled });
  return enabled;
}

function toNumber(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
