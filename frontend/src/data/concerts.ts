import type { ConcertItem } from '../types/report';
import posterCelestial from '../assets/poster_celestial.jpg';
import posterFlux from '../assets/poster_flux.jpg';
import posterPulseLive from '../assets/poster_pulse_live.jpg';
import posterStarlight from '../assets/poster_starlight.jpg';

export const finishedConcertsData: ConcertItem[] = [
  {
    id: 'c1',
    title: 'Neon Pulse',
    subtitle: 'CELESTIAL SOUNDS',
    poster: posterCelestial,
    date: '26 มิถุนายน 2569',
    revenue: '20.52 M.',
    ticketsSold: '3,000 ใบ',
    status: 'กำลังตรวจสอบข้อมูล',
    lastUpdate: '26 มิ.ย. 2569, 11.32 น.',
    sponsors: [
      {
        companyName: 'ชาตรามือ',
        logoText: 'ชาตรามือ',
        logoBgColor: '#0284c7',
        contractFileName: 'Jajatext.PDF',
        packages: [
          { adType: 'ป้ายแขวนเสา', size: 'Size S', count: 8, price: 20000 },
          { adType: 'สแตนดี้ตั้งพื้นกระจกโค้ง', size: 'Wide', count: 5, price: 177500 },
        ],
      },
      {
        companyName: 'ชาญแอลตร้าดริ้งค์',
        logoText: 'บริษัท ชาญแอลตร้าดริ้งค์ จำกัด',
        logoBgColor: '#16a34a',
        contractFileName: 'Chanset.PDF',
        packages: [
          { adType: 'ป้ายไฟกล่องสี่เหลี่ยมติดผนัง...', size: 'Medium', count: 4, price: 120000 },
          { adType: 'สแตนดี้ตั้งพื้นกระจกโค้ง', size: 'Standard', count: 5, price: 77500 },
        ],
      },
    ],
    seatingSummary: [
      { zone: 'โซน A', seatsSold: '999 ที่นั่ง', revenue: '1,998,000 บาท' },
      { zone: 'โซน B', seatsSold: '1,999 ที่นั่ง', revenue: '2,998,500 บาท' },
      { zone: 'โซน C', seatsSold: '1,999 ที่นั่ง', revenue: '1,999,000 บาท' },
    ],
    totalTicketRevenue: '6,995,500 บาท',
    sponsorSummary: [
      { name: 'ชาตรามือ', amount: '197,500 บาท' },
      { name: 'ชาญแอลตร้าดริ้งค์', amount: '197,500 บาท' },
    ],
    totalSponsorRevenue: '395,000 บาท',
  },
  {
    id: 'c2',
    title: 'Neon Flux Festival 2024',
    poster: posterFlux,
    date: '16-18 สิงหาคม 2567',
    revenue: '30.33 M.',
    ticketsSold: '5,000 ใบ',
    location: 'Metroplex Arena',
    status: 'ตรวจสอบข้อมูลเสร็จสิ้น',
    lastUpdate: '25 ส.ค. 2567, 10.50 น.',
    sponsors: [
      {
        companyName: 'เนสกาแฟ',
        logoText: 'NESCAFÉ',
        logoBgColor: '#dc2626',
        contractFileName: 'Nescafe_Contract.PDF',
        packages: [
          { adType: 'ป้ายแขวนเสา', size: 'Size M', count: 10, price: 45000 },
          { adType: 'ป้ายไฟกล่องสี่เหลี่ยม', size: 'Large', count: 3, price: 150000 },
        ],
      },
    ],
    seatingSummary: [
      { zone: 'โซน A', seatsSold: '1,500 ที่นั่ง', revenue: '3,000,000 บาท' },
      { zone: 'โซน B', seatsSold: '2,000 ที่นั่ง', revenue: '3,000,000 บาท' },
      { zone: 'โซน C', seatsSold: '1,500 ที่นั่ง', revenue: '1,500,000 บาท' },
    ],
    totalTicketRevenue: '7,500,000 บาท',
    sponsorSummary: [
      { name: 'เนสกาแฟ', amount: '195,000 บาท' },
    ],
    totalSponsorRevenue: '195,000 บาท',
  },
  {
    id: 'c3',
    title: 'Neon Pulse',
    poster: posterPulseLive,
    date: '28 ตุลาคม 2567',
    revenue: '41.20 M.',
    ticketsSold: '45,000 ใบ',
    location: 'THE ARENA LONDON',
    status: 'ตรวจสอบข้อมูลเสร็จสิ้น',
    lastUpdate: '7 พ.ย. 2567, 13.25 น.',
    sponsors: [
      {
        companyName: 'สิงห์ คอร์เปอเรชั่น',
        logoText: 'SINGHA',
        logoBgColor: '#eab308',
        contractFileName: 'Singha_Contract.PDF',
        packages: [
          { adType: 'ป้ายแขวนเสา', size: 'Size L', count: 20, price: 130000 },
        ],
      },
    ],
    seatingSummary: [
      { zone: 'VIP', seatsSold: '5,000 ที่นั่ง', revenue: '15,000,000 บาท' },
      { zone: 'โซน A', seatsSold: '20,000 ที่นั่ง', revenue: '20,000,000 บาท' },
      { zone: 'โซน B', seatsSold: '20,000 ที่นั่ง', revenue: '10,000,000 บาท' },
    ],
    totalTicketRevenue: '45,000,000 บาท',
    sponsorSummary: [
      { name: 'สิงห์ คอร์เปอเรชั่น', amount: '500,000 บาท' },
    ],
    totalSponsorRevenue: '500,000 บาท',
  },
  {
    id: 'c4',
    title: 'Star Light Festival',
    poster: posterStarlight,
    date: '23-25 สิงหาคม 2566',
    revenue: '41.20 M.',
    ticketsSold: '38,000 ใบ',
    location: 'Cyberport Mainstage',
    status: 'ตรวจสอบข้อมูลเสร็จสิ้น',
    lastUpdate: '30 ก.ย. 2566, 11.31 น.',
    sponsors: [],
    seatingSummary: [
      { zone: 'โซน A', seatsSold: '15,000 ที่นั่ง', revenue: '22,500,000 บาท' },
      { zone: 'โซน B', seatsSold: '23,000 ที่นั่ง', revenue: '23,000,000 บาท' },
    ],
    totalTicketRevenue: '45,500,000 บาท',
    sponsorSummary: [],
    totalSponsorRevenue: '0 บาท',
  },
];
