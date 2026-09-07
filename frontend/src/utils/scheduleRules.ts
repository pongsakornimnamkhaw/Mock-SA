import dayjs, { type Dayjs } from 'dayjs';

export interface TimeRow { startTime: string; endTime: string; }

export function concertDateOptions(startDate?: string, endDate?: string): Dayjs[] {
  if (!startDate || !endDate) return [];
  const start = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).startOf('day');
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return [];
  const dates: Dayjs[] = [];
  for (let current = start; !current.isAfter(end); current = current.add(1, 'day')) dates.push(current);
  return dates;
}

function seconds(value: string): number {
  const [hour, minute, second = '0'] = value.split(':');
  return Number(hour) * 3600 + Number(minute) * 60 + Number(second);
}

export function validateScheduleRows(rows: TimeRow[], concertStart: string, concertEnd: string): string | null {
  const lower = seconds(concertStart);
  const upper = seconds(concertEnd);
  let previousEnd = -1;
  for (let index = 0; index < rows.length; index += 1) {
    const start = seconds(rows[index].startTime);
    const end = seconds(rows[index].endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return `เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุดในลำดับที่ ${index + 1}`;
    if (start < lower || end > upper) return `ลำดับที่ ${index + 1} ต้องอยู่ในช่วงเวลา ${concertStart.slice(0, 5)}–${concertEnd.slice(0, 5)} ของคอนเสิร์ต`;
    if (previousEnd >= 0 && start < previousEnd) return `เวลาแสดงลำดับที่ ${index + 1} ซ้อนกับลำดับก่อนหน้า`;
    previousEnd = end;
  }
  return null;
}
