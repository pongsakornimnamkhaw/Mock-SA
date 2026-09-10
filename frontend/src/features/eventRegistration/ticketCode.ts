export function normalizeTicketCode(raw: unknown): string {
  const value = String(raw ?? '').trim().replace(/^#/, '')
  if (!value.toUpperCase().startsWith('OCTAVIA|')) return value
  return value.split('|')[1]?.trim() ?? ''
}

export function formatTicketCode(raw: unknown): string {
  const value = String(raw ?? '').trim().replace(/^#/, '')
  if (!value) return '-'
  return /^TK-/i.test(value) ? value : `TK-${value}`
}
