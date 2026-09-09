import { useEffect, useState } from 'react';
import { customerPromotionApi } from '@/api/customerPromotionApi';
import type { CustomerEvent } from '@/data/customerEvents';
import { toCustomerEvent } from '@/utils/customerConcertCard';

export interface CustomerConcertsState {
    concerts: CustomerEvent[];
    loading: boolean;
    error: string;
}

/** โหลดคอนเสิร์ตที่เปิดให้ลูกค้าจอง ใช้ร่วมกันระหว่างหน้ารวมงานกับช่องค้นหาบนหัวเว็บ */
export function useCustomerConcerts(): CustomerConcertsState {
    const [state, setState] = useState<CustomerConcertsState>({ concerts: [], loading: true, error: '' });

    useEffect(() => {
        let active = true;
        customerPromotionApi.listConcerts()
            .then(({ data }) => {
                if (active) setState({ concerts: data.map(toCustomerEvent), loading: false, error: '' });
            })
            .catch((reason) => {
                if (!active) return;
                setState({
                    concerts: [],
                    loading: false,
                    error: reason instanceof Error ? reason.message : 'ไม่สามารถโหลดคอนเสิร์ตได้',
                });
            });
        return () => { active = false; };
    }, []);

    return state;
}
