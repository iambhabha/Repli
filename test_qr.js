require('dotenv').config();
const bot = require('./src/whatsapp');

async function run() {
  console.log('Connecting...');
  // Wait a few seconds for bot to initialize if needed (wwebjs is already running in background though)
  // Actually, we can't easily use bot.sendImage in a standalone script if the main process owns the wwebjs session!
}

run();
