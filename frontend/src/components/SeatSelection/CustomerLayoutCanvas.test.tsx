import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CustomerLayoutCanvas from './CustomerLayoutCanvas';

const zone = {
    id: 'ZA', kind: 'zone', name: 'VIP', color: '#ff0000', seats: 1, zonePrice: 2500, type: 'VIP', shape: 'rectangle',
    x: 50, y: 50, width: 30, height: 30, rotation: 0, z: 2,
    seatItems: [{ id: 1, name: 'A1', x: 50, y: 50, disabled: false }],
};

describe('CustomerLayoutCanvas', () => {
    it('ขยายที่นั่งของโซนที่เลือกเป็น grid โดยไม่ใช้พิกัดซ้อนกัน', () => {
        render(
            <CustomerLayoutCanvas
                layout={{ zones: [zone], layoutObjects: [] }}
                mode="seats"
                selectedZoneId="ZA"
                seats={[
                    { seatId: 1, id: 'A1', row: '1', number: 1, status: 'available', x: 50, y: 50 },
                    { seatId: 2, id: 'A2', row: '1', number: 2, status: 'available', x: 50, y: 50 },
                    { seatId: 3, id: 'A3', row: '1', number: 3, status: 'available', x: 50, y: 50 },
                ]}
            />,
        );

        const grid = screen.getByTestId('expanded-seat-grid');
        expect(grid).toHaveStyle({ display: 'grid' });
        expect(within(grid).getAllByRole('button')).toHaveLength(3);
    });

    it('ไม่สร้างเวทีเองเมื่อ layoutObjects ว่าง', () => {
        render(<CustomerLayoutCanvas layout={{ zones: [zone], layoutObjects: [] }} inventories={[{ zoneId: 'ZA', zoneType: 'VIP', categoryName: 'VIP', color: '#f00', price: 2500, capacity: 1, available: 1 }]} mode="zones" />);
        expect(screen.queryByText('เวที')).not.toBeInTheDocument();
    });

    it('แสดง LayoutObject ที่บันทึกจริงและปิดโซนที่เต็ม', () => {
        const onZoneClick = vi.fn();
        render(<CustomerLayoutCanvas layout={{ zones: [zone], layoutObjects: [{ id: 'stage', kind: 'object', shape: 'rectangle', name: 'เวที', color: '#333', x: 50, y: 10, width: 30, height: 8, rotation: 0, z: 1 }] }} inventories={[{ zoneId: 'ZA', zoneType: 'VIP', categoryName: 'VIP', color: '#f00', price: 2500, capacity: 1, available: 0 }]} mode="zones" onZoneClick={onZoneClick} />);
        expect(screen.getByText('เวที')).toBeInTheDocument();
        const zoneButton = screen.getByRole('button', { name: /VIP/ });
        expect(zoneButton).toHaveAttribute('aria-disabled', 'true');
        zoneButton.click();
        expect(onZoneClick).not.toHaveBeenCalled();
    });

    it('ทำที่นั่งที่ผู้ใช้อื่น hold ให้กดไม่ได้', () => {
        render(<CustomerLayoutCanvas layout={{ zones: [zone], layoutObjects: [] }} mode="seats" selectedZoneId="ZA" seats={[{ seatId: 1, id: 'A1', row: '1', number: 1, status: 'held', x: 50, y: 50 }]} />);
        expect(screen.getByRole('button', { name: 'ที่นั่ง A1' })).toBeDisabled();
    });

    it('ส่งรหัสที่นั่งเมื่อคลิกที่นั่งว่างใน expanded grid', async () => {
        const user = userEvent.setup();
        const onSeatClick = vi.fn();
        render(<CustomerLayoutCanvas layout={{ zones: [zone], layoutObjects: [] }} mode="seats" selectedZoneId="ZA"
            seats={[{ seatId: 1, id: 'A1', row: '1', number: 1, status: 'available', x: 50, y: 50 }]}
            onSeatClick={onSeatClick} />);

        await user.click(screen.getByRole('button', { name: 'ที่นั่ง A1' }));

        expect(onSeatClick).toHaveBeenCalledOnce();
        expect(onSeatClick).toHaveBeenCalledWith('A1');
    });

    it.each(['held', 'reserved', 'disabled', 'locked'] as const)('ปิดการคลิกสถานะ %s', (status) => {
        render(<CustomerLayoutCanvas layout={{ zones: [zone], layoutObjects: [] }} mode="seats" selectedZoneId="ZA"
            seats={[{ seatId: 1, id: 'A1', row: '1', number: 1, status, x: 50, y: 50 }]} />);
        expect(screen.getByRole('button', { name: 'ที่นั่ง A1' })).toBeDisabled();
    });

    it('ไม่ใช้ expanded grid ในหน้าเลือกโซน', () => {
        render(<CustomerLayoutCanvas layout={{ zones: [zone], layoutObjects: [] }} mode="zones"
            inventories={[{ zoneId: 'ZA', zoneType: 'VIP', categoryName: 'VIP', color: '#f00', price: 2500, capacity: 1, available: 1 }]} />);
        expect(screen.queryByTestId('expanded-seat-grid')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /VIP/ })).toBeEnabled();
    });
});
