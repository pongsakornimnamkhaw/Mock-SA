import React, { useState } from 'react';
import type { PlanningSubTab, ScheduleItem, TimelineStep } from '../../types/contact';
import { StatusTimeline } from '../../components/_frontend/StatusTimeline';
import Box from '@mui/material/Box';

interface PlanningFormProps {
  subTab: PlanningSubTab;
}

export const PlanningForm: React.FC<PlanningFormProps> = ({ subTab }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([
    {
      id: '1',
      date: '5/9/2025',
      time: '8.00 น.',
      officer: 'ผู้จัดเตรียมสถานที่\nผู้จัดงานคอนเสิร์ต',
      task: 'ประชุมวางแผนการจัดสถานที่และเวที',
    },
    {
      id: '2',
      date: '5/9/2025',
      time: '10.00 น.',
      officer: 'ผู้จัดเวที\nผู้จัดงานคอนเสิร์ต',
      task: 'วางแผนงานจัดแสงไฟ และเวที',
    },
  ]);

  const planningTimelineSteps: TimelineStep[] = [
    { id: 1, title: 'ส่งคำขออนุมัติสำเร็จ', time: '15.32 น. 20/15/2025', status: 'completed' },
    { id: 2, title: 'กำลังตรวจสอบข้อมูล', time: '16.20 น. 20/15/2025', status: 'completed' },
    { id: 3, title: 'ตรวจสอบข้อมูลเสร็จสิ้น', time: '17.30 น. 20/15/2025', status: 'current' },
    { id: 4, title: 'รอเงินอนุมัติ', status: 'pending' },
    { id: 5, title: 'เสร็จสิ้น', status: 'pending' },
  ];

  const handleAddScheduleRow = () => {
    const newRow: ScheduleItem = {
      id: Date.now().toString(),
      date: '5/9/2025',
      time: '13.00 น.',
      officer: 'ผู้จัดงานคอนเสิร์ต',
      task: 'ทดสอบระบบเสียงและไฟ',
    };
    setScheduleItems([...scheduleItems, newRow]);
  };

  const handleItemChange = (id: string, field: keyof ScheduleItem, value: string) => {
    setScheduleItems(
      scheduleItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRequestApproval = () => {
    alert('ส่งคำขออนุมัติแผนงานแก่ Organizer เรียบร้อยแล้ว!');
  };

  if (subTab === 'status') {
    return (
      <StatusTimeline
        title="สถานะการขออนุมัติ"
        steps={planningTimelineSteps}
      />
    );
  }

  return (
    <Box component="section" className="panel-section active">
      {/* Top Header Action Buttons */}
      <div className="planning-top-actions">
        <div className="tab-pill-group">
          <button
            type="button"
            className={`tab-pill ${!isEditing ? 'active' : ''}`}
            onClick={() => setIsEditing(false)}
          >
            รายละเอียด
          </button>
          <button
            type="button"
            className={`tab-pill ${isEditing ? 'active' : ''}`}
            onClick={() => setIsEditing(true)}
          >
            Edit
          </button>
        </div>

        <button
          type="button"
          className="btn-request-approval"
          onClick={handleRequestApproval}
        >
          ขออนุมัติ
        </button>
      </div>

      {/* Operation Schedule Table */}
      <div className="schedule-table-section">
        <h3 className="section-sub-title">ตารางการดำเนินการ</h3>

        <div className="table-responsive">
          <table className="schedule-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>วัน/เดือน/ปี</th>
                <th style={{ width: '12%' }}>เวลา</th>
                <th style={{ width: '30%' }}>เจ้าหน้าที่</th>
                <th style={{ width: '43%' }}>การดำเนินงาน</th>
              </tr>
            </thead>
            <tbody>
              {scheduleItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        className="table-input"
                        value={item.date}
                        onChange={(e) => handleItemChange(item.id, 'date', e.target.value)}
                      />
                    ) : (
                      item.date
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        className="table-input"
                        value={item.time}
                        onChange={(e) => handleItemChange(item.id, 'time', e.target.value)}
                      />
                    ) : (
                      <strong>{item.time}</strong>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <textarea
                        className="table-input"
                        value={item.officer}
                        onChange={(e) => handleItemChange(item.id, 'officer', e.target.value)}
                      />
                    ) : (
                      <span style={{ whiteSpace: 'pre-line' }}>{item.officer}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        className="table-input"
                        value={item.task}
                        onChange={(e) => handleItemChange(item.id, 'task', e.target.value)}
                      />
                    ) : (
                      item.task
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isEditing && (
          <button
            type="button"
            className="btn-add-more"
            style={{ marginTop: '12px' }}
            onClick={handleAddScheduleRow}
          >
            Add + เพิ่มการดำเนินงาน
          </button>
        )}
      </div>

      {/* Seating & Zone Layout Diagram */}
      <div className="seating-diagram-section" style={{ marginTop: '36px' }}>
        <h3 className="section-sub-title">แผนผังวางเก้าอี้</h3>

        <div className="diagram-card">
          <div className="diagram-main">
            {/* Stage Bar */}
            <div className="stage-bar">State</div>

            {/* Zone Grid */}
            <div className="zone-grid-layout">
              {/* Row A */}
              <div className="zone-row">
                <div className="zone-block zone-red">A1</div>
                <div className="zone-block zone-red">A2</div>
              </div>

              {/* Row B */}
              <div className="zone-row" style={{ marginTop: '12px' }}>
                <div className="zone-block zone-green">B1</div>
                <div className="zone-block zone-green">B2</div>
                <div className="zone-block zone-green">B3</div>
                <div className="zone-block zone-yellow">B4</div>
              </div>
            </div>
          </div>

          {/* Pricing Legend */}
          <div className="diagram-legend">
            <div className="legend-item">
              <span className="legend-box zone-red" />
              <span>2,000 บ.</span>
            </div>
            <div className="legend-item">
              <span className="legend-box zone-green" />
              <span>1,500 บ.</span>
            </div>
            <div className="legend-item">
              <span className="legend-box zone-yellow" />
              <span>1,000 บ.</span>
            </div>
          </div>
        </div>
      </div>
    </Box>
  );
};
