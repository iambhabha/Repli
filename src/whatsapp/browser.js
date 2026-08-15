'use strict';

/**
 * Finding a Chromium to drive.
 *
 * Every WhatsApp Web library needs a browser. Puppeteer ships its own copy,
 * but that download is the single most common way `npm start` fails: ~150 MB,
 * it silently half-extracts on Windows, and on a slim VPS it is a waste when
 * Chromium is one `apt install` away.
 *
 * So: use whatever browser the machine already has, wherever it is - and let
 * a server say it outright with CHROME_PATH.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../logger');

const CHROME_CANDIDATES = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    // Chromium-based, and the only browser on a bare Windows install.
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ],
};

/** Returns null when nothing is found, which leaves puppeteer's own copy in charge. */
function resolveChromePath() {
  const explicit = String(config.CHROME_PATH || '').trim();
  if (explicit) {
    if (fs.existsSync(explicit)) return explicit;
    logger.warn('whatsapp.chrome_path_missing', { action: explicit });
    console.warn(`⚠️  CHROME_PATH me diya hua browser nahi mila: ${explicit}`);
  }

  for (const candidate of CHROME_CANDIDATES[process.platform] || []) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/** Puppeteer options shared by every browser-based driver. */
function puppeteerOptions() {
  const executablePath = resolveChromePath();

  if (executablePath) {
    logger.info('whatsapp.browser', { action: executablePath });
    console.log(`🌐 Browser: ${executablePath}`);
  } else {
    console.warn(
      [
        '⚠️  System me Chrome/Chromium nahi mila - puppeteer apna browser use karega.',
        '   "Browser was not found" aaye toh in me se ek karo:',
        '     Windows/Mac : Chrome install karo, ya .env me CHROME_PATH=<chrome ka path>',
        '     Linux/VPS   : sudo apt install -y chromium-browser',
        '                   phir .env me CHROME_PATH=/usr/bin/chromium-browser',
        '     Ya phir     : npx puppeteer browsers install chrome',
        '',
      ].join('\n')
    );
  }

  return {
    headless: config.WA_HEADLESS,
    ...(executablePath ? { executablePath } : {}),
    // --no-sandbox is required as root on most VPS images; harmless elsewhere.
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
}

module.exports = { resolveChromePath, puppeteerOptions, CHROME_CANDIDATES };
