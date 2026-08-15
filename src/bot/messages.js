'use strict';

/**
 * Hinglish pack + the admin-facing messages.
 *
 * Customer wording now lives in src/bot/templates.js and, once the owner
 * edits it in the admin panel, in the `message_templates` table. This file
 * keeps only what the owner sees: alerts, command output, error reports.
 * Those stay in one language on purpose - there is one admin, and he picked it.
 */

const config = require('../config');
const { createPack, money, describe, itemOf } = require('./pack');

const messages = {
  ...createPack('hi'),

  adminPaymentAlert(order) {
    const item = itemOf(order);
    const lines = [
      '🚨 PAYMENT VERIFICATION',
      '',
      `Order: #${order.order_id}`,
      '',
      `Customer: ${order.customer_name || '-'}`,
      `Phone: ${order.phone}`,
      '',
      `Product: ${item.product_name_snapshot || '-'}`,
      `Color: ${item.color_snapshot || '-'}`,
    ];
    if (item.size_snapshot) lines.push(`Size: ${item.size_snapshot}`);
    lines.push(
      `Quantity: ${item.quantity || 1}`,
      '',
      `Expected Amount: ${money(order.total)}`,
      '',
      `Address: ${[order.address, order.city, order.state, order.pin].filter(Boolean).join(', ')}`,
      '',
      'Payment Proof: 👆',
      '',
      'Use:',
      '',
      `/paid ${order.order_id}`,
      '',
      'or',
      '',
      `/reject ${order.order_id}`
    );
    return lines.join('\n');
  },

  adminHelp: () => `🛠️ REPLI ADMIN COMMANDS

BOT
/bot on | /bot off          automated replies on/off

HANDOFF
/human NUMBER               bot stop, human takes over
/resume NUMBER              bot dobara chalu

BYPASS (personal numbers)
/bypass add NUMBER NAME
/bypass remove NUMBER
/bypass list

ORDERS
/orders                     last 10 orders
/order ORDER_ID             order details + proof
/paid ORDER_ID              payment verified -> CONFIRMED
/reject ORDER_ID            payment rejected

CATALOGUE
/product                    products aur prices
/stock                      current stock

/help                       ye message

Example:
/paid ${config.ORDER_PREFIX}-1001`,

  adminOrderView(order) {
    const item = itemOf(order);
    const payments = (order.payments || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const lines = [
      `📦 ORDER #${order.order_id}`,
      '',
      `Status: ${order.status}`,
      `Payment: ${payments.length ? payments[payments.length - 1].status : '-'}`,
      '',
      `Customer: ${order.customer_name || '-'}`,
      `Phone: ${order.phone}`,
      `Address: ${
        [order.address, order.city, order.state, order.pin].filter(Boolean).join(', ') || '-'
      }`,
      '',
      `Product: ${item.product_name_snapshot || '-'}`,
      `Color: ${item.color_snapshot || '-'}`,
      `Size: ${item.size_snapshot || '-'}`,
      `Qty: ${item.quantity || 1}`,
      '',
      `Subtotal: ${money(order.subtotal)}`,
      `Shipping: ${money(order.shipping)}`,
      `TOTAL: ${money(order.total)}`,
      '',
      `Created: ${order.created_at}`,
    ];
    if (payments.length) {
      lines.push('', 'Payment log:');
      for (const p of payments) {
        lines.push(`• ${p.created_at} ${p.status}${p.verified_by ? ` by ${p.verified_by}` : ''}`);
      }
    }
    return lines.join('\n');
  },

  adminOrderList(orders) {
    if (!orders.length) return 'Abhi tak koi order nahi hai.';
    const lines = ['📋 RECENT ORDERS', ''];
    for (const o of orders) {
      const item = itemOf(o);
      lines.push(
        `#${o.order_id}`,
        `${money(o.total)}`,
        `${o.status}`,
        `   ${item.product_name_snapshot || '-'}${item.color_snapshot ? ` ${item.color_snapshot}` : ''}${
          item.size_snapshot ? ` ${item.size_snapshot}` : ''
        } x${item.quantity || 1}`,
        `   ${o.customer_name || '-'} (${o.phone})`,
        ''
      );
    }
    return lines.join('\n').trim();
  },

  adminStock(groups) {
    if (!groups.length) return 'Koi product configure nahi hai.';
    const lines = ['📊 STOCK', ''];
    for (const group of groups) {
      lines.push(`${group.product}${group.active ? '' : ' (inactive)'}`);
      if (!group.rows.length) lines.push('  (koi variant nahi)');
      for (const row of group.rows) {
        const label = row.size ? `${row.color} ${row.size}` : `${row.color}`;
        lines.push(`  ${row.quantity > 0 ? '✅' : '❌'} ${label}: ${row.quantity}`);
      }
      lines.push('');
    }
    lines.push('Edit: Supabase → Table editor → product_variants');
    return lines.join('\n');
  },

  adminProducts(rows) {
    if (!rows.length) return 'Koi product configure nahi hai.';
    const lines = ['🧾 PRODUCTS', ''];
    for (const row of rows) {
      lines.push(
        `${row.active ? '✅' : '⛔'} ${row.name} (${row.code}) - ${money(row.price)}`,
        `   Colors: ${row.colors.join(', ') || '-'}`,
        `   Sizes: ${row.sizes.length ? row.sizes.join(', ') : '(no sizes)'}`,
        ''
      );
    }
    lines.push('Edit: Supabase → Table editor → products / product_variants');
    return lines.join('\n');
  },

  adminBypassList(rows) {
    const active = rows.filter((r) => r.active);
    if (!active.length) {
      return `🚫 BYPASS LIST khali hai.

Add karne ke liye:
/bypass add 919876543210 Brother`;
    }
    return `🚫 BYPASS NUMBERS (${active.length})

${active.map((r) => `• ${r.phone}${r.name ? ` - ${r.name}` : ''}`).join('\n')}

Repli in numbers ko kabhi reply nahi karta.`;
  },

  adminError: (context, error) => `⚠️ REPLI ERROR

Where: ${context}

${error}`,

  money,
  describe,
};

/**
 * Pick the pack for a customer's language.
 *
 * Both packs expose identical keys and signatures, so callers hold one or the
 * other and never branch on language themselves. Anything that is not 'en'
 * falls back to Hinglish - an unknown value must never blank out a message.
 */
messages.for = function packFor(language) {
  return language === 'en' ? require('./messages.en') : messages;
};

module.exports = messages;
