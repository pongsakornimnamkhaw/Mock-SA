export type TabCategory = 'hq' | 'sponsor' | 'planning' | 'ticketing' | 'general';
export type SponsorSubTab = 'request' | 'status';
export type PlanningSubTab = 'details' | 'status';
export type TicketingSubTab = 'request' | 'summary';

export interface AdRequestRow {
  id: string;
  type: string;
  size: string;
  quantity: number;
}

export interface ScheduleItem {
  id: string;
  date: string;
  time: string;
  officer: string;
  task: string;
}

export interface TimelineStep {
  id: number;
  title: string;
  time?: string;
  status: 'completed' | 'current' | 'pending';
}

export interface TicketDistributionFormData {
  concertName: string;
  date: string;
  time: string;
  seatZone: string;
  seatCount: string;
}

export interface SalesSummaryFormData {
  priceTier1: string;
  salesCount1: string;
  priceTier2: string;
  salesCount2: string;
  totalSold: string;
  totalRemaining: string;
}

export interface GeneralInquiryFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}