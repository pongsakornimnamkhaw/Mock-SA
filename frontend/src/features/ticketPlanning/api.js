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
  try {
    return await request(`/concerts/${encodeURIComponent(concert.id)}`, {
      method: 'PUT',
      body: JSON.stringify(concert),
    })
  } catch {
    return null
  }
}

export const saveConcertLayout = async (concertId, zones, layoutObjects, ticketLayoutObjects = []) => {
  try {
    return await request(`/concerts/${encodeURIComponent(concertId)}/layout`, {
      method: 'PUT',
      body: JSON.stringify({ zones, layoutObjects, ticketLayoutObjects }),
    })
  } catch {
    return null
  }
}

export const clearConcertLayout = async concertId => {
  try {
    return await request(`/concerts/${encodeURIComponent(concertId)}/layout`, { method: 'DELETE' })
  } catch {
    return null
  }
}


