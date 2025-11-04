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

const payload = { course: { title: 'Delete Me' }, modules: [] };

const main = async () => {
  const save = await requestJson({ method: 'POST', path: '/api/admin/courses', data: payload });
  const id = save.json?.data?.id;
  console.log('Saved course id:', id);
  const del = await requestJson({ method: 'DELETE', path: `/api/admin/courses/${id}` });
  console.log('Delete status:', del.status);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
