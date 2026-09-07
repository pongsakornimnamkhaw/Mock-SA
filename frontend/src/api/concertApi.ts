export interface ConcertData {
  concert_id: string;
  concert_name: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  status: string;
  more_info?: string;
  poster_name?: string;
  poster_data?: string;
  artists?: string[];
}

export interface TaskData {
  task_id?: string;
  concert_id: string;
  task_name: string;
  actual_finish_date: string;
  owner_task: string;
  department: string;
  task_status?: string;
  more_info?: string;
}

export interface DocumentItem {
  document_id: string;
  category: string;
  document_name: string;
  concert_id: string;
  document_file?: string;
  has_file?: boolean;
  file_url?: string;
}

export interface HistoryItem {
  id: string;
  seq?: number;
  date: string;
  time: string;
  detail: string;
  author: string;
  concert_id: string;
  concert_name: string;
  created_at: string;
}

const DEFAULT_CONCERTS: ConcertData[] = [
  {
    concert_id: "CC0001",
    concert_name: "Riverside Sound Festival",
    start_date: "2026-10-16",
    end_date: "2026-10-18",
    start_time: "18:00",
    end_time: "23:30",
    location: "ธันเดอร์โดม เมืองทองธานี",
    status: "ยืนยันแล้ว",
    artists: ["PUN", "YOUNGGU"],
  },
  {
    concert_id: "CC0002",
    concert_name: "Neon Nights Vol.3",
    start_date: "2026-11-16",
    end_date: "2026-11-18",
    start_time: "18:00",
    end_time: "23:30",
    location: "MCC Hall เดอะมอลล์บางกะปิ",
    status: "เลื่อนการจัด",
    artists: ["Slot Machine"],
  },
  {
    concert_id: "CC0003",
    concert_name: "Acoustic Sessions: Bangkok",
    start_date: "2026-12-16",
    end_date: "2026-12-18",
    start_time: "18:00",
    end_time: "23:30",
    location: "Lido Connect",
    status: "ยกเลิกการจัด",
    artists: ["URBOYTJ"],
  },
];

const API_BASE = 'http://localhost:8080/api';

async function request(endpoint: string, options: RequestInit = {}): Promise<any> {
  let url = `${API_BASE}${endpoint}`;
  try {
    let res = await fetch(url, options);
    if (!res.ok) {
      let errText = '';
      try {
        const errJson = await res.json();
        errText = errJson.error || errJson.message || JSON.stringify(errJson);
      } catch {
        errText = await res.text();
      }
      throw new Error(errText || `Request failed with status ${res.status}`);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch (err: any) {
    // Try fallback to relative proxy path /api
    const fallbackUrl = `/api${endpoint}`;
    try {
      const fallbackRes = await fetch(fallbackUrl, options);
      if (!fallbackRes.ok) {
        let errText = '';
        try {
          const errJson = await fallbackRes.json();
          errText = errJson.error || errJson.message;
        } catch {
          errText = await fallbackRes.text();
        }
        throw new Error(errText || `Request failed with status ${fallbackRes.status}`);
      }
      if (fallbackRes.status === 204) return null;
      const text = await fallbackRes.text();
      return text ? JSON.parse(text) : {};
    } catch {
      throw err;
    }
  }
}

export const concertApi = {
  // 1. Get list of concerts (with default fallback)
  async getConcerts(): Promise<ConcertData[]> {
    try {
      const data = await request('/concerts');
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
      return DEFAULT_CONCERTS;
    } catch {
      return DEFAULT_CONCERTS;
    }
  },

  // 2. Get concert details
  async getConcert(id: string): Promise<ConcertData> {
    try {
      const data = await request(`/concerts/${encodeURIComponent(id)}`);
      if (data && data.concert_id) return data;
      const fallback = DEFAULT_CONCERTS.find((c) => c.concert_id === id);
      if (fallback) return fallback;
      return data;
    } catch (err) {
      const fallback = DEFAULT_CONCERTS.find((c) => c.concert_id === id);
      if (fallback) return fallback;
      throw err;
    }
  },

  // 3. Create concert (AddConcert)
  async createConcert(formData: FormData | object): Promise<{ message: string; concert_id: string }> {
    let options: RequestInit;
    if (formData instanceof FormData) {
      options = {
        method: 'POST',
        body: formData,
      };
    } else {
      options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      };
    }
    return request('/concerts', options);
  },

  // 4. Update concert (EditConcert)
  async updateConcert(id: string, payload: Partial<ConcertData>): Promise<{ message: string }> {
    return request(`/concerts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  // 4b. Delete concert
  async deleteConcert(id: string): Promise<{ message: string }> {
    return request(`/concerts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // 5. Update concert status (ConcertStatus)
  async updateStatus(id: string, status: string): Promise<{ message: string; status: string }> {
    return request(`/concerts/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  },

  // 6. Create & manage responsible tasks (Responsibility)
  async getTasks(concertId: string): Promise<TaskData[]> {
    try {
      const data = await request(`/concerts/${encodeURIComponent(concertId)}/tasks`);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async createTask(concertId: string, task: Partial<TaskData>): Promise<{ message: string; task_id: string }> {
    return request(`/concerts/${encodeURIComponent(concertId)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
  },

  async updateTaskStatus(taskId: string, status: string = 'เสร็จสิ้น'): Promise<{ message: string; task_id: string; task_status: string }> {
    return request(`/tasks/${encodeURIComponent(taskId)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_status: status }),
    });
  },

  // 7. Upload & Get documents (AddDocument)
  async getDocuments(concertId: string): Promise<DocumentItem[]> {
    try {
      const data = await request(`/concerts/${encodeURIComponent(concertId)}/documents`);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async uploadDocument(concertId: string, formData: FormData): Promise<{ message: string; document_id: string }> {
    return request(`/concerts/${encodeURIComponent(concertId)}/documents`, {
      method: 'POST',
      body: formData,
    });
  },

  async deleteDocument(documentId: string): Promise<{ message: string }> {
    return request(`/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE',
    });
  },

  // 8. Get history (ConcertEditHistory)
  async getHistory(concertId?: string, date?: string): Promise<HistoryItem[]> {
    const params = new URLSearchParams();
    if (concertId) params.append('concert_id', concertId);
    if (date) params.append('date', date);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/history${qs}`);
  },
};
