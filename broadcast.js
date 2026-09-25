const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env', 'utf8').split('\n');
const supabaseUrl = env.find(l => l.startsWith('SUPABASE_URL=')).split('=')[1].trim();
const supabaseKey = env.find(l => l.startsWith('SUPABASE_SECRET_KEY=')).split('=')[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const rawNumbers = `
9667103596
8698444124
8447993216
9118815982
9867646598
8108326574
9360797875
9538550514
9124381666
8779227103
9131000507
7050552888
9319473756
9356719365
8657334390
9438166637
8830761732
9312436492
6378692666
9140729170
9769287725
9875398676
8910291812
9528442713
6290655878
8886290906
9041150943
9095863583
`;

const numbers = rawNumbers.split('\n').map(n => n.trim().replace(/[^0-9]/g, '')).filter(n => n.length > 0);

async function main() {
  const message = "Hii! Welcome to 3pointer.club 🔥 Sorry for the late reply. Aapko konsa T-shirt ya bag chahiye? Main aapki abhi help kar dunga!";
  for (let num of numbers) {
    if (num.length === 10) num = '91' + num;
    const { error } = await supabase.from('outbound_messages').insert({
      phone: num,
      text: message,
      status: 'PENDING',
      requested_by: 'broadcast'
    });
    if (error) console.error(num, error.message);
    else console.log('Queued', num);
  }
}
main();
