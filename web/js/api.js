/* Kreipiniai į serverį. Kiekvienam (išskyrus viešus) pridedamas Microsoft žetonas. */
import { getToken } from './auth.js';

async function request(method, path, body, withAuth) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (withAuth) headers.Authorization = 'Bearer ' + await getToken();
  const r = await fetch('/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const isJson = (r.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await r.json() : null;
  if (!r.ok) {
    const e = new Error((data && data.error) || `Serverio klaida (${r.status})`);
    e.status = r.status;
    e.code = data && data.code;
    throw e;
  }
  return data;
}

export const api = {
  get: path => request('GET', path, undefined, true),
  post: (path, body) => request('POST', path, body || {}, true),
  put: (path, body) => request('PUT', path, body || {}, true),
};

export const publicApi = {
  post: (path, body) => request('POST', path, body || {}, false),
};
