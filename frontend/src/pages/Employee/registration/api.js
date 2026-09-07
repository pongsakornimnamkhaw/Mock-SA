const API_ROOT = `${import.meta.env.VITE_API_BASE_URL || '/api'}/registration`

const request = async (path, options) => {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    // Invalid and already-used tickets are expected scan outcomes, not transport errors.
    if (body?.result === 'invalid' || body?.result === 'used') return body
    throw new Error(body?.message || body?.error || `Registration API returned ${response.status}`)
  }
  return body
}

export const checkInTicket = ticketCode => request('/check-ins', {
  method: 'POST',
  body: JSON.stringify({ ticketCode }),
})

export const reportCheckInIssue = (ticketCode, result) => request('/issues', {
  method: 'POST',
  body: JSON.stringify({ ticketCode, result }),
})
