export const initialConcerts = [
  {
    id: 'concert-1', name: 'Neon Flux Festival 2024', artist: 'Various Artists',
    date: '2024-08-16', endDate: '2024-08-18', location: 'กรุงเทพมหานคร', category: 'Festival',
    status: 'กำลังแสดง', description: 'เทศกาลดนตรีแห่งแสง สี และเสียง', cover: '',
    rounds: [{ id: 'round-1', name: 'รอบที่ 1', date: '2024-08-16', doorTime: '17:30', status: 'ยืนยันแล้ว' }],
    publishing: { scheduleFile: '', scheduleImage: '', saleStart: '', saleEnd: '', publishAt: '', unpublishAt: '' },
    zones: [
      { id: 'zone-a1', name: 'A1', color: '#ff2d2d', seats: 150, zonePrice: 3500, type: 'VIP', shape: 'rectangle', width: 12, height: 14, rotation: 0, z: 1, x: 34, y: 25 },
      { id: 'zone-a2', name: 'A2', color: '#ff2d2d', seats: 150, zonePrice: 3500, type: 'VIP', shape: 'rectangle', width: 12, height: 14, rotation: 0, z: 2, x: 55, y: 25 },
      { id: 'zone-b1', name: 'B1', color: '#5043f5', seats: 100, zonePrice: 2500, type: 'ปกติ', shape: 'rectangle', width: 12, height: 14, rotation: 0, z: 3, x: 22, y: 52 },
      { id: 'zone-b2', name: 'B2', color: '#5043f5', seats: 100, zonePrice: 2500, type: 'ปกติ', shape: 'rectangle', width: 12, height: 14, rotation: 0, z: 4, x: 42, y: 52 },
      { id: 'zone-b3', name: 'B3', color: '#5043f5', seats: 100, zonePrice: 2500, type: 'ปกติ', shape: 'rectangle', width: 12, height: 14, rotation: 0, z: 5, x: 62, y: 52 },
      { id: 'zone-c1', name: 'C1', color: '#5bd84f', seats: 50, zonePrice: 1500, type: 'ปกติ', shape: 'rectangle', width: 12, height: 12, rotation: 0, z: 6, x: 27, y: 78 },
      { id: 'zone-c2', name: 'C2', color: '#5bd84f', seats: 100, zonePrice: 1500, type: 'ปกติ', shape: 'rectangle', width: 12, height: 12, rotation: 0, z: 7, x: 48, y: 78 },
      { id: 'zone-c3', name: 'C3', color: '#5bd84f', seats: 50, zonePrice: 1500, type: 'ปกติ', shape: 'rectangle', width: 12, height: 12, rotation: 0, z: 8, x: 69, y: 78 },
    ],
    layoutObjects: [{ id: 'object-stage', name: 'STAGE', kind: 'object', shape: 'rectangle', color: '#dfe0e5', textColor: '#3f435b', x: 50, y: 8, width: 36, height: 8, rotation: 0, z: 0 }],
    ticketLayoutObjects: [],
  },
  {
    id: 'concert-2', name: 'Neon Pulse', artist: 'The Soul Quarters', date: '2024-09-18', endDate: '',
    location: 'นครราชสีมา', category: 'Concert', status: 'กำลังแสดง', description: '', cover: '', rounds: [],
    publishing: { scheduleFile: '', scheduleImage: '', saleStart: '', saleEnd: '', publishAt: '', unpublishAt: '' }, zones: [], layoutObjects: [], ticketLayoutObjects: [],
  },
  {
    id: 'concert-3', name: 'Celestial Sounds', artist: 'Iron Lotus', date: '2024-10-26', endDate: '',
    location: 'เชียงใหม่', category: 'Concert', status: 'กำลังแสดง', description: '', cover: '', rounds: [],
    publishing: { scheduleFile: '', scheduleImage: '', saleStart: '', saleEnd: '', publishAt: '', unpublishAt: '' }, zones: [], layoutObjects: [], ticketLayoutObjects: [],
  },
]

export const blankConcert = () => ({
  id: `concert-${Date.now()}`, name: '', artist: '', date: '', endDate: '', location: '', category: '',
  status: 'ฉบับร่าง', description: '', cover: '', rounds: [],
  publishing: { scheduleFile: '', scheduleImage: '', saleStart: '', saleEnd: '', publishAt: '', unpublishAt: '' }, zones: [], layoutObjects: [], ticketLayoutObjects: [],
})


