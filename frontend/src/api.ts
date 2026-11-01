const PRODUCTION_API_URL = 'https://eusou.onrender.com';

export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' &&
  !window.location.hostname.includes('localhost') &&
  !window.location.hostname.includes('127.0.0.1')
    ? PRODUCTION_API_URL
    : typeof window !== 'undefined'
      ? `http://${window.location.hostname}:3000`
      : 'http://localhost:3000');

export function extractYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }
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
    cache: 'no-store',
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
