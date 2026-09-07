import { mockConcerts } from '@/utils/mockConcerts'
import type { Concert } from '@/interface/IConcertInterface'

// จุดเดียวที่ต้องแก้เมื่อ Backend Go พร้อม: เปลี่ยนไส้ในของสามฟังก์ชันนี้เป็น fetch()
// โดยคง signature เดิมไว้ หน้าเพจจะไม่ต้องแก้เลย

export async function listConcerts(): Promise<Concert[]> {
  return mockConcerts
}

export async function listFeaturedConcerts(): Promise<Concert[]> {
  return mockConcerts.filter((concert) => concert.featured)
}

export async function getConcertById(id: string): Promise<Concert | null> {
  return mockConcerts.find((concert) => concert.id === id) ?? null
}
