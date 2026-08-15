'use strict';

/**
 * English pack.
 *
 * Nothing but a language choice: every string comes from the same editable
 * templates as the Hinglish pack, so the two can never drift out of sync in
 * structure - only in wording, which is the point.
 */

const { createPack } = require('./pack');

module.exports = createPack('en');
