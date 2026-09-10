const API_ROOT = `${import.meta.env.VITE_API_BASE_URL || '/api'}/ticket-planning`

const request = async (path, options) => {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })
  if (!response.ok) throw new Error(`Venue/seat API returned ${response.status}`)
  if (response.status === 204) return null
  return response.json()
}

export const loadConcerts = async () => {
  try {
    return await request('/concerts')
  } catch {
    return null
  }
}

export const saveConcertPlan = async concert => {
  return request(`/concerts/${encodeURIComponent(concert.id)}`, {
    method: 'PUT',
    body: JSON.stringify(concert),
  })
}

export const saveConcertLayout = async (concertId, zones, layoutObjects) => {
  return request(`/concerts/${encodeURIComponent(concertId)}/layout`, {
    method: 'PUT',
    body: JSON.stringify({ zones, layoutObjects }),
  })
}

export const clearConcertLayout = async concertId => {
  return request(`/concerts/${encodeURIComponent(concertId)}/layout`, { method: 'DELETE' })
}

export const saveTicketDesign = async (concertId, objects) => request(
  `/concerts/${encodeURIComponent(concertId)}/ticket-design`,
  { method: 'PUT', body: JSON.stringify({ objects }) },
)
