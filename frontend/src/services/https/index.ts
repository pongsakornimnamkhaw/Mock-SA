const baseURL = import.meta.env.VITE_API_URL || '/api'

type RequestOptions = RequestInit & { params?: Record<string, string | number | boolean> }

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${baseURL}${path}`, window.location.origin)
  Object.entries(options.params || {}).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  const token = localStorage.getItem('token')
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) throw new Error(`API returned ${response.status}`)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
}

export default api
