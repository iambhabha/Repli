'use strict';

/**
 * Follow the live log and print conversations, not events.
 *
 *   node scripts/watch-turns.js
 *
 * The console output the bot writes while running is a stream of event names.
 * It tells you that a reply was sent; it does not tell you what the reply
 * said, and what the reply said is the only thing anybody actually wants to
 * know. The JSON log has the text, so this reads that instead and prints the
 * conversation the way it happened:
 *
 *   919321684451
 *     cust  cotton hai kya?
 *     tool  list_products ok
 *     shop  Haan bhai, cotton hai thodi stretch ke saath - print bhi solid hai
 *     ---   agent_reply · 2 tools · 3.1s
 *
 * Tool refusals are printed in full, because a refusal is the model reaching
 * for something the shop cannot do - a colour that is out, a product nobody
 * stocks - and it is the clearest signal there is of a conversation about to
 * go wrong.
 *
 * Read-only: it opens one file and follows it. It cannot affect the running
 * bot, so it is safe to leave attached to production.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');

/** Today's file, recomputed as it goes, so a midnight rollover is followed. */
function logFileFor(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  return path.join(LOG_DIR, `repli-${stamp}.log`);
}

const say = (line) => {
  process.stdout.write(`${line}\n`);
};

const clip = (value, max) => {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/**
 * Whose turn we are in the middle of printing.
 *
 * Events arrive one per line with no grouping, so the phone number is printed
 * only when it changes. A screen showing the same number over and over is a
 * screen nobody reads.
 */
let lastPhone = null;
let toolsThisTurn = 0;

function show(entry) {
  const event = entry.event || '';
  const phone = entry.phone || '';

  const header = () => {
    if (phone && phone !== lastPhone) {
      say(`\n${phone}`);
      lastPhone = phone;
    }
  };

  // ---- the customer, the tools, the reply -------------------------------
  if (event === 'turn') {
    header();
    say(`  cust  ${clip(entry.message, 160)}`);
    const seconds = entry.ms ? `${(entry.ms / 1000).toFixed(1)}s` : '';
    const tools = toolsThisTurn ? `${toolsThisTurn} tool${toolsThisTurn > 1 ? 's' : ''}` : 'no tools';
    say(`  ---   ${entry.action} · ${tools} · ${seconds}`);
    toolsThisTurn = 0;
    return;
  }

  if (event === 'reply.sent') {
    header();
    say(`  shop  ${clip(entry.reply, 400)}`);
    return;
  }

  if (event === 'agent.tool') {
    toolsThisTurn += 1;
    header();
    // A refusal is the interesting half; an "ok" is one word.
    say(`  tool  ${clip(entry.action, 200)}`);
    return;
  }

  if (event === 'agent.order_created') {
    header();
    say(`  ORDER ${entry.orderId} — ${clip(entry.action, 80)}`);
    return;
  }

  if (event === 'agent.handoff') {
    header();
    say(`  HAND OVER — ${clip(entry.action, 120)}`);
    return;
  }

  // ---- everything that went wrong ---------------------------------------
  if (entry.level === 'error' || entry.level === 'warn') {
    // Routine housekeeping that says nothing about the conversation.
    if (/^(sheet\.|invalidate\.|typing\.|whatsapp\.(ready_watchdog|attach_defer))/.test(event)) {
      return;
    }
    header();
    say(`  ${entry.level.toUpperCase()}  ${event} ${clip(entry.error || entry.action, 240)}`);
    return;
  }

  // ---- the few informational lines worth seeing --------------------------
  if (/^(repli\.started|whatsapp\.(ready|msg_hook|attach_done|disconnected))/.test(event)) {
    say(`· ${event} ${clip(entry.action || entry.phone, 60)}`);
    lastPhone = null;
  }
}

/**
 * Follow the file from the end, the way `tail -f` does.
 *
 * Polling rather than fs.watch: the log is appended to by another process on
 * Windows, where watch events on an open handle are unreliable, and a half
 * second of delay does not matter to somebody reading a conversation.
 */
function follow() {
  let file = logFileFor();
  let offset = fs.existsSync(file) ? fs.statSync(file).size : 0;
  let carry = '';

  say(`watching ${path.relative(ROOT, file)} — waiting for the next message…`);

  setInterval(() => {
    const current = logFileFor();
    if (current !== file) {
      // Past midnight: a new file, read from its beginning.
      file = current;
      offset = 0;
      carry = '';
      say(`\n· rolled over to ${path.basename(file)}`);
    }

    let size;
    try {
      size = fs.statSync(file).size;
    } catch (err) {
      return; // not written yet today
    }

    // Truncated or rotated under us: start again rather than read garbage.
    if (size < offset) offset = 0;
    if (size === offset) return;

    const stream = fs.createReadStream(file, { start: offset, end: size - 1, encoding: 'utf8' });
    offset = size;

    stream.on('data', (chunk) => {
      const lines = (carry + chunk).split('\n');
      carry = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          show(JSON.parse(line));
        } catch (err) {
          // A half-written line; the next poll brings the rest.
        }
      }
    });
  }, 500);
  // Left referenced on purpose: the timer is the only thing keeping this
  // process alive, which is exactly what a watcher wants.
}

follow();
