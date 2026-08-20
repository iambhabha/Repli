-- =====================================================================
-- 011 - reword the sales flow to match the business memory
--
-- 008 seeded `message_templates` and 010 changed what the shop sells, so
-- some stored wording is now wrong: it leads with price, asks for a
-- quantity that no longer exists, and talks about paying a total that is
-- really a booking.
--
-- Rows the owner has edited are left alone. Only rows still identical to
-- their seeded default are refreshed, which is the difference between
-- fixing stale defaults and overwriting someone's work.
--
-- The new wording itself lives in src/bot/templates.js; this file exists so
-- that a database seeded before today catches up.
-- =====================================================================

-- Rows that no longer exist as defaults anywhere: the quantity step is gone
-- (a booking reserves one piece of one size), so its prompts would only
-- confuse whoever opens the panel.
update message_templates
   set description = '(unused) The quantity step was removed - a booking reserves one piece.'
 where key in ('quantityPrompt', 'quantityNotUnderstood', 'quantityTooHigh', 'onlyNAvailable');

-- ---- welcome: options first, never price ----------------------------

update message_templates
   set body = 'Sure! 😊 Abhi ye available hai:

{{products}}

Kaunsa chahiye?',
       default_body = body
 where key = 'welcome' and language = 'hi' and body = default_body;

update message_templates
   set body = 'Sure! 😊 We currently have:

{{products}}

Which one would you like?',
       default_body = body
 where key = 'welcome' and language = 'en' and body = default_body;

-- ---- after size: price appears for the first time, with the split ----

update message_templates
   set body = '{{item}} — done ✅

{{price}} total
{{booking}} abhi, size reserve karne ke liye
{{remaining}} baad me, jab piece ready ho jaye',
       default_body = body,
       placeholders = array['item', 'price', 'booking', 'remaining']
 where key = 'available' and language = 'hi' and body = default_body;

update message_templates
   set body = '{{item}} — done ✅

{{price}} total
{{booking}} now, to reserve your size
{{remaining}} once the piece is ready',
       default_body = body,
       placeholders = array['item', 'price', 'booking', 'remaining']
 where key = 'available' and language = 'en' and body = default_body;

-- ---- payment: a booking, not a total --------------------------------

update message_templates
   set body = 'Booking #{{orderId}} 🙌

Abhi dena hai: {{booking}}
Baaki {{remaining}} tab, jab piece ready ho jaye.

{{link}}

Payment ke baad screenshot yahin bhej dena — verify karke booking confirm kar dunga.',
       default_body = body,
       placeholders = array['orderId', 'total', 'booking', 'remaining', 'link']
 where key = 'paymentInstructions' and language = 'hi' and body = default_body;

update message_templates
   set body = 'Booking #{{orderId}} 🙌

To pay now: {{booking}}
The remaining {{remaining}} once your piece is ready.

{{link}}

Send the screenshot here after paying — I''ll verify it and confirm your booking.',
       default_body = body,
       placeholders = array['orderId', 'total', 'booking', 'remaining', 'link']
 where key = 'paymentInstructions' and language = 'en' and body = default_body;
