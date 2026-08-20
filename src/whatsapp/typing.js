'use strict';

/**
 * "typing…", for exactly as long as the shop is actually thinking.
 *
 * A reply takes a second or two - a database read, sometimes a model call,
 * always the guards. To the customer that is silence, and silence after you
 * have sent a message reads as "nobody is there". A real shopkeeper's phone
 * shows them typing while they type.
 *
 * Two things this deliberately does NOT do:
 *
 *   - it never adds a delay. The indicator lasts precisely as long as the
 *     work does; a fake pause to look busy is a lie told to a customer, and
 *     it costs them time.
 *   - it never decides when a reply is ready. It is told to start and told
 *     to stop by whoever owns the turn.
 *
 * Leases are reference counted per phone. Two overlapping pieces of work on
 * one conversation each hold a lease, and the indicator only clears when the
 * last one lets go - so a fast inner step can never switch off the typing
 * that a slower outer step still needs.
 *
 * Everything here swallows its own errors. A presence update is a courtesy;
 * a shop that cannot send one still has to be able to sell.
 */

const logger = require('../logger');

/**
 * WhatsApp forgets a typing state after roughly twenty-five seconds, so a
 * long turn has to say it again. Comfortably inside that, and cheap.
 */
const REFRESH_MS = 8000;

/**
 * A turn that somehow never ends must not leave a customer watching "typing…"
 * for ever. The lease gives up on its own well before that looks broken.
 */
const MAX_LEASE_MS = 90000;

function createTyping(driver) {
  /** phone -> { count, timer, expires } */
  const leases = new Map();

  const supported = () => typeof driver.setTyping === 'function';

  async function tell(phone, on) {
    if (!supported()) return false;
    try {
      await driver.setTyping(phone, on);
      return true;
    } catch (err) {
      // Not worth an error log: the reply itself is unaffected.
      logger.warn('typing.failed', { phone, action: on ? 'on' : 'off', error: err.message });
      return false;
    }
  }

  function stopTimer(lease) {
    if (lease && lease.timer) clearInterval(lease.timer);
    if (lease) lease.timer = null;
  }

  function forget(phone) {
    const lease = leases.get(phone);
    stopTimer(lease);
    leases.delete(phone);
  }

  return {
    /**
     * Start showing "typing…", or join a lease that is already showing it.
     * Safe to call for a phone that is already typing.
     */
    async begin(phone) {
      if (!phone || !supported()) return;

      const existing = leases.get(phone);
      if (existing) {
        existing.count += 1;
        return;
      }

      const lease = { count: 1, timer: null, expires: Date.now() + MAX_LEASE_MS };
      leases.set(phone, lease);

      await tell(phone, true);

      /**
       * Say it again periodically, because WhatsApp expires the state. The
       * timer is unref'd so it can never hold the process open, and it stops
       * itself if the turn has run past every reasonable bound.
       */
      lease.timer = setInterval(() => {
        if (Date.now() > lease.expires) {
          logger.warn('typing.lease_expired', { phone });
          void tell(phone, false);
          forget(phone);
          return;
        }
        void tell(phone, true);
      }, REFRESH_MS);

      if (lease.timer.unref) lease.timer.unref();
    },

    /**
     * Let go of one lease. The indicator clears when the last holder does.
     *
     * Never throws - this is called from a `finally`, and a failure here
     * must not replace whatever error is already on its way up.
     */
    async end(phone) {
      if (!phone || !supported()) return;

      const lease = leases.get(phone);
      if (!lease) return;

      lease.count -= 1;
      if (lease.count > 0) return;

      forget(phone);
      await tell(phone, false);
    },

    /**
     * Say it again, after something that clears it.
     *
     * Sending a message makes the client drop the indicator, so a turn that
     * sends two messages needs the second gap to look like the first. Does
     * nothing when no lease is held.
     */
    async refresh(phone) {
      if (!phone || !supported()) return;
      if (!leases.has(phone)) return;
      await tell(phone, true);
    },

    /** Drop everything - used on shutdown, and by tests. */
    async clearAll() {
      const phones = [...leases.keys()];
      for (const phone of phones) {
        forget(phone);
        await tell(phone, false);
      }
    },

    /** Diagnostics only. Never a business decision. */
    active: (phone) => leases.has(phone),
    count: (phone) => (leases.get(phone) || { count: 0 }).count,
    size: () => leases.size,
    supported,
  };
}

module.exports = { createTyping, REFRESH_MS, MAX_LEASE_MS };
