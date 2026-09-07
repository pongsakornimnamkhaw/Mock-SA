import React, { useEffect, useState } from 'react';
import type { PlanningSubTab, ScheduleItem, TimelineStep } from '../../types/contact';
import { StatusTimeline } from '../../components/_frontend/StatusTimeline';
import Box from '@mui/material/Box';
import { workPlanApi } from '../../api/reportApi';

interface PlanningFormProps {
  subTab: PlanningSubTab;
}

export const PlanningForm: React.FC<PlanningFormProps> = ({ subTab }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [concertId, setConcertId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const [planningTimelineSteps, setPlanningTimelineSteps] = useState<TimelineStep[]>([]);

  useEffect(() => {
    workPlanApi.getCurrent()
      .then((data) => {
        setConcertId(data.concert_id);
        if (data.schedule.length > 0) setScheduleItems(data.schedule);
        setPlanningTimelineSteps(data.timeline);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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

  const handleRequestApproval = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await workPlanApi.submit(concertId, scheduleItems);
      setPlanningTimelineSteps(data.timeline);
      setIsEditing(false);
      alert('ส่งคำขออนุมัติแผนงานแก่ Organizer เรียบร้อยแล้ว!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งคำขอไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleEditToggle = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const data = await workPlanApi.save(concertId, scheduleItems);
      setPlanningTimelineSteps(data.timeline);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกแผนงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  if (subTab === 'status') {
    if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}>กำลังโหลดสถานะ...</Box>;
    if (error) return <Box sx={{ p: 5, textAlign: 'center', color: 'error.main' }}>{error}</Box>;
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
            onClick={handleEditToggle}
            disabled={loading || !concertId}
          >
            {isEditing ? 'บันทึก' : 'Edit'}
          </button>
        </div>

        <button
          type="button"
          className="btn-request-approval"
          onClick={handleRequestApproval}
          disabled={loading || !concertId}
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
