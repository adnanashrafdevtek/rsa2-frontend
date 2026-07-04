const BASE = import.meta.env.VITE_BACKEND_BASE || 'http://localhost:3000';

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.append(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function request(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const role = typeof window !== 'undefined' ? window.localStorage.getItem('planner-role') : null;
  if (role && !headers['x-user-role']) headers['x-user-role'] = role;

  const res = await fetch(BASE + path, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  try { return await res.json(); } catch { return null; }
}

export default {
  list: async (resource, params) => {
    const url = `/${resource}${buildQuery(params)}`;
    const json = await request(url);
    return (json && json.mysqlResult) || json || [];
  },
  get: async (resource, id) => {
    const url = `/${resource}/${encodeURIComponent(id)}`;
    const json = await request(url);
    return (json && json.mysqlResult) || json;
  },
  uploadExcelFile: async (fileBuffer, fileName) => {
    return request('/user/import-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBuffer, fileName })
    })
  },
  create: async (resource, body = {}) => {
    return request(`/${resource}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
  }
}
