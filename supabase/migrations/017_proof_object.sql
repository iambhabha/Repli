-- =====================================================================
-- 017 - Where the panel can find a payment screenshot
--
-- `payments.proof_url` means, and has always meant, "a path on the bot's
-- own disk". The panel is on Vercel, so that path names a file it cannot
-- see - which is why "View proof" has been answering "open the panel on the
-- computer running the bot" ever since it was written.
--
-- The fix is a second column, not a redefinition of the first. Changing
-- what proof_url means would have silently broken every proof recorded so
-- far, and the end-to-end test that asserts the file is on disk was right
-- to object.
--
--   proof_url     unchanged: relative path on the bot, e.g. data/proofs/…
--   proof_object  new: a reference to the shop's private bucket, e.g.
--                 storage:repli-media/proofs/REP-1039-1735910000.jpg
--
-- Both are optional and they are written together. Reading prefers the
-- object when it is there and falls back to the path, so old proofs keep
-- working exactly as they did.
-- =====================================================================

alter table payments add column if not exists proof_object text;

comment on column payments.proof_url is
  'Relative path on the bot machine. Still the primary copy: 0600, outside any web root.';

comment on column payments.proof_object is
  'storage:bucket/key in the shop''s private bucket, so the panel can show the proof from anywhere. Never a public URL.';
