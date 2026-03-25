const https = require('https');

const selectors = [
  'c084b10b', 'c0d78655', 'd0e30db0', 'dd905854', 'f887ea40', 'ff50abdc',
  '04a7cff3', '0ba36dcd', '535ea816', '6d874f8e', '8da5cb5b', 'a5aca079'
];

selectors.forEach(sel => {
  https.get(`https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${sel}`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const results = JSON.parse(data).results;
      if (results && results.length > 0) {
        console.log(`0x${sel} -> ${results.map(r => r.text_signature).join(', ')}`);
      } else {
        console.log(`0x${sel} -> Unknown`);
      }
    });
  });
});
