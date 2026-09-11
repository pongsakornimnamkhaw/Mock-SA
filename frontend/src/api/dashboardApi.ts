import { apiRequest, resolveApiAssetUrl } from './sharedApi';

export interface DashboardConcert {
  concert_id: string;
  concert_name: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  status: string;
  poster_url: string;
  updated_at: string;
}

export interface DashboardData {
  summary: {
    total_concerts: number;
    concerts_this_month: number;
    total_budget: number;
    incomplete_tasks: number;
    responsible_people: number;
  };
  featured_concerts: DashboardConcert[];
  concert_statuses: DashboardConcert[];
  responsibilities: Array<{
    task_id: string; concert_id: string; concert_name: string; task_name: string;
    owner: string; department: string; status: string; finish_date: string;
  }>;
  recent_updates: Array<{
    history_id: string; concert_id: string; concert_name: string;
    action_type: string; description: string; created_at: string;
  }>;
}

export const dashboardApi = {
  async getDashboard(): Promise<DashboardData> {
    const data = await apiRequest<DashboardData>('/dashboard');
    return {
      ...data,
      featured_concerts: (data.featured_concerts || []).map((concert) => ({
        ...concert,
        poster_url: resolveApiAssetUrl(concert.poster_url),
      })),
    };
  },
};
