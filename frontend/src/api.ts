const API_BASE = 'http://localhost:3000';

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
