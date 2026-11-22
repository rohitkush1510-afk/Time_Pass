const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function request(path, method = 'GET', body = null) {
  const options = { method, headers: {} };

  const token = localStorage.getItem('token');
  if (token) options.headers.Authorization = 'Bearer ' + token;

  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}/api${path}`, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}