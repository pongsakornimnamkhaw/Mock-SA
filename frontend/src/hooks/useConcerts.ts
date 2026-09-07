import { useEffect, useState } from 'react'
import { getConcertById, listConcerts, listFeaturedConcerts } from '@/services/https/concerts'
import type { Concert } from '@/interface/IConcertInterface'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

const INITIAL: AsyncState<never> = { data: null, loading: true, error: null }

// เก็บผลลัพธ์คู่กับ "key" ของ deps ที่ใช้ตอนขอ เพื่อรู้ว่าผลลัพธ์ที่ค้างอยู่เป็นของ
// deps ชุดปัจจุบันหรือของชุดก่อนหน้า (ยังไม่ตอบกลับ) โดยไม่ต้อง setState แบบ
// synchronous ใน effect (ซึ่ง react-hooks/set-state-in-effect ไม่อนุญาต)
function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const key = JSON.stringify(deps)
  const [result, setResult] = useState<{ key: string; state: AsyncState<T> }>(() => ({
    key,
    state: INITIAL,
  }))

  useEffect(() => {
    let active = true
    load()
      .then((data) => {
        if (active) setResult({ key, state: { data, loading: false, error: null } })
      })
      .catch((error: Error) => {
        if (active) setResult({ key, state: { data: null, loading: false, error } })
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return result.key === key ? result.state : INITIAL
}

export function useConcerts(): AsyncState<Concert[]> {
  return useAsync(listConcerts, [])
}

export function useFeaturedConcerts(): AsyncState<Concert[]> {
  return useAsync(listFeaturedConcerts, [])
}

export function useConcert(concertId: string | undefined): AsyncState<Concert> {
  return useAsync<Concert>(
    () =>
      concertId
        ? getConcertById(concertId).then(
            (concert) => concert ?? Promise.reject(new Error('ไม่พบคอนเสิร์ตที่ต้องการ')),
          )
        : Promise.reject(new Error('ไม่พบรหัสคอนเสิร์ต')),
    [concertId],
  )
}
