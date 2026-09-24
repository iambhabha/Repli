const { MessageMedia } = require('whatsapp-web.js');
const media = MessageMedia.fromFilePath('assets/spiderman_size_chart.jpg');
console.log('Media size:', media.data ? media.data.length : 'no data');
console.log('Mime:', media.mimetype);
console.log('Filename:', media.filename);
