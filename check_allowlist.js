require('dotenv').config();
const { supabase } = require('./src/db/supabase');

async function run() {
  const { data, error } = await supabase.from('app_settings').select('*').eq('key', 'allowed_numbers');
  console.log('Current allowlist:', data);
}

run();
