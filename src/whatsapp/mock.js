'use strict';

/**
 * Terminal driver - lets the complete flow be tested locally without
 * connecting a real WhatsApp account. Same interface as the open-wa driver.
 *
 *   <text>          send a message as the current sender
 *   /as 9199...     switch sender (customer / admin / bypass number)
 *   /img [file]     send a payment screenshot
 *   /quit           exit
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../config');
const { MIME_BY_EXT } = require('./adapter');

module.exports = function mockDriver() {
  let handler = () => {};
  let rl = null;
  let sender = config.normalisePhone(process.env.MOCK_PHONE || '919000000001');
  let counter = 0;
  // real WhatsApp ids are globally unique - keep the fake ones unique per run
  // so duplicate protection does not swallow a fresh session
  const runId = Date.now().toString(36);

  return {
    name: 'mock',

    onMessage(fn) {
      handler = fn;
    },

    isConnected() {
      return true;
    },

    async start() {
      console.log(`
──────────────────────────────────────────────
 REPLI - MOCK MODE (no WhatsApp connection)
 Real Supabase database, simulated WhatsApp.
──────────────────────────────────────────────
 /as <number>   switch sender
 /img [file]    send a payment screenshot
 /quit          exit

 Admin: ${config.ADMIN_NUMBERS.join(', ') || '(not set)'}
 Sender: ${sender}
──────────────────────────────────────────────
`);
      rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.setPrompt(`${sender} > `);
      rl.prompt();

      // one line at a time, so piped input behaves like real typing
      let chain = Promise.resolve();
      let closed = false;
      // stdin can reach EOF while an async handler is still running
      const prompt = () => {
        if (!closed) rl.prompt();
      };

      rl.on('line', (line) => {
        chain = chain.then(() => handleLine(line)).catch((err) => console.error(err));
      });

      async function handleLine(line) {
        const input = line.trim();

        if (input === '/quit' || input === '/exit') {
          rl.close();
          process.exit(0);
        }

        if (input.startsWith('/as ')) {
          sender = config.normalisePhone(input.slice(4)) || sender;
          console.log(`→ now writing as ${sender}`);
          rl.setPrompt(`${sender} > `);
          return prompt();
        }

        let message;
        if (input === '/img' || input.startsWith('/img ')) {
          const file = input.slice(4).trim();
          let buffer = Buffer.from('fake-screenshot-bytes');
          let mimetype = 'image/jpeg';
          if (file && fs.existsSync(file)) {
            buffer = fs.readFileSync(file);
            mimetype = MIME_BY_EXT[path.extname(file).toLowerCase()] || 'image/jpeg';
          }
          message = {
            id: `mock_${runId}_${++counter}`,
            phone: sender,
            text: '',
            isMedia: true,
            media: { buffer, mimetype },
            mimetype,
            type: 'image',
          };
        } else {
          if (!input) return prompt();
          message = {
            id: `mock_${runId}_${++counter}`,
            phone: sender,
            text: input,
            isMedia: false,
            type: 'chat',
          };
        }

        try {
          await handler(message);
        } catch (err) {
          console.error('mock handler error:', err);
        }
        prompt();
      }

      // let any in-flight message finish before exiting (matters for piped input)
      rl.on("close", () => {
        closed = true;
        chain.then(() => process.exit(0)).catch(() => process.exit(1));
      });
    },

    async stop() {
      if (rl) rl.close();
    },

    async sendMessage(phone, text) {
      console.log(`\n📤 REPLI → ${phone}\n${text}\n`);
    },

    /**
     * The simulator has no presence to send, but it records the calls so a
     * test can assert the lifecycle, and prints them so `npm run mock`
     * shows the same rhythm a customer would see.
     */
    typingLog: [],
    async setTyping(phone, on) {
      this.typingLog.push({ phone, on, at: Date.now() });
      if (process.env.MOCK_QUIET !== 'true') {
        console.log(on ? `   … ${phone} sees "typing"` : `   · ${phone} typing stopped`);
      }
    },

    async sendMedia(phone, filePath, caption) {
      console.log(`\n📤 REPLI → ${phone} [FILE ${filePath}]\n${caption || ''}\n`);
    },

    async markAsRead() {},
  };
};
