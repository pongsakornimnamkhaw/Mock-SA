import { useState } from 'react'

// Mock results from the original registration system. These keep the page
// usable in frontend-only mode until a check-in API is connected.
const SCAN_RESULTS = {
  success: {
    tone: 'success',
    symbol: '✓',
    title: 'ลงทะเบียนสำเร็จ',
    subtitle: 'เช็คอินเรียบร้อย · ยินดีต้อนรับเข้าสู่งาน',
    details: [['งานแสดง', 'NEON PULSE · Live in Concert'], ['ผู้ถือบัตร', 'สมหญิง ใจดี'], ['รหัสบัตร', '#TK-2026-0459'], ['โซน / ที่นั่ง', 'D2 · CE49']],
  },
  used: {
    tone: 'warning',
    symbol: '!',
    title: 'บัตรนี้ถูกใช้ไปแล้ว',
    subtitle: 'เช็คอินเมื่อ 20 ก.ย. 2026 · 14:32 น.',
    details: [['งานแสดง', 'NEON PULSE · Live in Concert'], ['ผู้ถือบัตร', 'สมหญิง ใจดี'], ['รหัสบัตร', '#TK-2026-0459'], ['โซน / ที่นั่ง', 'D2 · CE50']],
  },
  invalid: {
    tone: 'danger',
    symbol: '×',
    title: 'ไม่พบบัตรนี้ในระบบ',
    subtitle: 'กรุณาตรวจสอบ QR หรือรหัสบัตรอีกครั้ง',
    details: [['รหัสที่สแกน', '#TK-2026-9999'], ['ผู้ถือบัตร', '-'], ['สถานะ', 'ไม่พบข้อมูล'], ['โซน / ที่นั่ง', '-']],
  },
}

function ManagerModal({ onClose, onConfirm }) {
  return <div className="reg-modal-backdrop" onMouseDown={onClose}>
    <section className="reg-modal" onMouseDown={event => event.stopPropagation()}>
      <div className="reg-manager-icon">!</div>
      <h2>ยืนยันการแจ้งผู้จัดการ?</h2>
      <p>ระบบจะส่งรายละเอียดบัตรและจุดตรวจนี้ให้ผู้จัดการเพื่อดำเนินการต่อ</p>
      <div className="reg-modal-actions">
        <button type="button" onClick={onClose}>ยกเลิก</button>
        <button type="button" className="primary" onClick={onConfirm}>ยืนยันการแจ้ง</button>
      </div>
    </section>
  </div>
}

function ScanStatus({ resultKey, onScanAgain }) {
  const result = SCAN_RESULTS[resultKey]
  const [confirming, setConfirming] = useState(false)
  const [notified, setNotified] = useState(false)

  return <div className="reg-root">
    <main className="reg-status-page">
      <section className={`reg-ticket-card ${result.tone}`}>
        <div className="reg-status-icon">{result.symbol}</div>
        <h1>{result.title}</h1>
        <p className="reg-subtitle">{result.subtitle}</p>
        <div className="reg-divider" />
        <dl>{result.details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <button type="button" className="reg-button scan" onClick={onScanAgain}>{resultKey === 'invalid' ? 'ลองสแกนอีกครั้ง' : 'สแกนใบถัดไป'}</button>
      </section>
    </main>
    {resultKey !== 'success' && <button type="button" className="reg-manager-button" onClick={() => setConfirming(true)}>{notified ? 'แจ้งผู้จัดการแล้ว ✓' : 'ติดต่อผู้จัดการ'}</button>}
    {confirming && <ManagerModal onClose={() => setConfirming(false)} onConfirm={() => { setConfirming(false); setNotified(true) }} />}
  </div>
}

function ScanSimulator({ onSelect }) {
  const [ticketCode, setTicketCode] = useState('#TK-2026-0459')

  return <div className="reg-root">
    <main className="reg-simulator-page">
      <section className="reg-intro">
        <span>SCAN SIMULATOR</span>
        <h1>จำลองการสแกนบัตร</h1>
        <p>เลือกรูปแบบผลลัพธ์เพื่อทดสอบหน้าสถานะของระบบลงทะเบียน</p>
      </section>
      <section className="reg-scanner-card">
        <div className="reg-qr-frame"><i>▦</i><b /></div>
        <label htmlFor="reg-ticket-code">รหัสบัตร</label>
        <input id="reg-ticket-code" value={ticketCode} onChange={event => setTicketCode(event.target.value)} />
        <p className="reg-helper">เลือกผลลัพธ์ที่ต้องการจำลอง</p>
        <div className="reg-choices">
          <button type="button" className="success" onClick={() => onSelect('success')}><b>✓</b><span><strong>ลงทะเบียนสำเร็จ</strong><small>บัตรถูกต้องและยังไม่เคยใช้</small></span><em>›</em></button>
          <button type="button" className="warning" onClick={() => onSelect('used')}><b>!</b><span><strong>บัตรถูกใช้แล้ว</strong><small>พบบันทึกการเช็คอินก่อนหน้า</small></span><em>›</em></button>
          <button type="button" className="danger" onClick={() => onSelect('invalid')}><b>×</b><span><strong>ไม่พบบัตรในระบบ</strong><small>QR หรือรหัสบัตรไม่ถูกต้อง</small></span><em>›</em></button>
        </div>
      </section>
    </main>
  </div>
}

export default function RegistrationApp() {
  const [page, setPage] = useState('simulator')
  return page === 'simulator'
    ? <ScanSimulator onSelect={setPage} />
    : <ScanStatus resultKey={page} onScanAgain={() => setPage('simulator')} />
}
