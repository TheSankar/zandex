const https = require('https');

const selectors = ['69ea1771', '0ace9ca0', '27e235e3', '9a79d32b'];

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
