const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf8').split('\n');
const supabaseUrl = env.find(l => l.startsWith('SUPABASE_URL=')).split('=')[1].trim();
const supabaseKey = env.find(l => l.startsWith('SUPABASE_SECRET_KEY=')).split('=')[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Today
  const { data: dataToday, error: errToday } = await supabase
    .from('messages')
    .select('phone')
    .eq('direction', 'INCOMING')
    .gte('created_at', startOfDay.toISOString());

  if (!errToday) {
    const uniquePhonesToday = Array.from(new Set(dataToday.map(d => d.phone)));
    fs.writeFileSync('aaj_ke_numbers.csv', uniquePhonesToday.join('\n'));
    console.log(`Saved ${uniquePhonesToday.length} numbers to aaj_ke_numbers.csv`);
  }

  // Overall
  const { data: dataAll, error: errAll } = await supabase
    .from('messages')
    .select('phone')
    .eq('direction', 'INCOMING');

  if (!errAll) {
    const uniquePhonesAll = Array.from(new Set(dataAll.map(d => d.phone)));
    fs.writeFileSync('all_time_numbers.csv', uniquePhonesAll.join('\n'));
    console.log(`Saved ${uniquePhonesAll.length} numbers to all_time_numbers.csv`);
  }
}
main();
