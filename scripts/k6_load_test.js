import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.TARGET_BASE || 'http://127.0.0.1:8888';

export let options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const routes = [
    '/api/admin/courses',
    '/api/learner/courses',
    '/api/assignments',
    '/api/progress',
  ];

  for (const path of routes) {
    const res = http.get(`${BASE}${path}`);
    check(res, { 'status is 2xx or 401': (r) => r.status >= 200 && r.status < 300 || r.status === 401 });
  }

  sleep(1);
}
