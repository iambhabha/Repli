'use strict';

/**
 * Files the shop owns, kept where both halves of it can reach them.
 *
 * The panel runs on Vercel and the bot runs on a server. Neither can see the
 * other's disk, which is why the owner could never add a product photo from
 * the panel and why a payment screenshot taken by the bot could not be viewed
 * from one. Supabase Storage is the one place both already have credentials
 * for, so it is the one place a file can be handed between them.
 *
 * A stored file is recorded in the database as a reference, never a URL:
 *
 *   storage:repli-media/products/TS001-1735910000.png
 *
 * That distinction is the whole security story. A URL in a database column is
 * a URL the bot would eventually be asked to fetch and send to a customer; a
 * reference names a bucket the shop owns and an object key that is validated
 * character by character before anything is downloaded. `imageFor()` in
 * productService still refuses anything that looks like a URL, and it always
 * will - this module never produces one.
 *
 * Downloads land in a cache directory under the bot's own root, so what is
 * finally handed to WhatsApp is a local path exactly as it always was.
 */

const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabase');
const config = require('../config');
const logger = require('../logger');

/** The prefix that marks a value as "an object we own", not a path or a link. */
const PREFIX = 'storage:';

/**
 * Deliberately narrow. Object keys are built by this codebase, so anything
 * outside this alphabet is a value that came from somewhere it should not
 * have - and `..`, backslashes and leading slashes are all excluded by it.
 */
const KEY_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const BUCKET_SHAPE = /^[a-z0-9][a-z0-9-]{1,62}$/;

const MIME_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Content types that are the same thing under a different name.
 *
 * A WhatsApp screenshot frequently arrives labelled `image/jpg`, which is not
 * a real IANA type - the registered one is `image/jpeg`. Supabase Storage
 * checks the label against the bucket's allowed list and rejects the upload,
 * so a perfectly ordinary JPEG payment proof was being refused: the file
 * stayed on the bot's disk, the admin still got it on WhatsApp, and the panel
 * quietly could not show it. Nothing broke loudly, which is what made it
 * worth finding.
 *
 * Only aliases go here. A type the bucket genuinely does not allow is left
 * alone and allowed to fail - relabelling a GIF as a PNG to sneak it past a
 * limit is exactly the sort of cleverness that turns into a bug later.
 */
const CONTENT_TYPE_ALIASES = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};

/**
 * What the bucket has to be for this code to work.
 *
 * Written down because it was not: the bucket was created by a probe script
 * and trusted for three phases, and the one thing nobody had read back -
 * its allowed content types - was quietly rejecting ordinary JPEG payment
 * proofs. Configuration that only exists in a dashboard is configuration
 * nobody reviews.
 *
 * `scripts/verify-storage.js` checks a live bucket against this, and
 * tests/storage.test.js asserts the same things, so drift is caught rather
 * than discovered.
 *
 * REQUIRED means the shop is broken without it. OPTIONAL means something
 * degrades gracefully - today only the panel's preview of a GIF proof, which
 * stays on the bot's disk and still reaches the admin on WhatsApp either way.
 */
const BUCKET_REQUIREMENTS = {
  /** A public bucket would expose every customer's payment screenshot. */
  mustBePrivate: true,

  /** The cap this code enforces before it ever calls Storage. */
  maxBytes: MAX_BYTES,

  /** Refuse any of these and something the shop does every day stops working. */
  requiredTypes: [
    'image/png',   // product photos, category cards, the payment QR
    'image/jpeg',  // the same, and almost every payment screenshot
    'image/webp',  // what newer phones produce
    'application/pdf', // a proof sent as a document
  ],

  /**
   * Nice to have. Without it a GIF proof is stored on disk and shown to the
   * admin, but cannot be opened from the panel. WhatsApp re-encodes animated
   * GIFs to video, so this is close to unreachable in practice - which is
   * why it is listed here rather than fixed by relabelling the file.
   */
  optionalTypes: ['image/gif'],
};

const normaliseContentType = (value) => {
  const type = String(value || '').toLowerCase().split(';')[0].trim();
  return CONTENT_TYPE_ALIASES[type] || type;
};

/**
 * How much disk the download cache may hold, and how old an entry may get.
 *
 * The cache is what lets one product photo go to a hundred customers without
 * a hundred downloads, so it has to keep things - but a bot that runs for a
 * year would otherwise keep every picture of every product it ever deleted.
 * Nothing here is precious: every file can be fetched again from the bucket,
 * which is what makes eviction safe to do bluntly.
 */
const CACHE_MAX_BYTES = Math.max(0, Number(process.env.STORAGE_CACHE_MAX_BYTES) || 200 * 1024 * 1024);
const CACHE_MAX_AGE_MS = Math.max(0, Number(process.env.STORAGE_CACHE_MAX_AGE_MS) || 7 * 24 * 3600 * 1000);
const SWEEP_EVERY_MS = 60 * 60 * 1000;

const cacheDir = () => path.join(config.DATA_DIR, 'storage-cache');

let lastSweep = 0;

/**
 * Throw away what the cache no longer needs: anything older than the age
 * limit, then oldest-first until it fits the size limit.
 *
 * Deliberately not a timer. A timer is a lifecycle to start, stop and leak;
 * this runs at most once an hour, on the back of a download that was already
 * happening, and it can be called directly by a test.
 *
 * Never throws. A cache that cannot be tidied is untidy, not broken - the
 * next read still works, because a missing file is simply downloaded again.
 *
 * @returns {{removed: number, bytes: number, kept: number}|null}
 */
function sweepCache({ force = false, now = Date.now() } = {}) {
  if (!force && now - lastSweep < SWEEP_EVERY_MS) return null;
  lastSweep = now;

  const dir = cacheDir();
  const result = { removed: 0, bytes: 0, kept: 0 };

  try {
    if (!fs.existsSync(dir)) return result;

    const files = [];
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      try {
        const info = fs.statSync(full);
        if (info.isFile()) files.push({ full, size: info.size, mtimeMs: info.mtimeMs });
      } catch (err) {
        // Vanished between readdir and stat - another process got there
        // first, which is a perfectly good outcome.
      }
    }

    const drop = (file) => {
      try {
        fs.rmSync(file.full, { force: true });
        result.removed += 1;
        result.bytes += file.size;
        return true;
      } catch (err) {
        // Locked, or already gone. Leave it; the next sweep will try again.
        return false;
      }
    };

    const survivors = [];
    for (const file of files) {
      if (CACHE_MAX_AGE_MS && now - file.mtimeMs > CACHE_MAX_AGE_MS) {
        if (drop(file)) continue;
      }
      survivors.push(file);
    }

    // Oldest first, until what is left fits.
    survivors.sort((a, b) => a.mtimeMs - b.mtimeMs);
    let total = survivors.reduce((sum, file) => sum + file.size, 0);

    for (const file of survivors) {
      if (!CACHE_MAX_BYTES || total <= CACHE_MAX_BYTES) break;
      if (drop(file)) total -= file.size;
    }

    result.kept = survivors.length - result.removed;
    if (result.removed) {
      logger.info('storage.cache_swept', {
        action: `${result.removed} file(s)`,
        ms: result.bytes,
      });
    }
    return result;
  } catch (err) {
    logger.warn('storage.cache_sweep_failed', { error: String(err && err.message) });
    return result;
  }
}

const isReference = (value) => typeof value === 'string' && value.startsWith(PREFIX);

/**
 * Split a reference into a bucket and a key, or return null.
 *
 * Fails closed on everything: an unknown shape, a traversal attempt, an
 * empty half. A null here means "do not fetch anything", which is always a
 * safe answer - the caller says the shop has no picture.
 */
function parseReference(value) {
  if (!isReference(value)) return null;

  const body = value.slice(PREFIX.length);
  const slash = body.indexOf('/');
  if (slash <= 0) return null;

  const bucket = body.slice(0, slash);
  const key = body.slice(slash + 1);

  if (!BUCKET_SHAPE.test(bucket)) return null;
  if (!KEY_SHAPE.test(key)) return null;
  // Belt and braces: the alphabet above cannot express these, and they are
  // the two that matter, so they are checked anyway.
  if (key.includes('..') || key.startsWith('/')) return null;

  return { bucket, key };
}

const referenceFor = (bucket, key) => `${PREFIX}${bucket}/${key}`;

/** The bucket everything goes in, unless a caller says otherwise. */
const defaultBucket = () => config.STORAGE_BUCKET;

/**
 * Upload a buffer and return its reference.
 *
 * @returns {Promise<string|null>} `storage:bucket/key`, or null on any failure
 */
async function upload(key, buffer, { contentType = null, bucket = null } = {}) {
  const target = bucket || defaultBucket();
  if (!target || !BUCKET_SHAPE.test(target)) return null;
  if (!KEY_SHAPE.test(String(key || '')) || String(key).includes('..')) return null;
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_BYTES) return null;

  try {
    const { error } = await supabase.storage.from(target).upload(key, buffer, {
      contentType: normaliseContentType(contentType) || 'application/octet-stream',
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return referenceFor(target, key);
  } catch (err) {
    logger.warn('storage.upload_failed', { action: key, error: String(err && err.message) });
    return null;
  }
}

/**
 * Fetch a stored object and leave it on local disk, so the WhatsApp adapter
 * can send it the same way it sends everything else.
 *
 * Cached by reference: the same product photo goes to a hundred customers
 * without a hundred downloads. The cache lives under the bot's own root, so
 * every path rule that already applies to a local image still applies here.
 *
 * @returns {Promise<string|null>} an absolute local path, or null
 */
async function localCopy(value) {
  const parsed = parseReference(value);
  if (!parsed) return null;

  const dir = cacheDir();
  // The key is already validated, but the file name is flattened anyway so a
  // key can never create directories of its own.
  const flat = `${parsed.bucket}__${parsed.key}`.replace(/[^A-Za-z0-9._-]/g, '_');
  const absolute = path.join(dir, flat);

  // Never leave the cache directory, whatever the key turned into.
  if (path.relative(dir, absolute) !== flat) return null;

  if (fs.existsSync(absolute)) return absolute;

  try {
    const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.key);
    if (error) throw new Error(error.message);

    const buffer = Buffer.from(await data.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_BYTES) return null;

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absolute, buffer, { mode: 0o600 });
    logger.info('storage.cached', { action: parsed.key, ms: buffer.length });

    // On the back of a download that already happened, at most hourly, and
    // never able to fail the read that triggered it.
    sweepCache();
    return absolute;
  } catch (err) {
    logger.warn('storage.download_failed', {
      action: parsed.key,
      error: String(err && err.message),
    });
    return null;
  }
}

/** Delete an object, and the local copy of it. Never throws. */
async function remove(value) {
  const parsed = parseReference(value);
  if (!parsed) return false;

  try {
    const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.key]);
    if (error) throw new Error(error.message);
  } catch (err) {
    logger.warn('storage.remove_failed', { action: parsed.key, error: String(err && err.message) });
    return false;
  }

  const cached = path.join(
    cacheDir(),
    `${parsed.bucket}__${parsed.key}`.replace(/[^A-Za-z0-9._-]/g, '_')
  );
  fs.rmSync(cached, { force: true });
  return true;
}

/**
 * Is the bucket configured the way this code needs?
 *
 * Read only, and it never throws - it is called from startup, where a
 * Storage hiccup must not stop the shop selling. What it returns is a list
 * of sentences for the preflight warnings, exactly like the missing-admin
 * and missing-payment-link checks beside it.
 *
 * The same contract `scripts/verify-storage.js` checks, so a warning here
 * and a red line there always mean the same thing.
 *
 * @returns {Promise<string[]>} problems, empty when all is well
 */
async function checkBucket() {
  const problems = [];

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      return [
        `Storage could not be reached (${error.message}) - product photos and payment proofs will not appear in the panel.`,
      ];
    }

    const bucket = (buckets || []).find((b) => b.name === defaultBucket());
    if (!bucket) {
      return [
        `Storage bucket "${defaultBucket()}" does not exist - photos and payment proofs cannot be uploaded. Run: npm run verify:storage`,
      ];
    }

    if (bucket.public !== false) {
      problems.push(
        `Storage bucket "${bucket.name}" is PUBLIC - every payment screenshot in it is readable by anyone with the URL. Make it private.`
      );
    }

    if (bucket.file_size_limit && MAX_BYTES > bucket.file_size_limit) {
      problems.push(
        `Storage bucket caps uploads at ${bucket.file_size_limit} bytes but this code accepts ${MAX_BYTES} - larger files will be refused.`
      );
    }

    const allowed = bucket.allowed_mime_types;
    if (allowed) {
      const missing = BUCKET_REQUIREMENTS.requiredTypes.filter((type) => !allowed.includes(type));
      if (missing.length) {
        problems.push(
          `Storage bucket refuses ${missing.join(', ')} - the shop uses these every day. Run: npm run verify:storage`
        );
      }
    }
  } catch (err) {
    // A check that fails is a check that failed, not an outage.
    return [`Storage check could not run (${err && err.message}).`];
  }

  return problems;
}

module.exports = {
  PREFIX,
  MAX_BYTES,
  MIME_EXTENSION,
  isReference,
  parseReference,
  referenceFor,
  defaultBucket,
  upload,
  localCopy,
  remove,
  sweepCache,
  cacheDir,
  normaliseContentType,
  BUCKET_REQUIREMENTS,
  checkBucket,
};
