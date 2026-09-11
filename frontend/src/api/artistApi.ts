const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export interface ArtistData { artist_id: string; artist_name: string; artist_type: string; record_label: string; official_contact: string; coordinator_name: string; coordinator_phone: string; coordinator_email: string; coordinator_info?: string; more_info?: string; status?: string; }
export interface InvitationData { concert_id: string; concert_name: string; start_date: string; end_date: string; start_time: string; end_time: string; location: string; invitation_status: string; }
export interface PerformanceScheduleData { schedule_id?: string; performance_order: number; details: string; start_show: string; end_show: string; concert_id?: string; artist_id: string; show_date: string; }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
  return body as T;
}

export const artistApi = {
  getArtists: (search = '') => request<ArtistData[]>(`/artists${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getArtist: (id: string) => request<ArtistData>(`/artists/${encodeURIComponent(id)}`),
  createArtist: (data: Omit<ArtistData, 'artist_id'>) => request<ArtistData>('/artists', { method: 'POST', body: JSON.stringify(data) }),
  updateArtist: (id: string, data: Partial<ArtistData>) => request<ArtistData>(`/artists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteArtist: (id: string) => request<{ message: string }>(`/artists/${id}`, { method: 'DELETE' }),
  getInvitations: (id: string) => request<InvitationData[]>(`/artists/${id}/invitations`),
  updateInvitations: (id: string, invitations: { concert_id: string; status: string }[]) => request<{ message: string }>(`/artists/${id}/invitations`, { method: 'PUT', body: JSON.stringify({ invitations }) }),
  getSchedules: (concertId = '', showDate = '') => {
    const params = new URLSearchParams();
    if (concertId) params.set('concert_id', concertId);
    if (showDate) params.set('show_date', showDate);
    return request<PerformanceScheduleData[]>(`/performance-schedules${params.size ? `?${params}` : ''}`);
  },
  saveSchedules: (concertId: string, schedules: PerformanceScheduleData[], showDate?: string) => request<{ message: string }>(`/concerts/${concertId}/performance-schedules`, { method: 'PUT', body: JSON.stringify({ show_date: showDate || schedules[0]?.show_date || '', schedules }) }),
  createRequirement: (data: Record<string, string>) => request('/artist-requirements', { method: 'POST', body: JSON.stringify(data) }),
  createPerformanceDetail: (data: Record<string, string>) => request('/performance-details', { method: 'POST', body: JSON.stringify(data) }),
  getHistory: (entityId = '', date = '') => {
    const params = new URLSearchParams();
    if (entityId) params.set('entity_id', entityId);
    if (date) params.set('date', date);
    return request(`/artist-history${params.size ? `?${params}` : ''}`);
  },
  getDashboard: () => request('/artist-dashboard'),
};
