export interface AdPackage {
  adType: string;
  size: string;
  count: number;
  price: number;
}

export interface SponsorItem {
  companyName: string;
  packages: AdPackage[];
  logoText: string;
  logoBgColor?: string;
  contractFileName: string;
}

export interface ZoneSummary {
  zone: string;
  seatsSold: string;
  revenue: string;
}

export interface SponsorSummary {
  name: string;
  amount: string;
}

export interface ConcertItem {
  id: string;
  title: string;
  subtitle?: string;
  poster: string;
  date: string;
  revenue: string;
  ticketsSold: string;
  location?: string;
  status: 'กำลังตรวจสอบข้อมูล' | 'ตรวจสอบข้อมูลเสร็จสิ้น';
  lastUpdate: string;
  sponsors?: SponsorItem[];
  seatingSummary?: ZoneSummary[];
  sponsorSummary?: SponsorSummary[];
  totalTicketRevenue?: string;
  totalSponsorRevenue?: string;
}
