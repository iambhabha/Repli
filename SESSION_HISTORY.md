# Repli — what happened, in order

A record of the whole build session: what was asked, what was done, what
broke, and what I got wrong along the way. `BUILD_LOG.md` describes the
system as it stands; this is how it got there.

---

## 1. The admin panel

**Asked for:** a production Next.js admin panel on top of the existing bot —
App Router, TypeScript, Tailwind, Supabase Auth, no mock data, and without
breaking the WhatsApp side.

**Built:** login, dashboard, messages inbox with human takeover, customers,
orders, payments with proof viewer, products, stock, bypass numbers,
settings. Realtime, notifications, audit logs, pagination.

Two decisions shaped the rest of the work:

- **RLS denies anon and authenticated on every table.** So every read and
  write in the panel happens on the server behind an admin check, using the
  service-role key. The browser never gets a key that can read anything.
- **An outbox queue.** The panel can be on Vercel and the bot on a laptop, so
  a reply typed in the panel is written to `outbound_messages` and the bot
  drains it. Nothing is lost if the bot is offline.

Along the way: a Supabase Realtime relay over SSE (the browser cannot
subscribe directly under deny-all RLS), and views with `security_invoker`.

---

## 2. The look

**Asked for:** a supplied shadcn split-screen login, applied to the whole
app; then everything black and white with the REPLI wordmark in red; then a
supplied sidebar component.

Done. Two things that took longer than they should have:

- The login field looked wrong — it was Chrome's autofill styling, not the
  CSS. Fixed with a `-webkit-autofill` override that had to sit **outside**
  every `@layer`, because `shadow-xs` in the utilities layer was winning.
- Tailwind v4 does not allow `@apply btn` inside `@layer components`; the
  button bases moved to `@utility`.

---

## 3. The WhatsApp driver had to be replaced

The bot used `@open-wa/wa-automate`. It stopped connecting — it waits for
`window.Debug.VERSION`, which current WhatsApp Web no longer exposes, and
the library has had no release since.

**Swapped to `whatsapp-web.js`.** One new driver file, no business logic
changed — which is what the adapter was built for.

### The LID bug

The most serious defect of the session. WhatsApp now addresses some senders
by a LID (`…@lid`) rather than a phone number. The new driver was treating
the LID as a phone number, which meant:

- replies went nowhere
- junk customer rows appeared
- **the bypass list stopped working** — the owner's own family numbers were
  being answered by the bot

Fixed with a LID→phone lookup that **fails closed**: if the real number
cannot be resolved, the message is dropped rather than guessed at. Silence is
always the safe outcome when the bypass list is what is at stake.

I also claimed at one point to have stopped my test bot when only the npm
wrapper had died and the child process still held the session. Killed by PID
after that.

---

## 4. Language, and editable messages

**Asked for:** reply in Hinglish if the customer writes Hinglish, English if
English. And: *"main apne aap isko change kar sakun — har language main."*

- **Language**: word lists first (free, instant, never wrong about
  "chahiye"), sticky per conversation so it cannot flip mid-chat on "ok".
- **Templates**: all 44 customer-facing messages moved into
  `message_templates`, editable in the panel in both languages, synced to the
  bot every fifteen seconds. Seeding is insert-only, so a wording the owner
  chose survives a deploy.

---

## 5. Deployment

- **Vercel**, twice: `repli-panel`, then `repli-admin` for the client account.
  The first build failed because `lib/env.ts` threw at import time during
  "Collecting page data"; env validation became lazy.
- **AWS EC2** — launched `repli-bot-prod` in Mumbai: Ubuntu, t3.small (1 GiB
  cannot run Chromium and Node reliably), 20 GiB, SSH restricted to the
  owner's IP. Then Node 22, Google Chrome, 2 GiB swap, pm2 with boot
  persistence.
- **Termius** — I could not click inside the desktop app, so `~/.ssh/config`
  got a `repli` entry to import instead.

Two things bit us: stopping the instance released its public IP, and the
owner's own ISP address changed — locking SSH out. The security group now
allows their ISP range rather than a single address.

---

## 6. Linking WhatsApp — where I wasted the most time

Getting the bot linked took far longer than it should have, and most of the
delay was mine.

- I pasted QR codes into chat. A QR lives about a minute; by the time it was
  read it was dead.
- I switched to pairing codes and then **restarted the bot to generate a new
  one while the previous login was still completing** — which killed the
  login. Repeatedly. The logs showed `authenticated` then `LOGOUT` thirteen
  seconds later, and I read the crash before I read my own restarts.
- Too many link attempts got the number temporarily blocked by WhatsApp
  (`pairing code error "t"`, then "can't link new device").

What actually worked: stop touching it, clear the dead session, one QR, scan,
wait. The bot has stayed linked since.

---

## 7. OpenAI

**Asked for:** *"lagna chahiye ki real human baat kar raha hai"* — within
₹1,000 a month, for 500 users.

The maths came first: `gpt-4o-mini` at roughly ₹0.008 a message is about
₹40/month at that volume; a full-size model would be ₹3,000. The mini model
was the obvious choice, with a hard fuse on top.

What the AI was given, and deliberately not given:

| It does | It does not |
|---|---|
| reword replies | choose a price |
| read messages the parser cannot | choose stock |
| detect the language | create an order |
| answer when the script runs out | decide a refund |

Every rewrite is checked before sending: numbers preserved, no new numbers,
links byte-identical, questions stay questions, form labels stay on their own
lines. A failed check sends the template instead.

`ai_usage` records every call; the monthly budget is checked before each
request and the bot falls back to templates when it is spent.

---

## 8. The business spec arrived

A PDF — the shop's own sales memory for **AESTHURA & 3POINTER.CLUB**. It
changed the product entirely:

- Spider-Man and Venom T-shirts at ₹2,499, **₹500 books a size**, ₹1,999 when
  the piece is ready
- BAPE hoodies, made to order
- **never lead with price** — options first, price after design and size
- fixed answers for material, wait time, COD, pickup
- never invent anything

The catalogue, the flow and the templates were rebuilt around it. The
quantity step was removed (a booking reserves one size), a category step was
added, and the 38 existing tests — which encoded the old business — were
rewritten to encode the new one.

Later the bags catalogue arrived as an image: Nike Elite backpacks, ₹2,499,
24 colours. Added as one product with a colour per variant, and the image
itself is now sent to customers, because 24 colour names as text is a wall.

**What I refused to invent:** bag prices before that image existed, stock
counts, and a payment QR. Those were listed as open rather than guessed.

---

## 9. Everything dynamic

**Asked for:** *"static kuch nahi hona chahiye, sab kuch dynamic."*

Moved out of code and into the database: categories and the words customers
use for them, per-product keywords, the shop's name, lead times, material,
pickup city, the brand list. Adding "Caps" to the shop is now a row, and the
bot understands "cap" and "topi" the moment it exists.

The panel's product form grew the fields to match — brand, category, booking
amount, COD, made-to-order, and the customer keywords.

---

## 10. Live testing, and what real customers broke

Watching the live logs was worth more than any amount of reading.

A real transcript with one customer was, fairly described, bad: `"Yeh kya h"`
got a menu, `"Reffund"` got a menu, the same address prompt went out twelve
times, the customer pasted the bot's own message back and it was **stored as
their delivery address**, and `"Ai automation"` became their name.

That transcript produced most of §5 of `BUILD_LOG.md`. The headline fixes:

- when the script has nothing to say, the model now writes the reply — given
  the shop's facts, the phase, and the transcript
- three failed attempts on the same step hands over to a person
- a greeting mid-order is answered as a greeting, without losing the order
- an echo of our own message is ignored
- validators that reject a bot prompt as an address, `000000` as a PIN, and a
  sentence as a city

Separately, the live logs showed the bot greeting **AstroTalk and CRED
broadcasts** as if they were customers, paying for AI calls to do it. First
messages that are a link or a paragraph are now ignored.

---

## 11. The audit

Four agents read the code independently — hardcoded facts, AI context gaps,
phrasing failures, panel gaps — and every finding was verified by a second
agent before it counted. Twenty-eight survived.

The worst of them were things no amount of happy-path testing would have
found:

- `"haan bhej do na"` was read as **no**, because `na` sits in the no-word
  list and Hinglish hangs it on the end of agreements. Every confirmation
  ending that way cancelled the order.
- A menu number was resolved against the whole catalogue rather than the list
  the customer was looking at — pick Hoodies, type `1`, get a T-shirt.
- `"aane se pehle call karo"` in an address was read as "I want a human" and
  silenced the bot permanently.
- `"haan bhai deliver kar do"` at the summary was answered with the shop's
  address, and the YES never reached order creation.
- The panel's revenue figure counted ₹2,499 for every ₹500 booking.

All fixed, each with a test.

---

## 12. Speed

Measured before touching anything: 10–24 Supabase round trips per message,
1.7–6.6 seconds a reply, of which the database was about 45%.

The conversation row was being fetched four to six times per message by
different parts of the code. Cached for two seconds, written through on save;
same for the customer row; bookkeeping writes moved off the reply path;
settings cached for thirty seconds.

Result: 5–8 calls per message, typical replies at 1.3–1.5s. What remains is
OpenAI thinking.

Redis was asked for and is wired (`REDIS_URL`), with an in-process map as the
default. The honest note in the code: for a single bot process the map is
faster, because Redis is also a network hop. Redis earns its place with
multiple processes or panel-driven invalidation.

---

## 13. Making it sound like a conversation

The last change. Until then the rewriter saw one isolated line, so it wrote
like a form letter — greeting someone mid-order, re-asking what had just been
answered.

It now receives the phase, what the customer has already told us, and the last
few turns, and is told plainly: say what the reply says, nothing more, and
never ask again for something already given.

Customer details are also written to the database as they arrive rather than
only when the form completes, so a conversation that stops halfway still
leaves the shop what it was given.

---

## What I got wrong

Worth writing down, because most of the lost time is here.

- **Restarting the bot mid-login, repeatedly**, then diagnosing the crash it
  caused instead of my own restarts.
- **Pasting QR codes into chat** long after it was clear they expire before
  they arrive.
- **Over-building the name step**: WhatsApp gives a profile name, so I built
  a confirmation question around it — when what was asked for was simply to
  take the name with the address. Removed.
- **Guessing at what "the bot number" was**, twice, and generating pairing
  codes for a number that was never going to receive them.
- **Leaving `AESTHURA` hardcoded** in the AI prompt after being told twice
  that nothing should be static.

---

## Where it stands

Bot linked and running with the AI layer, the full 3POINTER.CLUB and AESTHURA
catalogue, an admin panel on Vercel, and an EC2 box provisioned and waiting.

Tests: 43 end-to-end, 19 AI guard rails, 61 live-rehearsal checks, 22 phrasing
cases. All passing.

Open items are listed at the end of `BUILD_LOG.md` — bag stock, the payment
QR, proof storage, panel category editing, and the allowlist that currently
restricts the bot to one test number.

---

## 14. Six phases, one at a time

After the sections above, the work was restructured into numbered phases,
each with a baseline, an implementation and a measured report. The rule
throughout: no claim without a number behind it, and no existing test
weakened to make a new one pass.

**Phase 1 — Redis.** The cache module had exactly one consumer. Routing the
six real caches through it turned up two latent bugs worth more than the
feature: `rediss://` was parsed and then ignored, so every managed Redis
would have failed at the handshake, and the RESP parser treated a bulk
string's byte length as a JS string length - quietly truncating any cached
value with a rupee sign or an emoji in it. Both were found by writing the
tests, not by reading the code.

**Phase 2 — invalidation.** Two transports, because the shop has no Redis
provisioned yet and the fallback is what will actually run: pub/sub when
`REDIS_URL` is set, and a `cache_invalidations` table polled on the same
rhythm as the existing outbox when it is not. The audit log was considered
as a transport and rejected - its entity ids are the wrong ones, and making
cache correctness depend on logging means a change to logging silently
breaks prices.

**Phase 3 — one AI call.** The entry branch was making up to three: read the
intent, pick the product, compose a reply. `converse.js` does all of it
once. The observability went in first, deliberately - and immediately earned
itself: the first live converse calls were rejected 100% of the time because
the prompt said "one of the INTENTS list" without ever listing them, and the
model invented `check_product_availability`. The validation was working
exactly as designed; the prompt was incomplete.

Also found: `adapter.replyContext()` had been building `known` and `history`
on every single outgoing message - an extra query each time - and `humanise`
never used either. The context existed and was not plugged in.

**Phase 4 — scoped context.** The whole shop was going to the model on every
call: 391 tokens of facts including hoodie lead times and all 24 colours of
a sold-out backpack, for a customer asking about a size. `forTurn()` sends
what the turn is about. 1073 → 431 input tokens.

The ~150-token target was not reached and the report said so: the system
prompt is 71% of what remains, and every line of it is either a safety rule
or an enum the model demonstrably invents without.

**Phase 5 — pictures and alternatives.** The image transport already existed
and was left alone. What was missing was the data: two columns, a rule-path
topic so "photo bhej do" costs nothing, and `alternativesFor()` so an
out-of-stock answer names real rows instead of a guess. TTLs were raised
only for the three domains a panel write actually publishes for; the report
lists the five that were left short and why.

**Phase 6 — storage.** The panel on Vercel and the bot on a server could
never hand each other a file, which is why the owner could not add a product
photo and why "View proof" said "open the panel on the computer running the
bot".

The design constraint was real and worth stating: the bot sends images by
local path and `imageFor()` refuses URLs on purpose. So stored files are
references, not links - validated, downloaded with the shop's own
credentials, cached to a local file. `imageFor()` was not touched.

Halfway through, test 22 failed. It asserts the proof file exists on disk
under the bot's root, and moving the reference into `proof_url` had broken
that. The test was right: `proof_url` has a meaning and I was changing it
silently. The fix was an additive column, not an edited assertion.

### What I got wrong in these phases

- **Changed a column's meaning without noticing.** `proof_url` had a
  contract and an end-to-end test enforcing it. Caught by the test, fixed
  with a second column.
- **Named a list without showing it.** The converse prompt referred to
  "the INTENTS list" and never included it. 100% rejection until the
  observability made it visible.
- **Wrote two assertions that measured the wrong thing** - a fixture passing
  category rows where keys were expected, and an ordering check that matched
  an import line instead of the usage. Both were test bugs; both were fixed
  rather than worked around.

---

## 15. Phases 7–9: shipping the panel, and auditing what was assumed

**Phase 7 — the UI Phase 6 owed.** Phase 6 had built every server path for
product photos, the QR and categories and shipped no controls at all, which
is the difference between "works" and "the owner can use it". One reusable
picker, a Categories page, and two-step hints saying plainly that a photo
comes after the first save.

The interesting part was what the UI is *not* allowed to offer. The backend
cannot rename a category key (products point at it) and cannot delete a
category (same reason). So the key input is disabled when editing and the
button says "Hide", not "Delete" - and there is now a test asserting the UI
does not promise either.

**Phase 8 — the boring, necessary things.** Cache eviction that is not a
timer. A backfill script that only adds a column. Category images wired end
to end. Each small; together they are the difference between a feature and a
feature you can leave running.

The backfill is the one I would defend hardest. It would have been easy to
make it "move" proofs - upload, update, delete the local file. It does not
delete anything, does not touch `proof_url`, and skips rows already done in
SQL rather than in JavaScript. Run it twice and the second run finds nothing.
That is what made it safe to actually run against the live database, which I
did: one pre-017 proof, uploaded, `proof_url` byte-identical afterwards.

**Phase 9 — auditing the thing nobody audits.** The bucket had been created
by a probe script in Phase 6 and trusted ever since. Reading it back against
the code found a defect that had survived three phases:

`image/jpg` uploads were being refused. It is not a real IANA type - the
registered one is `image/jpeg` - but it is what a great many phones label a
screenshot, and Supabase checks the label against the bucket's allowed list.
So an ordinary JPEG payment proof was rejected, the file stayed on disk, the
admin still got it on WhatsApp, and the panel quietly could not show it.

Nothing failed loudly. That is the entire reason it lasted: every layer
degraded gracefully, and graceful degradation is how a broken feature looks
exactly like a working one.

The fix was in code rather than configuration - normalise the aliases before
upload - and deliberately narrow: a GIF is still refused, because relabelling
a GIF as a PNG to get it past a limit is the kind of cleverness that becomes
somebody else's bug. The bucket's real state (private, 5 MB, three image
types plus PDF) is now asserted in the suite, so the next drift is caught
rather than discovered.

### The verification honesty note

There is still no browser runner in this repo, and I did not install one -
that is a dependency decision, not a testing one. So every claim about the
panel's UI is either static (source contracts), type/build (tsc and
`next build`), or server-runtime (real Supabase Storage). No button has been
clicked. Said in the report every time, because a green line that reads like
a browser test and is not one is worse than no test at all.

### What I got wrong in these phases

- **Trusted a bucket I created with a throwaway probe.** Three phases of
  storage work sat on a configuration nobody had read back. The audit should
  have been Phase 6, not Phase 9.
- **Assumed `image/jpeg` was what arrives.** It frequently is not.
