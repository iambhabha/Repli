# Repli — build log

What this bot is, what was changed and why, and what is still open.
Written for whoever picks this up next, including me in three months.

---

## 1. What it does now

A WhatsApp sales bot for **3POINTER.CLUB** (bags) and **AESTHURA**
(T-shirts, hoodies). It runs the whole conversation — greeting, catalogue,
size, delivery details, booking, payment proof — and hands over to a person
the moment a decision needs a human.

```
customer WhatsApp
        │
        ▼
   src/bot/router.js         gatekeeper: group / bypass / allowlist / echo / advert
        │
        ▼
   src/bot/stateMachine.js   the flow. Owns every fact and every state change.
        │        │
        │        ├── src/ai/intent.js       reads a whole sentence
        │        ├── src/ai/understand.js   picks one option from a list
        │        ├── src/ai/reply.js        writes the reply when the script runs out
        │        └── src/bot/faq.js         fixed answers from the database
        ▼
   src/whatsapp/adapter.js   one send path; rewrites replies via src/ai/humanise.js
        │
        ▼
   whatsapp-web.js  →  WhatsApp
```

Supabase holds everything. The admin panel (`admin-panel/`, Next.js) is the
owner's control room and writes to the same tables the bot reads.

### The split that matters

**The rule engine owns facts.** Price, stock, order numbers, booking
amounts, what happens next. All from the database.

**The AI owns words and reading.** It rewords replies, reads messages the
keyword parser cannot, picks the reply language, and writes an answer when
the script has nothing sensible to say.

The AI is never given the ability to decide. Every option it picks comes
from a list built out of the live catalogue, and every sentence it writes is
checked before it is sent (§4).

---

## 2. The business rules

From the shop's own sales memory (`AI_Agent_Updated_Memory_AESTHURA_3POINTER.pdf`),
encoded in `supabase/migrations/010_aesthura_3pointer.sql` and the templates.

| Rule | Where it lives |
|---|---|
| Never lead with price — options first, price after design + size | `templates.js` welcome/available, test 9 |
| ₹500 books a T-shirt size, ₹1,999 on delivery | `products.booking_amount`, `orders.booking_amount` |
| BAPE Single ₹3,999 / Double ₹4,599, booking ₹1,500 | catalogue |
| Bags ₹2,499, paid in full, 24 colours | migration 013 |
| Wait time only when asked (15-20 days making, 20-30 overall) | `app_settings.tshirt_lead_time`, test 16d |
| COD +₹200, mentioned only when asked | `products.cod_available` |
| Never invent prices, stock or UPI details | AI guards, §4 |
| Never create fake urgency | humanise system prompt |
| Prices are fixed — no discounts | `priceFixedAnswer` template |
| Refunds are a person's decision | `refundAnswer` + immediate handover |

Nothing above is hardcoded in JavaScript. Categories, products, keywords,
prices, lead times, the shop's name and the pickup city are all rows the
owner can edit.

---

## 3. The conversation

```
greeting            "Welcome to 3POINTER.CLUB!"
   ↓                (a second message, so the question stands alone)
category            1. T-Shirts   2. Hoodies       ← only categories with stock
   ↓
design              Spider-Man — Red  /  Venom — Black
   ↓
size                S M L XL XXL                    ← colour skipped when implied
   ↓
price + booking     ₹2499 · ₹500 now · ₹1999 later  ← first mention of money
   ↓
details             name, address, city, state, PIN  (saved as they arrive)
   ↓
summary             everything, then YES / NO
   ↓
booking             UPI details, screenshot requested
   ↓
verification        owner gets the proof + /paid or /reject
```

Shortcuts are handled: `"spiderman XL me hai kya"` goes straight to price,
`"tshirt chahiye"` shows both designs, and `"bhai ye 3pointer club hai?
spider man wali hai kya"` is read as category + design + question at once.

---

## 4. How the AI is kept honest

`src/ai/humanise.js` rewrites replies. Before any rewrite is sent:

| Check | Catches |
|---|---|
| every number in the original survives, no new number appears | invented prices, quantities, order ids |
| links byte-identical, same count | a changed payment link |
| length ≤ 1.8× and ≥ 0.35× the original | added promises; a reply that collapsed to one word |
| a question stays a question | `"Which size?"` coming back as `"S, M, L."` |
| form labels stay on their own lines | the address form turned into prose |

Fail any check and the template is sent instead. `npm run test:ai` covers all
of them.

`src/ai/reply.js` composes when the script has nothing to say. It is given
the shop's facts, the phase and the transcript, and may only use numbers it
was handed. Anything else falls back to the template.

Since the model also receives the phase, what the customer has already told
us, and the last few turns, replies read as a conversation rather than a form
letter — and it is told not to ask again for something already given.

**Never sent to the API:** the order summary and saved-address messages —
they carry the customer's postal address, and an address is text the customer
typed, so it is also the obvious injection path.

---

## 5. Bugs found while testing, and what they cost

Found by reading real transcripts and by a four-agent audit of the code.
Every one of these was live.

### Would have lost or corrupted an order

| Bug | What happened |
|---|---|
| `"haan bhej do na"` read as **no** | `na` is a Hinglish tag particle; every confirmation ending in it cancelled the order and wiped the address |
| Menu number matched the whole catalogue | Customer picked Hoodies, typed `1`, was sold a Spider-Man T-shirt |
| `"aane se pehle call karo"` in an address | Read as "I want a human"; the bot went silent permanently and the order was abandoned |
| `"haan bhai deliver kar do"` at the summary | Answered with the shop's address; the YES never reached order creation, so **no order row was created** |
| Customer pasted the bot's own prompt | Stored as their delivery address, then offered back as "your saved address" forever |
| Any photo counted as payment proof | A screenshot sent while browsing was filed against an older order |
| `"Mumbai"` inside an address | Read as "where is your shop?" — the whole address was swallowed |
| Form filled under the labels | `name = "Name:"`, `state = "PIN Code:"` |

### Money and privacy

| Bug | What happened |
|---|---|
| `payments.amount` recorded the full price | The panel showed ₹2,499 collected for every ₹500 booking — about 5× the real figure |
| Order summary sent to OpenAI | The customer's full postal address left the system for a cosmetic rewrite |

### Quality

| Bug | What happened |
|---|---|
| `"Bhai naam sahi se likh do"` → `"Aesthura"` | The model answered the prompt instead of rewriting it |
| `"Address bhej do"` → `"main address share nahi kar sakta"` | Same cause, opposite meaning |
| `<<<REPLY … REPLY>>>` reached a customer | The prompt fence leaked into an order summary |
| `"Hy"` saved as a customer's name | A greeting is not an answer |
| The same line repeated twelve times | No escalation when a customer was stuck |
| Company broadcasts answered as customers | AstroTalk and CRED adverts got a greeting and cost AI calls |

---

## 6. Speed

Measured per message, before and after (`db` = Supabase round trips):

| Message | Before | After |
|---|---|---|
| `hi` | 24 calls, 4.9s | 21 calls, 4.7s (cold cache) |
| `1` | 10 calls, 2.0s | **5 calls, 1.3s** |
| `spiderman` | 10 calls, 2.0s | **6 calls, 1.4s** |
| `M` | 14 calls, 3.7s | **8 calls, 2.6s** |
| `kitne ka hai` | 10 calls, 1.8s | **6 calls, 1.3s** |

What changed:

- the conversation row was being fetched four to six times per message by
  different parts of the code — now cached for two seconds and written
  through on every save
- the customer row, likewise
- AI usage rows and outgoing message rows are written in the background
  instead of in front of the reply
- settings are cached for thirty seconds

The remaining round trips are writes. What is left of the wait is OpenAI
thinking, not the database.

**Redis** (`src/db/cache.js`) is wired and switches on with `REDIS_URL`;
without it the same code uses an in-process map. For a single bot process
memory is the faster of the two — Redis earns its place when the panel and
the bot need to share a cache, or when several bot processes run at once.

---

## 7. Running it

```bash
npm start                  # the bot (WhatsApp)
npm run mock               # the bot in a terminal, no WhatsApp
npm test                   # 43 end-to-end tests against the real database
npm run test:ai            # 19 tests of the AI guard rails
node scripts/migrate.js    # apply migrations
node scripts/import-bypass.js contacts.json --dry
```

Two further suites are worth keeping alongside: a ten-scenario live rehearsal
(61 checks, booking through `/reject`) and a phrasing gauntlet (22 ways a
customer might open a conversation).

### Configuration

`.env` holds the keys. Everything the owner should be able to change lives in
`app_settings` and is editable from the panel:

| Key | Now |
|---|---|
| `greeting_brands` | 3POINTER.CLUB |
| `allowed_numbers` | 919829374438 — **test mode: the bot answers nobody else** |
| `payment_link` | 9799757664@ybl |
| `ai_instructions` | empty — free text, added to every AI prompt |
| `location_city` | Dadar, Mumbai |

### Cost

`gpt-4o-mini`, measured: **₹0.008 per message**, so roughly ₹40/month at
5,000 messages. `AI_MONTHLY_BUDGET_INR` (1000) is a hard fuse — every call is
recorded in `ai_usage`, month-to-date spend is checked before each request,
and the bot falls back to templates when the budget is gone.

### Where it runs

| | |
|---|---|
| Bot | laptop right now; EC2 `repli-bot-prod` (t3.small, Mumbai) is provisioned with Node 22, Chrome and pm2 |
| Panel | `repli-admin.vercel.app` |
| Database | Supabase |

---

## 8. Still open

- **Bag stock is 0**, so the Bags category is hidden from customers. The
  catalogue and its picture are ready; the owner sets the counts in the panel.
- **Payment QR** — the bot sends a UPI id as text. The sales memory asks for
  the official scanner image.
- **Payment proofs** are written to the bot's disk, so the panel cannot show
  them when the two run on different machines. Supabase Storage would fix it.
- **Panel gaps**: categories cannot be added or edited from the UI yet
  (products can).
- **The allowlist is on.** Clear `allowed_numbers` to open the shop to
  everyone.
- The audit produced about twenty smaller findings beyond those in §5. The
  ones that cost orders are fixed; the rest are not.

---

## 9. Phases 1–6: cache, invalidation, AI cost, storage

Six phases of work after §8, each measured rather than asserted. The bot's
behaviour toward a customer is unchanged except where noted; what changed is
what it costs and how quickly the panel reaches it.

### Phase 1 — one cache, actually shared

`src/db/cache.js` existed but had a single consumer. Now every read goes

```
L1 memory (≤5s) → Redis → Supabase
```

with `rediss://` TLS, a 30-second backoff after a failure (a dead Redis used
to cost three seconds on *every* reply), and a Buffer-based RESP parser -
the string-based one silently truncated any cached value containing a rupee
sign or an emoji.

Catalogue and stock were split: `repli:catalogue` holds the product rows,
`repli:stock:{productId}` holds one product's variants. They change at
different rates and cost different amounts when wrong.

### Phase 2 — the panel can say "that is stale"

`admin-panel/lib/cache.ts` publishes after every successful write; the bot
listens on Redis pub/sub (its own connection) and, always, polls
`cache_invalidations` on the same three-second rhythm as the outbox. Both
run at once; applying the same invalidation twice is free.

A price changed in the panel now reaches the bot in well under a second
instead of waiting out a timer.

### Phase 3 — one AI call where there were three

`src/ai/converse.js` reads the message and writes the reply in a single
call. Every rule check still runs first, so a message the rules understand
costs nothing, and everything the model returns is validated whole against
the live catalogue - a design it was never shown is thrown away, never
repaired.

`ai_usage` gained `latency_ms` and `fallback_reason`, and each call site now
logs its real purpose. That is what caught the first bug this made visible:
converse was rejecting 100% of answers because the prompt named the intent
list without showing it, and the model invented its own names.

Privacy: `src/ai/redact.js`. An address in the transcript becomes
"(shared their delivery details)"; phone numbers, UPI ids and PIN codes are
stripped; `known` carries flags, not values.

Measured: **2.3 → 0.79 AI calls per outgoing message.**

### Phase 4 — only the facts this turn needs

`context.forTurn()` replaced the whole-shop block. A size question now
carries 28 tokens of facts instead of 391, and the colour list dropped from
25 to 2. Measured: **converse 1073 → 431 input tokens**, p95 latency 2152 →
1058 ms.

The owner's AI instructions moved onto the shared cache, so a panel edit
takes effect on the next message rather than up to thirty seconds later.

### Phase 5 — pictures, alternatives, and honest TTLs

`products.image_path` / `product_variants.image_path`; a photo request is a
rule-path topic, so "photo bhej do" costs zero AI calls. No photo is a fact:
the bot says so rather than sending a different product.

`alternativesFor()` answers "XL nahi hai" with live variant rows, ordered
smallest-change-first, capped at three.

TTLs were raised only where a panel write publishes an invalidation:
catalogue, categories and templates to 300s. Stock stayed at 15s, and
settings, FAQ, bypass and admin lists stayed short because their
invalidation coverage is partial or absent.

### Phase 6 — the two halves share a filing cabinet

The panel is on Vercel and the bot is on a server, so neither can see the
other's disk. A private Supabase Storage bucket is the one place both have
credentials for.

Stored files are recorded as `storage:bucket/key`, never a URL. That is the
whole security story: `imageFor()` still refuses anything that is not a
local file under the bot's own root, and a reference is validated
character-by-character, downloaded with the shop's own credentials, and
cached to a local file before WhatsApp ever sees it.

- **Product and variant photos** can be uploaded from the panel. Files are
  checked by magic number, not by the name the browser sent; SVG is refused.
  The new file is uploaded, then the row is written, then the old file is
  deleted - so a failure never leaves a row pointing at nothing.
- **Payment proofs** now go to the bucket as well as to disk, so "View
  proof" works from Vercel. `payments.proof_url` still means exactly what it
  always meant - a path on the bot - and the new reference lives in
  `proof_object` beside it. Proofs recorded before migration 017 open
  unchanged.
- **Category editor**: create, update, deactivate. The key is immutable
  because `products.category` points at it. Every write invalidates.
- **Payment QR**: `app_settings.payment_qr` holds a storage reference. The
  UPI id in the payment message is untouched and remains the fallback.

### Where the tests stand

```
npm test              43   end to end, against the real database
npm run test:ai       19   AI guard rails
npm run test:cache    16   memory / Redis / TLS / backoff / recovery
npm run test:invalidate 15 panel -> bot, both transports
npm run test:converse 35   schema validation, redaction, the ledger
npm run test:context  17   scoped context and the instructions cache
npm run test:catalogue 24  images, alternatives, TTLs, empty replies
npm run test:storage  27   storage references, categories, QR, proofs
                     ---
                     196
```

### Migrations added

`014_cache_invalidations` · `015_ai_usage_detail` · `016_product_images` ·
`017_proof_object`. All additive: no drop, no rename, no data rewrite.

---

## 10. Phases 7–9: the panel catches up, and what the bucket actually says

### Phase 7 — the controls the owner needs

Phase 6 built every server path for product photos, the payment QR and the
category editor, and shipped none of the UI. Phase 7 added it: one reusable
`ImageUpload` control used by the product form, the variant form and the
settings page, plus a Categories page and its table.

Deliberate limits, because the backend has them:

- The picker only appears on a **saved** row - the upload endpoint is keyed
  by id, so there is nowhere to put a file before the row exists. Both forms
  now say so in words rather than leaving it to be discovered.
- A category **key cannot be renamed** (every product's `category` points at
  it) and a category is **hidden, never deleted**. The UI offers neither.
- The browser never sees a `storage:` reference. Previews are five-minute
  signed URLs generated server-side behind `requireAdminApi()`.

### Phase 8 — lifecycle, backfill, category pictures

- **Download cache eviction.** Age (7 days) then size (200 MB, oldest first),
  both env-tunable. Not a timer: it runs at most hourly on the back of a
  download that was already happening, so there is no lifecycle to leak. It
  never throws - nothing in the cache is precious, because every file can be
  fetched again.
- **`scripts/backfill-proofs.js`.** Copies pre-017 payment screenshots into
  the bucket so the panel can show them. It only ever ADDS `proof_object`;
  `proof_url` is never touched, no local file is ever deleted, already-done
  rows are filtered out in SQL, and a failed database write removes the
  object it just uploaded. Idempotent - the second run finds nothing to do.
- **Category images.** `product_categories.image_path` and the bot's
  `imageOf()` already existed; the panel route, the picker and the bot's
  `resolveImage()` did not. A category image invalidates only
  `repli:categories` - a catalogue card does not stale the product list.

### Phase 9 — what the bucket actually says

The bucket was audited against the code rather than assumed, and it found a
real defect nobody would have noticed:

**`image/jpg` uploads were being refused.** That is not a registered type -
the real one is `image/jpeg` - but it is what a great many phones and
WhatsApp clients label a screenshot. Supabase checks the label against the
bucket's allowed list, so an ordinary JPEG payment proof was rejected: the
file stayed on the bot's disk, the admin still received it on WhatsApp, and
the panel quietly could not show it. Nothing failed loudly, which is exactly
why it survived three phases.

Fixed in code, not in configuration: `storage.js` now normalises known
aliases (`image/jpg`, `image/pjpeg`, `image/x-png`) before upload. A type the
bucket genuinely does not allow is left alone and allowed to fail - GIF is
still refused, and a GIF proof stays local-only by design.

Verified live: bucket is **private**, an unauthenticated public URL returns
400, the 5 MB cap matches the code exactly, and every type the panel offers
is a type the bucket accepts. All four are now assertions in the suite, so
configuration drift is caught rather than discovered.

### A note on verification levels

This repo has **no browser or end-to-end runner** - no Playwright, no
Cypress, no Testing Library - and none was installed. So the panel's UI is
verified at three levels, and it is worth being precise about which is which:

| Level | Covers |
|---|---|
| **Static** | The UI calls routes that exist; it offers only file types the server accepts; it shares the same size cap; it never handles a `storage:` reference; it cannot offer a rename or delete the backend refuses |
| **Type / build** | `tsc --noEmit` clean and `next build` compiles, with every new page and route in the manifest |
| **Server runtime** | Upload, download, signed URL, sweep, invalidation and validation all executed against real Supabase Storage |

**No button has been clicked in a browser.** The pipeline beneath the click
is proven; the click itself is not.

### Where the tests stand

```
npm test               43   end to end, against the real database
npm run test:ai        19   AI guard rails
npm run test:cache     16   memory / Redis / TLS / backoff / recovery
npm run test:invalidate 15  panel -> bot, both transports
npm run test:converse  35   schema validation, redaction, the ledger
npm run test:context   17   scoped context and the instructions cache
npm run test:catalogue 24   images, alternatives, TTLs, empty replies
npm run test:storage   50   references, bucket audit, cache, backfill, categories
npm run test:panel     25   UI -> backend contracts (static)
                      ---
                      244
```
