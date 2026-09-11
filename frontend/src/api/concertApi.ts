import { apiRequest, resolveApiAssetUrl } from './sharedApi';

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
  poster_url?: string;
  updated_at?: string;
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

async function request(endpoint: string, options: RequestInit = {}): Promise<any> {
  return apiRequest(endpoint, options);
}

export const concertApi = {
  // 1. Get list of concerts from the database
  async getConcerts(): Promise<ConcertData[]> {
    const data = await request('/concerts');
    return Array.isArray(data) ? data.map((concert) => ({ ...concert, poster_url: resolveApiAssetUrl(concert.poster_url) })) : [];
  },

  // 2. Get concert details
  async getConcert(id: string): Promise<ConcertData> {
    const data = await request(`/concerts/${encodeURIComponent(id)}`);
    return { ...data, poster_url: resolveApiAssetUrl(data.poster_url) };
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
