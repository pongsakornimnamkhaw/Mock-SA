const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.error || `Registration API returned ${response.status}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

export const registrationApi = {
  listConcerts: () => request('/venue-seat/concerts'),
  dashboard: concertId => request(`/event-registration/concerts/${encodeURIComponent(concertId)}/dashboard`),
  lookupTicket: ticketId => request(`/event-registration/tickets/${encodeURIComponent(ticketId)}`),
  checkIn: (ticketId, gateId) => request('/event-registration/check-ins', {
    method: 'POST',
    body: JSON.stringify({ ticketId, gateId }),
  }),
}
