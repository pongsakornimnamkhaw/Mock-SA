// สีของตั๋วต้องเข้าชุดกับโปสเตอร์ที่การ์ดคอนเสิร์ตใบนั้นใช้ ทั้งสองที่จึงเลือกด้วย
// posterIndexForConcertId ตัวเดียวกัน — ถ้าแยกกันคำนวณ สีตั๋วกับรูปโปสเตอร์จะหลุดคู่กัน
// ทันทีที่มีคนแก้ข้างใดข้างหนึ่ง
export interface TicketTheme {
  id: string;
  base: string;
  stub: string;
  accent: string;
}

// เรียงตรงกับ fallbackPosters ใน customerConcertCard.ts: flux, pulse, celestial, starlight
// ค่าสีดูดโทนมาจากไฟล์โปสเตอร์จริงใน @/assets/poster
export const POSTER_THEMES: TicketTheme[] = [
  { id: 'flux', base: '#150F2E', stub: '#1F1547', accent: '#C084FC' },
  { id: 'pulse', base: '#1A0B18', stub: '#2B1020', accent: '#FF6B5A' },
  { id: 'celestial', base: '#0F1030', stub: '#191C4A', accent: '#818CF8' },
  { id: 'starlight', base: '#1B0D2B', stub: '#28133D', accent: '#FF4FA3' },
];

export function posterIndexForConcertId(concertId: string) {
  let checksum = 0;
  for (const character of concertId) {
    checksum += character.codePointAt(0) ?? 0;
  }
  return checksum % POSTER_THEMES.length;
}

export function ticketThemeForConcertId(concertId: string): TicketTheme {
  return POSTER_THEMES[posterIndexForConcertId(concertId)];
}
