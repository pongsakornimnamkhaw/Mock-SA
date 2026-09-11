import { celestial, flux, pulse, starlight } from '@/assets/poster';

export interface CustomerEvent {
  id: string;
  image: string;
  title: string;
  date: string;
  location: string;
  isNew?: boolean;
  announcement: string;
}

// UI-only data. This will be replaced by the customer concert API later.
export const customerEvents: CustomerEvent[] = [
  {
    id: '1',
    image: flux,
    title: 'Neon Flux Festival 2024',
    date: '16-18 ส.ค. 2024',
    location: 'กรุงเทพมหานคร',
    isNew: true,
    announcement: 'เปิดตัวคอนเสิร์ตใหม่ พร้อมรายละเอียดงานและรอบการแสดง',
  },
  {
    id: '2',
    image: pulse,
    title: 'Neon Pulse',
    date: '18 ต.ค. 2024',
    location: 'นครราชสีมา',
    isNew: true,
    announcement: 'เพิ่มคอนเสิร์ตใหม่ในนครราชสีมา ดูรายละเอียดได้แล้ววันนี้',
  },
  {
    id: '3',
    image: celestial,
    title: 'Celestial Sounds',
    date: '26 ต.ค. 2024',
    location: 'เชียงใหม่',
    announcement: 'เตรียมพบกับเสียงดนตรีใต้ท้องฟ้าเชียงใหม่',
  },
  {
    id: '4',
    image: starlight,
    title: 'Starlight Festival',
    date: '23-25 ส.ค. 2024',
    location: 'ขอนแก่น',
    announcement: 'เทศกาลดนตรีสามวันเต็มที่ขอนแก่น',
  },
];
