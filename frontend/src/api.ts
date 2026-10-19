const PRODUCTION_API_URL = 'https://eusou.onrender.com';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' &&
  !window.location.hostname.includes('localhost') &&
  !window.location.hostname.includes('127.0.0.1')
    ? PRODUCTION_API_URL
    : typeof window !== 'undefined'
      ? `http://${window.location.hostname}:3000`
      : 'http://localhost:3000');

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  const base = API_BASE;
  if (url.startsWith('http://localhost:3000/')) {
    return url.replace('http://localhost:3000', base);
  }
  if (url.startsWith('/')) {
    return `${base}${url}`;
  }
  return url;
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    let msg = errorData.message || `Request failed with status ${res.status}`;
    if (Array.isArray(msg)) {
      msg = msg.join(', ');
    }
    throw new Error(msg);
  }

  return res.json();
}
