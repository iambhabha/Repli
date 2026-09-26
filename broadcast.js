const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env', 'utf8').split('\n');
const supabaseUrl = env.find(l => l.startsWith('SUPABASE_URL=')).split('=')[1].trim();
const supabaseKey = env.find(l => l.startsWith('SUPABASE_SECRET_KEY=')).split('=')[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const rawNumbers = `
9326218842
9657921067
9833521067
8010794105
9573387721
8923551648
7837908371
8290051198
9622081417
7042818076
998631700
9065615904
9310999158
`;

const numbers = rawNumbers.split('\n').map(n => n.trim().replace(/[^0-9]/g, '')).filter(n => n.length > 0);

async function main() {
  const message = "Hey bro 👋 Welcome to 3POINTER.CLUB & AESTHURA!\n\nT-shirts, bags & hoodies available hain. Batao kya dekhna hai? 👊\n\nYe hamara group link hai join kar lo for further updates: https://chat.whatsapp.com/Hx7Xc4ny3PuLkXqWj34UpA";
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
