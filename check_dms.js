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

  if (errToday) {
    console.error('Error fetching today data:', errToday);
  } else {
    const uniquePhonesToday = new Set(dataToday.map(d => d.phone));
    console.log(`\n========================================`);
    console.log(`📅 TODAY'S STATS (Since 12:00 AM)`);
    console.log(`Total incoming messages TODAY: ${dataToday.length}`);
    console.log(`Unique people who DMed TODAY: ${uniquePhonesToday.size}`);
    console.log(`========================================\n`);
  }

  // Overall
  const { data: dataAll, error: errAll } = await supabase
    .from('messages')
    .select('phone')
    .eq('direction', 'INCOMING');

  if (errAll) {
    console.error('Error fetching all data:', errAll);
  } else {
    const uniquePhonesAll = new Set(dataAll.map(d => d.phone));
    console.log(`========================================`);
    console.log(`📈 OVERALL STATS (All time)`);
    console.log(`Total incoming messages OVERALL: ${dataAll.length}`);
    console.log(`Unique people who DMed OVERALL: ${uniquePhonesAll.size}`);
    console.log(`========================================\n`);
  }
}
main();
