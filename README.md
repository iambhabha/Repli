# Repli v1 — WhatsApp Sales & Order Automation Bot

A small, rule-based WhatsApp bot for a business that sells **T-Shirts** and **Bags**.

It takes orders, collects payment screenshots, waits for a human to verify the
payment, then hands the customer to a real agent.

**Node.js + open-wa + Supabase PostgreSQL.**
No LLM, no AI API, no n8n, no SQLite, no microservices.

The owner uses the same WhatsApp number for personal chats, so the **bypass list**
is a first-class feature: Repli never replies to family or friends.

---

## 1. The flow

```
Instagram Reel → customer sees the WhatsApp number → customer messages
        ↓
   normalise number
        ↓
   ADMIN?   → admin commands
   BYPASS?  → do nothing at all
   BOT OFF? → do nothing
   HUMAN?   → do nothing (a person is handling it)
        ↓
   T-Shirt / Bag → colour → size → quantity → stock check
        ↓
   details → order summary → YES
        ↓
   PENDING_PAYMENT + payment link
        ↓
   screenshot → PAYMENT_VERIFYING → admin alerted
        ↓
   admin verifies the real payment → /paid REP-1001
        ↓
   VERIFIED + CONFIRMED → stock decreases → customer confirmation
        ↓
   conversation.mode = HUMAN → agent takes over
```

Repli never decides that a payment succeeded. Only `/paid` confirms an order,
and only then does stock move — all four steps in one Postgres transaction.

---

## 2. Supabase setup (do this first)

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Run the migrations.** Either:

   **A — from your machine** (easiest):
   ```bash
   npm install
   cp .env.example .env      # fill in SUPABASE_* values, see step 4
   npm run migrate
   ```

   **B — in the browser**: Supabase → **SQL Editor** → **New query**, then paste
   and run each file from `supabase/migrations/` **in order**:

   | File | What it does |
   | --- | --- |
   | `001_initial_schema.sql` | all 11 tables |
   | `002_indexes.sql` | indexes for the per-message queries |
   | `003_functions.sql` | `updated_at` triggers, `next_order_id()`, `confirm_order_payment()`, `reject_order_payment()` |
   | `004_rls.sql` | Row Level Security (deny-all for public roles) |
   | `005_seed_data.sql` | T-Shirt + Bag with stock |

   Every file is safe to re-run.

3. **Get your credentials**: Supabase → **Project Settings → API**
   * `SUPABASE_URL` — the Project URL
   * `SUPABASE_SECRET_KEY` — the **secret / service-role** key
   * `SUPABASE_DB_URL` (only for `npm run migrate`) — Project Settings →
     **Database → Connection string → URI**, *Session pooler*, with your database
     password.

4. **Put them in `.env`** (copy `.env.example`). Never commit `.env`.

5. **Test the connection**:
   ```bash
   npm test
   ```

> ⚠️ **The secret key bypasses Row Level Security.** Keep it server-side only —
> never in a browser, a mobile app, or a git commit. If it ever leaks, rotate it
> in Project Settings → API.

---

## 3. Install and run

```bash
npm install
cp .env.example .env    # fill it in
npm run migrate         # once
npm start
```

On first run a QR code appears. Scan it from **WhatsApp → Linked devices → Link
a device**. The session is stored in `.wa-session/`, so restarts do not ask again.

Requirements: Node.js 20+, and Chromium on a server (see §11).

### Local development without WhatsApp

```bash
npm run mock
```

A terminal simulator running the **real** router, state machine and Supabase
database — only WhatsApp is faked:

```
/as 919000000077              talk as a customer
bhai black tshirt chahiye
L
2
Name: Rahul
...
/img                          send a fake payment screenshot
/as 919999999999              switch to your admin number
/paid REP-1001
/quit
```

You can also drive it from code (`TEST_MODE=true`):

```javascript
const { createAdapter } = require('./src/whatsapp/adapter');
const { createRouter } = require('./src/bot/router');

const bot = createAdapter('mock');
bot.onMessage(createRouter(bot));

await bot.simulateIncomingMessage('919999999999', 'black tshirt chahiye');
```

### Tests

```bash
npm test
```

38 end-to-end checks against your **real** Supabase project: connection, phone
normalisation, bypass silence, bot switch, admin auth, the full sales flow,
stock rules, order creation, price snapshots, payment proof, atomic `/paid`,
double-`/paid` protection, `/reject`, HUMAN mode, duplicates, cancellation and
error handling.

The suite only ever touches phone numbers starting `91990000`, deletes every row
it creates, and restores any stock it changed.

---

## 4. Configuration — `.env`

| Variable | Meaning |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SECRET_KEY` | Secret/service-role key — **server only** |
| `SUPABASE_PUBLISHABLE_KEY` | Anon key (not used by the bot) |
| `SUPABASE_DB_URL` | Only for `npm run migrate` |
| `ADMIN_NUMBERS` | Owner/admin number(s), country code, no `+`, comma separated. Copied into `admin_numbers` at startup. |
| `PAYMENT_LINK` | UPI/payment link sent to customers |
| `BUSINESS_NAME` | Startup banner / logs |
| `SHIPPING_CHARGE` | Flat shipping in rupees (`0` = free) |
| `BOT_ENABLED` | Automated replies on/off at startup (`/bot off` changes it live) |
| `WA_DRIVER` | `openwa` (real) or `mock` (terminal) |
| `TEST_MODE` | Enables `simulateIncomingMessage()` |
| `ORDER_PREFIX` | Order id prefix, default `REP` |
| `MAX_QTY` | Max pieces per order |
| `COUNTRY_CODE` | Used to normalise 10-digit numbers (default `91`) |

Personal numbers do **not** go in `.env` — they live in the `bypass_numbers`
table so they can be changed without redeploying.

---

## 5. Bypass list (the most important rule)

For any active row in `bypass_numbers`, Repli does **nothing**: no reply, no
sales flow, no state change, no order, no admin notification — not even a
message row.

```
Friend: "bhai kya kar raha hai?"   → (silence)
Family: "ghar kab aa raha hai?"    → (silence)
```

Manage it from WhatsApp:

```
/bypass add 919876543210 Brother
/bypass remove 919876543210
/bypass list
```

…or in Supabase → Table editor → `bypass_numbers`.

Numbers are normalised first, so these are all the same person:

```
+91 98765 43210    919876543210    09876543210    9876543210
```

The check runs **before any database write** and **fails closed** — if the
lookup errors, Repli stays silent rather than risk answering your family.

---

## 6. Products and stock

Both live in Supabase, so the owner can edit them in the Table editor:

* `products` — name, description, price, active
* `product_variants` — colour, size, `sku`, **`stock_quantity`**

```
T-Shirt  Black  L    TS-BLK-L    stock 3
T-Shirt  White  XL   TS-WHT-XL   stock 3
Bag      Black  NULL BAG-BLK     stock 15
```

* `size` is `NULL` for products without sizes (Bag) — the size question is skipped.
* A product with one colour skips the colour question.
* **No variant row means zero stock.** Repli never invents stock or price.
* `active = false` hides a product or variant.

Changes appear within `CATALOGUE_TTL_MS` (15s default); anything that moves
stock clears the cache immediately.

Check from WhatsApp with `/stock` and `/product`.

---

## 7. Conversation states

```
START → SELECT_PRODUCT → SELECT_COLOR → SELECT_SIZE → SELECT_QUANTITY
      → COLLECT_DETAILS → ORDER_SUMMARY → WAITING_FOR_PAYMENT
      → PAYMENT_VERIFYING → CONFIRMED
                                   ↘ HUMAN_HANDOFF / CANCELLED
```

Bag (no sizes): `SELECT_PRODUCT → SELECT_COLOR → SELECT_QUANTITY`.

Separate from `state`, every customer has a **`mode`**: `BOT` or `HUMAN`.
`HUMAN` means Repli stays completely silent for that number.

### What customers can type

| Customer types | Understood as |
| --- | --- |
| `1`, `tshirt`, `t-shirt`, `shirt`, `tee`, `शर्ट` | T-Shirt |
| `2`, `bag`, `bags`, `jhola`, `बैग` | Bag |
| `black`, `blk`, `kaali`, `1` | Black |
| `white`, `safed` | White |
| `S`/`small`, `M`/`medium`, `L`/`large`, `XL`, `XXL`/`2xl` | size |
| `2`, `do`, `2 chahiye` | quantity 2 |
| `yes`, `haan`, `ji`, `theek hai` | YES |
| `no`, `nahi`, `galat` | NO |
| `human`, `owner se baat karni hai` | human handoff |

One message can carry several answers:

```
Customer: "bhai reel wali black tshirt chahiye"
Repli:    Bilkul bhai 👕🔥
          Black T-Shirt available hai.
          Size bata do:
          S / M / L / XL / XXL
```

Delivery details can be pasted as a labelled block…

```
Name: Rahul Sharma
Address: 12 MG Road
City: Jaipur
State: Rajasthan
PIN: 302001
```

…or answered one at a time. A returning customer is **asked** before their
saved address is reused (YES / NO).

### Customer commands

`start` / `menu` / `restart` · `help` · `cancel` · `address` · `human`

---

## 8. Admin commands

From any number in `admin_numbers`:

| Command | Effect |
| --- | --- |
| `/bot on` · `/bot off` | Global automated replies on/off |
| `/human NUMBER` | Stop the bot for that customer |
| `/resume NUMBER` | Put them back on the bot |
| `/bypass add NUMBER NAME` | Never answer this number again |
| `/bypass remove NUMBER` | Undo it |
| `/bypass list` | Show the list |
| `/paid REP-1001` | Payment verified → `VERIFIED` + `CONFIRMED`, stock down, customer notified, customer → HUMAN |
| `/reject REP-1001` | Payment rejected → `REJECTED` + `PAYMENT_FAILED`, **stock untouched**, customer → HUMAN |
| `/order REP-1001` | Full order + payment proof image |
| `/orders` | Last 10 orders |
| `/stock` | Current stock |
| `/product` | Products and prices |
| `/help` | This list |

Any other number typing `/paid` is just a customer — the command does nothing.
Non-command messages from an admin are ignored, so the owner's ordinary chatter
never starts a sales flow.

---

## 9. Payment rules

1. Customer confirms the summary → order `PENDING_PAYMENT`, payment `PENDING`.
   **Stock is not reduced.**
2. Payment link sent.
3. Screenshot arrives → stored at `data/proofs/` (mode `0600`, outside any web
   root), `payments.proof_url` recorded, order → `PAYMENT_VERIFYING`, payment →
   `PROOF_RECEIVED`, admin alerted with the image.
4. A screenshot is **never trusted**.
5. Admin sends `/paid` → `confirm_order_payment()` runs as one transaction:
   payment `VERIFIED` → order `CONFIRMED` → stock decreased → conversation
   `HUMAN`. If any step fails the whole thing rolls back — no half-confirmed
   orders, and a second `/paid` cannot double-deduct stock.

Order statuses: `PENDING_PAYMENT`, `PAYMENT_VERIFYING`, `CONFIRMED`,
`CANCELLED`, `PAYMENT_FAILED`.
Payment statuses: `PENDING`, `PROOF_RECEIVED`, `VERIFIED`, `REJECTED`.

`order_items` snapshots product name, colour, size and unit price, so changing a
price later never rewrites an old order.

---

## 10. Project structure

```
repli/
├── src/
│   ├── index.js                startup, preflight, shutdown
│   ├── logger.js               JSON logs, card numbers redacted
│   ├── config/index.js         .env, paths, phone normalisation
│   ├── db/supabase.js          the one Supabase client
│   ├── whatsapp/
│   │   ├── adapter.js          the interface the rest of Repli uses
│   │   ├── openwa.js           open-wa driver
│   │   └── mock.js             terminal driver
│   ├── bot/
│   │   ├── router.js           priority chain, duplicates, errors
│   │   ├── stateMachine.js     the conversation flow
│   │   ├── parser.js           keyword rules (Hindi / Hinglish / English)
│   │   └── messages.js         every message template
│   └── services/
│       ├── customerService.js      conversationService.js
│       ├── productService.js       orderService.js
│       ├── paymentService.js       bypassService.js
│       ├── adminService.js         settingsService.js
│       └── messageService.js
├── supabase/migrations/        001…005 SQL
├── scripts/migrate.js          npm run migrate
├── tests/flow.test.js          38 end-to-end checks
├── data/proofs/                payment screenshots (git-ignored)
└── logs/
```

No raw queries outside `src/services/*` and `src/db/supabase.js`.

Tables: `customers`, `conversations`, `messages`, `products`,
`product_variants`, `orders`, `order_items`, `payments`, `bypass_numbers`,
`admin_numbers`, `app_settings`.

---

## 11. WhatsApp adapter

All WhatsApp-library code lives in `src/whatsapp/`. The rest of Repli only uses:

```javascript
adapter.onMessage(callback)
adapter.sendMessage(phone, text)
adapter.sendImage(phone, filePath, caption)   // sendMedia is an alias
adapter.markAsRead(messageId, phone)
adapter.isConnected()
adapter.notifyAdmins(text)
adapter.notifyAdminsImage(filePath, caption)
adapter.simulateIncomingMessage(phone, text)  // TEST_MODE
```

Incoming messages are normalised to:

```javascript
{ id, phone, text, isMedia, media: { buffer, mimetype },
  isGroup, isStatus, fromMe, type, timestamp }
```

Swapping open-wa for another library means writing one new driver file — no
business logic changes. `mock.js` is a working example.

---

## 12. Deployment on a small VPS

```bash
sudo apt update && sudo apt install -y nodejs npm git chromium-browser
git clone <your-repo> repli && cd repli
npm install
cp .env.example .env && nano .env
npm run migrate          # once, if you have not already
npm start                # QR appears in the terminal - scan it over SSH
```

Two lines in `.env` matter on a server:

```
CHROME_PATH=/usr/bin/chromium-browser   # do not make it guess
WA_HEADLESS=true                        # there is no screen anyway
```

The QR is printed **in the terminal**, so plain SSH is enough — no desktop, no
X11, no VNC. Scan it, wait for `✅ Repli connected as …`, then stop with
`Ctrl+C` and start it again under pm2 or systemd: the session now lives in
`.wa-session/` and is not asked for again.

`.wa-session/` **is** the login. Back it up with `data/proofs/`, never commit
it, and if you ever move servers, copying that folder moves the session with
you instead of re-scanning.

Keep it running with pm2:

```bash
sudo npm install -g pm2
pm2 start src/index.js --name repli
pm2 save
pm2 startup              # run the command it prints
pm2 logs repli
```

Or systemd (`/etc/systemd/system/repli.service`):

```ini
[Unit]
Description=Repli WhatsApp bot
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/repli
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
User=ubuntu

[Install]
WantedBy=multi-user.target
```

Supabase handles database backups. Also back up **`data/proofs/`** — the payment
screenshots live on the bot's own disk, not in Supabase.

---

## 13. Security

* Admin commands only work for numbers in `admin_numbers` (admin check fails
  closed).
* The bypass check runs before any write and fails closed.
* RLS is enabled on every table with no policies, so the publishable key can
  read nothing. Only the secret key (server-side) has access.
* `confirm_order_payment` / `reject_order_payment` are revoked from `anon` and
  `authenticated`.
* Duplicate WhatsApp events are dropped by a unique index on
  `messages(message_id) WHERE direction='INCOMING'`.
* Messages from one customer are processed one at a time; different customers
  run concurrently, so the listener is never blocked.
* Customers never see a stack trace — they get a friendly message and are moved
  to HUMAN mode, while admins get the real error.
* Payment screenshots are `0600`, outside any web root, and only ever sent to
  admin numbers.
* Card-like digit sequences are redacted before anything reaches the logs.
* No card numbers, CVVs or OTPs are ever stored.
* All input is validated (name, address, city, state, 6-digit PIN, quantity) and
  every query is parameterised through the Supabase client.

---

## 14. Test conversation examples

**Customer**

```
Customer: bhai reel wali black tshirt chahiye
Repli:    Bilkul bhai 👕🔥
          Black T-Shirt available hai.
          Size bata do: S / M / L / XL / XXL
Customer: L
Repli:    Haan bhai ✅ Black T-Shirt - L available hai. Price: ₹699
          Kitni quantity chahiye?
Customer: 2
Repli:    Order complete karne ke liye details bhej do bhai: ...
Customer: Name: Rahul ... PIN: 302001
Repli:    🛍️ ORDER SUMMARY ... TOTAL: ₹1398 ... YES / NO
Customer: yes
Repli:    Order #REP-1001 ready hai bhai ❤️ ... [payment link]
Customer: [screenshot]
Repli:    Payment proof mil gaya bhai ❤️ ...
Admin:    /paid REP-1001
Repli:    (to customer) Payment received successfully bhai ❤️✅ ...
          → mode = HUMAN, bot stops replying
```

**Friend (bypass number)**

```
Friend: bhai kya kar raha hai?   → (no reply, nothing stored)
```

**Out of stock**

```
Customer: white
Customer: L
Repli:    Sorry bhai 😕 White T-Shirt - L abhi out of stock hai.
          Dusra size try kar sakte ho: S / M / XL / XXL
```

---

## 15. Troubleshooting

| Problem | Fix |
| --- | --- |
| `Supabase connection failed` | Check `SUPABASE_URL` / `SUPABASE_SECRET_KEY`, then `npm run migrate` |
| `npm run migrate` cannot connect | `SUPABASE_DB_URL` must be the **Session pooler** URI with your database password; or paste the SQL files into the SQL Editor |
| QR code does not appear | Delete `.wa-session/` and run `npm start` again |
| Chromium fails on the VPS | `sudo apt install -y chromium-browser libnss3 libatk-bridge2.0-0 libgbm1 libasound2` |
| Admin commands do nothing | The number must be in `admin_numbers` (put it in `ADMIN_NUMBERS` and restart) |
| Bot ignores one customer | HUMAN mode (`/resume NUMBER`) or on the bypass list (`/bypass list`) |
| Bot ignores everyone | `/bot on` — it may be switched off |
| Stock looks wrong | Supabase → Table editor → `product_variants`, or `/stock` |

---

## 16. Admin panel

`admin-panel/` is a Next.js dashboard for the owner: every conversation, human
takeover, payment verification, products, stock, bypass numbers and the bot
switch. It reads and writes **this same Supabase database**, so it is not a
separate system — change stock there and the bot sells the new number.

```bash
cd admin-panel
npm install
cp .env.example .env.local     # Supabase URL + publishable + secret key
npm run create-admin -- --email you@example.com --password "…"
npm run dev                    # http://localhost:3000/admin/login
```

Full instructions: [`admin-panel/README.md`](admin-panel/README.md).

Two migrations exist for it, and both must be applied before first use:

| File | What it adds |
| --- | --- |
| `006_admin_panel.sql` | `admin_users` (panel allowlist), `admin_actions` (audit log), `outbound_messages` (queue), `conversations.last_read_at`, realtime publication |
| `007_admin_views.sql` | `admin_inbox` and `admin_customers` read models |

Both keep the deny-all RLS of `004_rls.sql`: the panel never reads data from the
browser, only server-side with the secret key, and only for an email that has an
active `admin_users` row.

One piece of the bot belongs to the panel: **`src/outbox/worker.js`**, started
from `src/index.js`. The panel cannot speak WhatsApp — it may be running on
Vercel — so a reply typed there is written to `outbound_messages`, and this
worker sends it through the same adapter as any other reply and records it in
`messages`. Nothing is sent while the WhatsApp session is down; the rows wait.

Payment verification in the panel calls `confirm_order_payment()` — the exact
function `/paid` uses. There is one path to confirming money, whichever screen
you are on.

---

## 17. AI layer (optional)

Off by default. With `OPENAI_API_KEY` empty the bot runs exactly as it always
did: templates, rule parser, no network calls, no cost.

With a key it does **two** jobs, and deliberately no others.

**1. It rewrites replies so they sound human.** The rule engine still decides
what to say — which product, which price, which order id, what happens next.
The model only changes the wording. Every rewrite is then checked against the
original before it leaves (`src/ai/humanise.js`):

| Check | Why |
|---|---|
| every number in the original survives, no new number appears | stops an invented price, quantity or order id |
| links byte-identical, same count | a payment link is not a place for creativity |
| length ≤ 1.8× the original | a rewrite that grew has usually added a promise |

Fail any check and the original template is sent. `npm run test:ai` covers this.

**2. It reads messages the parser could not.** `src/ai/understand.js` is handed
the options the shop actually has — real products, real colours, real sizes —
and returns one of them or nothing. Anything off the list is discarded. It
answers no one and decides nothing; the state machine continues as if the
customer had typed the plain word.

One place is deliberately excluded: confirming an order. The model may resolve
"no" at the summary step but never "yes", because a wrong "yes" places an order
the customer never agreed to.

**Not humanised:** admin messages (recipient is checked in the adapter) and
replies typed by a person in the panel.

### Cost

`gpt-4o-mini` is the default for a reason:

| Traffic | gpt-4o-mini | full-size model |
|---|---|---|
| 5,000 messages/month | ~₹120 | ~₹3,000 |

Identical replies are rewritten once and cached for 6 hours, so a welcome
message going to 500 customers costs one call, not 500.

`AI_MONTHLY_BUDGET_INR` (default 1000) is a hard fuse, not a warning. Every
call is written to `ai_usage`, month-to-date spend is checked before each
request, and once it crosses the limit the AI switches itself off until the 1st
— the shop keeps running on templates. See `src/services/aiUsageService.js`.

Timeouts (`AI_TIMEOUT_MS`, default 6s), HTTP errors and a missing key all fall
back to the template. There is no path where the AI failing stops a reply.

## 18. Not in v1 (by design)

No embeddings, no RAG, no LangChain, no n8n, no multi-item cart, no automatic
payment verification.
