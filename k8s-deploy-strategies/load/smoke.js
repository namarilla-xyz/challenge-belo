import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const url = __ENV.TARGET || 'http://web.local/'; // o URL del service
  const res = http.get(url);
  // opcional: chequeos simples
  sleep(0.2);
}
