const https = require('https');

const url = 'https://docs.google.com/spreadsheets/d/1lNKH9cvPteYbG1qtBhq9zRAxFI4qfaDhFqtM3DlMHtc/gviz/tq?tqx=out:csv&sheet=RENEW';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const lines = data.split('\n');
    console.log('--- FIRST 5 LINES ---');
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      console.log(`Line ${i}:`, lines[i]);
    }
  });
}).on('error', (err) => {
  console.error(err);
});
