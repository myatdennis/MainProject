import http from 'node:http';

const payload = {
  course: {
    title: 'Dev Fallback Test Course',
    description: 'Test saving a course without Supabase',
    status: 'draft',
    version: 1,
    meta: { author: 'dev-fallback' }
  },
  modules: [
    {
      title: 'Intro',
      description: 'Welcome module',
      order_index: 0,
      lessons: [
        {
          title: 'Welcome',
          type: 'text',
          order_index: 0,
          duration_s: 60,
          content_json: { blocks: [{ type: 'paragraph', data: { text: 'Hello!' } }] }
        }
      ]
    }
  ]
};

function requestJson({ method = 'GET', path = '/', data }) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const req = http.request(
      {
        host: 'localhost',
        port: 8888,
        method,
        path,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body ? Buffer.byteLength(body) : 0,
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (d) => (chunks += d));
        res.on('end', () => {
          try {
            const json = JSON.parse(chunks || '{}');
            resolve({ status: res.statusCode, json });
          } catch (e) {
            resolve({ status: res.statusCode, text: chunks });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const main = async () => {
  const res = await requestJson({ method: 'POST', path: '/api/admin/courses', data: payload });
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(res.json || res.text, null, 2));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
