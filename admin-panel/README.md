# Repli Admin Panel

The control center for the Repli WhatsApp bot: read every conversation, take
over from the bot, verify payments, manage products, stock and settings.

It is a Next.js (App Router) app that talks to the **same Supabase database the
bot uses**. There is no second copy of the data and no mock mode — change stock
here and the bot sells the new number on the next message.

```
        WhatsApp
            │
      Node.js bot  ──────┐
            │            │  outbound_messages queue
      Supabase Postgres  │
            │            │
   Next.js Admin Panel ──┘
            │
          Owner
```

---

## 1. Install dependencies

```bash
cd admin-panel
npm install
```

Node 20 or newer.

---

## 2. Configure Supabase

The panel needs the schema the bot already uses, plus two migrations that were
added for the panel:

| Migration | What it adds |
| --- | --- |
| `supabase/migrations/006_admin_panel.sql` | `admin_users`, `admin_actions`, `outbound_messages`, `conversations.last_read_at`, realtime publication |
| `supabase/migrations/007_admin_views.sql` | `admin_inbox` and `admin_customers` read models |

Apply them from the repository root:

```bash
cd ..
npm run migrate          # needs SUPABASE_DB_URL in the bot's .env
```

or paste each file into **Supabase → SQL Editor → Run**. Both are idempotent.

### Row Level Security

`004_rls.sql` enables RLS with no policies on every table, so `anon` and
`authenticated` can read nothing. That is deliberate and the panel does not
loosen it: **all data access happens on the server with the secret key**, behind
an admin check. The browser only ever holds an auth session.

---

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable key — login session only |
| `SUPABASE_SECRET_KEY` | yes | Service-role key. **Server only**, never `NEXT_PUBLIC_` |
| `REPLI_API_URL` | no | HTTP bridge to a running bot; empty = use the outbox queue |
| `REPLI_API_KEY` | no | Shared secret sent as `x-repli-key` when the bridge is used |
| `REPLI_ROOT` | no | Path to the bot's folder, so payment screenshots can be viewed |
| `REPLI_PROOFS_BUCKET` | no | Private Storage bucket, if you move proofs off disk |

---

## 4. Run locally

```bash
npm run dev
```

<http://localhost:3000/admin/login>

---

## 5. Create an admin account

Two things must line up: a Supabase Auth user (the password) **and** an active
row in `admin_users` (the allowlist the server checks on every request). One
command does both:

```bash
npm run create-admin -- --email owner@example.com --password "a-strong-password" --name "Owner" --phone 919999999999
```

`--phone` is optional; when set it is recorded as `verified_by` on payments, so
the audit trail matches the WhatsApp `/paid` flow.

Re-running the command resets the password and reactivates the account.
Somebody who signs up in Supabase without an `admin_users` row sees nothing.

---

## 6. Start the development server

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # strict TypeScript, no emit
```

For replies sent from the panel to actually reach WhatsApp, the bot must be
running too (in the repository root):

```bash
npm start          # real WhatsApp
npm run mock       # terminal simulator
```

---

## 7. Build for production

```bash
npm run build
npm run start
```

---

## 8. Deploy to Vercel

1. Push the repository to GitHub.
2. **New Project → Import**, and set **Root Directory** to `admin-panel`.
3. Add the environment variables from step 3 (`SUPABASE_SECRET_KEY` as a plain
   environment variable — it is never exposed to the browser).
4. Deploy.

The panel is fully server-rendered and needs no extra Vercel configuration.

Two notes for a Vercel deployment:

- **Outgoing messages.** Vercel cannot reach a laptop running WhatsApp, so
  leave `REPLI_API_URL` empty. Replies are written to `outbound_messages` and
  the bot's outbox worker sends them the moment it is online. The Settings page
  shows how many are waiting.
- **Payment proofs.** The bot stores screenshots on its own disk
  (`data/proofs/`, mode 0600) and saves only the path. From Vercel there is no
  disk to read, so "View proof" explains that instead of showing a broken
  image. Run the panel on the same machine as the bot (set `REPLI_ROOT`), or
  move proofs to a private Storage bucket and set `REPLI_PROOFS_BUCKET`.

---

## Design system

The panel is a **shadcn/ui** project: Tailwind CSS v4, TypeScript, React Server
Components, `components.json` at the root with the standard aliases.

```
components/ui/      shadcn primitives — button, input, label, checkbox, form,
                    card, login (the split-screen auth screen)
components/ui/*.tsx (capitalised)  panel-specific pieces — Badge, Modal,
                    Pagination, Filters, States, Toast, PageHeader
components/admin/   feature components — Sidebar, ChatWindow, tables, forms
lib/utils.ts        the `cn` helper shadcn components import
app/globals.css     every design token, in one block
```

`/components/ui` is not a preference — it is where `npx shadcn@latest add …`
writes files and where every shadcn component expects to import its siblings
from (`@/components/ui/button`). Keeping that path means you can pull in any
component from the registry without editing imports:

```bash
npx shadcn@latest add dialog dropdown-menu select
```

### Monochrome, with one exception

The palette is greyscale: ink on paper, one black sidebar. The only colour in
the entire product is the **REPLI wordmark**, on the `--brand-mark` token —
which is why nothing else is allowed to use it. An accent that appears once
reads as identity; an accent that appears everywhere reads as noise.

Losing hue means status can no longer lean on red-vs-green, so it is carried by
**weight** instead, and every badge still spells out its label:

| State | Treatment |
| --- | --- |
| Confirmed / Verified / In stock | filled black, white text |
| Pending / Low stock | outlined |
| Rejected / Out of stock | double-struck outline, semibold |
| Cancelled / closed | grey, recedes |

That is also why it survives being read by someone who cannot separate two
hues: nothing here is carried by colour alone.

### Tokens, not colours

No component hard-codes a colour. Everything resolves to a CSS variable defined
once in `app/globals.css` — `bg-background`, `text-muted-foreground`,
`border-border`, `bg-primary`, plus a `sidebar-*` set, two chat surfaces and
`brand-mark`. Change a token there and the whole panel follows; a dark theme is
already defined under `.dark` and needs only a class on `<html>` to switch on.

One rule sits deliberately **outside** every `@layer`: the `:-webkit-autofill`
override. Chrome paints autofilled inputs pale blue, and the only way to
repaint them is a giant inset `box-shadow` — which Tailwind's `shadow-xs`
utility would otherwise win against, because layered styles lose to utilities.
Unlayered, it holds.

The shorthand classes used across the app (`.card`, `.btn-primary`, `.input`,
`.badge`, `.th`, `.td`) are thin aliases over those same tokens, declared with
`@utility` so Tailwind v4 can `@apply` them.

### Sidebar and command palette

`components/ui/dashboard-sidebar.tsx` is the navigation shell: a workspace
block at the top, grouped sections, collapsible children with indent guides,
badges and keyboard hints. `components/admin/Sidebar.tsx` feeds it Repli's
actual navigation.

Three things were adapted rather than copied, because the reference is a
mock and this one has to work:

- **Items are links, not ids.** `NavItemData.href` + `usePathname()` drive the
  active state, so navigation works with the keyboard, middle-click and
  browser history. Child links carry a querystring
  (`/admin/orders?status=PAYMENT_VERIFYING`) and only light up when that filter
  is really applied — which is also why every page stays a Server Component.
- **The workspace switcher is the shop.** It shows the business name with the
  live bot status underneath, and its menu is the account menu. There is only
  ever one workspace, so a fake switcher would have been decoration.
- **Sub-items are the filters the owner reaches for** — orders waiting on
  payment, customers in human mode, variants nearly out of stock — each one a
  real, shareable URL.

`⌘K` (`Ctrl+K`) opens `components/admin/CommandPalette.tsx`: pages, customers
and orders, searched through the same guarded API routes the pages use, with
arrow keys and Enter. The sidebar collapses from the topbar and the choice is
remembered in `localStorage`.

### Sign-in screen

`components/ui/login.tsx` is the split-screen form: fields on the left with
staggered framer-motion entrance, brand panel with a photograph on the right.
It is validated with zod through react-hook-form, and `onSubmit` may reject —
the message is shown above the button, because "incorrect email or password" is
the one thing this screen has to be able to say. Swap `imageSrc` in
`components/admin/LoginForm.tsx` for your own photo; the gradient underneath is
designed to stand on its own if the image is slow or blocked.

The "Keep me signed in" checkbox is real: unchecked writes a session cookie, so
closing the browser signs the owner out.

---

## How it fits together

### Data access

Every page is a Server Component that calls `lib/services/*`, which use the
service-role client. Client Components never query Supabase for business data —
they call the routes under `app/api/*`, and each of those re-checks the admin
session server-side.

### The important write

Verifying a payment calls `confirm_order_payment()`, the same database function
the WhatsApp `/paid` command uses. One transaction marks the payment VERIFIED,
confirms the order, decreases stock and switches the conversation to HUMAN, so
two admins tapping *Verify* at the same moment cannot double-count stock.

### Live updates

RLS blocks browser subscriptions by design, so the server subscribes to
Supabase Realtime with the secret key and relays thin events over SSE
(`/api/realtime/stream`). The payload is only *which table changed* — no
customer data crosses that wire. Pages refetch on the event, and fall back to
polling if the stream drops.

### Audit trail

Every action that touches money, stock or bot behaviour is written to
`admin_actions` with the admin's email. The last 15 are on the Settings page.

---

## Routes

| Page | What it does |
| --- | --- |
| `/admin/login` | Supabase Auth sign-in |
| `/admin/dashboard` | Counts, revenue, recent orders/customers/messages, pending payments |
| `/admin/messages` | WhatsApp-style inbox, chat, human takeover, reply |
| `/admin/customers` | CRM list, search, BOT/HUMAN filter |
| `/admin/customers/[id]` | Profile, stats, full chat history, orders, payments |
| `/admin/orders` | Table with status filters and search |
| `/admin/orders/[id]` | Line items, address, payment, verify/reject/cancel |
| `/admin/payments` | The verification queue, with proof viewer |
| `/admin/products` | Products and their variants |
| `/admin/stock` | Stock per variant, +/-, low-stock filter |
| `/admin/bypass` | Numbers the bot ignores completely |
| `/admin/settings` | Business settings, bot ON/OFF, outbox health, audit log |

### API

`GET /api/customers` · `GET /api/customers/:id` · `GET /api/customers/:id/messages` ·
`GET /api/messages` · `POST /api/messages/send` · `POST /api/messages/read` ·
`GET /api/orders` · `GET /api/orders/:id` · `POST /api/orders/:id/verify-payment` ·
`POST /api/orders/:id/reject-payment` · `POST /api/orders/:id/cancel` ·
`GET|POST /api/products` · `PUT /api/products/:id` · `POST /api/products/:id/variants` ·
`PUT|DELETE /api/variants/:id` · `GET /api/stock` · `PUT /api/stock/:variantId` ·
`GET /api/payments` · `GET /api/payments/:id/proof` ·
`POST /api/conversations/:id/takeover` · `POST /api/conversations/:id/resume` ·
`GET|POST /api/bypass` · `PUT|DELETE /api/bypass/:id` ·
`GET|PUT /api/settings` · `GET /api/notifications` · `GET /api/realtime/stream`

All of them require an active `admin_users` row; they answer `401` otherwise and
never return a stack trace.
