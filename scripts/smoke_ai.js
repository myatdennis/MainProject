const http = require('http');

function request(path, method = 'GET', data) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 4000, path, method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

(async () => {
  try {
    console.log('Checking /health...');
    console.log(await request('/health'));
    console.log('Checking /api/ai/media...');
    console.log(await request('/api/ai/media?query=diversity'));
    console.log('Checking /api/ai/generate...');
    console.log(await request('/api/ai/generate', 'POST', { audience: 'Managers', length: 'short', tone: 'Practical', title: 'DEIA Basics' }));
    console.log('Smoke tests completed.');
  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exitCode = 2;
  }
})();
