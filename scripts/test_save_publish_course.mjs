import http from 'node:http';

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

const payload = {
  course: {
    title: 'Dev Fallback Publish Test',
    description: 'Publish flow test',
    status: 'draft',
    version: 1,
    meta: { author: 'dev-fallback' }
  },
  modules: [
    {
      title: 'Module A',
      description: 'Describe A',
      order_index: 0,
      lessons: [
        { title: 'L1', type: 'text', order_index: 0, content_json: { html: '<p>Hi</p>' } }
      ]
    }
  ]
};

const main = async () => {
  const save = await requestJson({ method: 'POST', path: '/api/admin/courses', data: payload });
  console.log('Save status:', save.status);
  const courseId = save.json?.data?.id;
  console.log('Saved course id:', courseId);
  if (!courseId) throw new Error('No course id from save');

  const publish = await requestJson({ method: 'POST', path: `/api/admin/courses/${courseId}/publish`, data: { version: 1 } });
  console.log('Publish status:', publish.status);
  console.log('Publish response:', JSON.stringify(publish.json, null, 2));

  const list = await requestJson({ method: 'GET', path: '/api/client/courses' });
  console.log('Published courses count:', (list.json?.data || []).length);
  const found = (list.json?.data || []).find((c) => c.id === courseId);
  console.log('Published course found:', Boolean(found));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
