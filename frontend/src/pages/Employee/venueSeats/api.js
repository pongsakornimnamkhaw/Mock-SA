const API_ROOT = `${import.meta.env.VITE_API_BASE_URL || '/api'}/venue-seat`

const request = async (path, options) => {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const error = new Error(body?.error || `Venue/seat API returned ${response.status}`)
    error.status = response.status
    throw error
  }
  if (response.status === 204) return null
  return response.json()
}

export const loadConcerts = async () => {
  return request('/concerts')
}

export const loadConcert = concertId => request(`/concerts/${encodeURIComponent(concertId)}`)

export const savePublication = (concertId, publication) => {
  return request(`/concerts/${encodeURIComponent(concertId)}/publication`, {
    method: 'PUT',
    body: JSON.stringify(publication),
  })
}

export const loadConcertLayout = concertId => request(`/concerts/${encodeURIComponent(concertId)}/layout`)

export const saveConcertLayout = (concertId, zones, layoutObjects, flowchart) => {
  return request(`/concerts/${encodeURIComponent(concertId)}/layout`, {
    method: 'PUT',
    body: JSON.stringify({ zones, layoutObjects, flowchart }),
  })
}

export const clearConcertLayout = concertId => request(`/concerts/${encodeURIComponent(concertId)}/layout`, { method: 'DELETE' })
