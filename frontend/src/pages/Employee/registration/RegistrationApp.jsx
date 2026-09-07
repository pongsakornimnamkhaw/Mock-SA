import { useState } from 'react'
import { checkInTicket, reportCheckInIssue } from './api'

const toneSymbols = { success: '✓', used: '!', invalid: '×' }

function ManagerModal({ busy, onClose, onConfirm }) {
  return <div className="reg-modal-backdrop" onMouseDown={busy ? undefined : onClose}>
    <section className="reg-modal" onMouseDown={event => event.stopPropagation()}>
      <div className="reg-manager-icon">!</div>
      <h2>ยืนยันการแจ้งผู้จัดการ?</h2>
      <p>ระบบจะบันทึกรหัสบัตรและผลการตรวจสอบไว้ในประวัติกิจกรรม เพื่อให้ผู้จัดการดำเนินการต่อ</p>
      <div className="reg-modal-actions">
        <button type="button" disabled={busy} onClick={onClose}>ยกเลิก</button>
        <button type="button" disabled={busy} className="primary" onClick={onConfirm}>{busy ? 'กำลังแจ้ง...' : 'ยืนยันการแจ้ง'}</button>
      </div>
    </section>
  </div>
}

function ScanStatus({ result, onScanAgain }) {
  const [confirming, setConfirming] = useState(false)
  const [notified, setNotified] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportError, setReportError] = useState('')

  const notifyManager = async () => {
    setReporting(true)
    setReportError('')
    try {
      await reportCheckInIssue(result.ticketCode, result.result)
      setNotified(true)
      setConfirming(false)
    } catch (error) {
      setReportError(error.message)
      setConfirming(false)
    } finally {
      setReporting(false)
    }
  }

  return <div className="reg-root">
    <main className="reg-status-page">
      <section className={`reg-ticket-card ${result.result}`}>
        <div className="reg-status-icon">{toneSymbols[result.result] || '?'}</div>
        <h1>{result.title}</h1>
        <p className="reg-subtitle">{result.subtitle}</p>
        {reportError && <p className="reg-error" role="alert">{reportError}</p>}
        <div className="reg-divider" />
        <dl>{(result.details || []).map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value || '-'}</dd></div>)}</dl>
        <button type="button" className="reg-button scan" onClick={onScanAgain}>สแกนใบถัดไป</button>
      </section>
    </main>
    {result.result !== 'success' && <button type="button" disabled={notified || reporting} className="reg-manager-button" onClick={() => setConfirming(true)}>{notified ? 'แจ้งผู้จัดการแล้ว ✓' : 'ติดต่อผู้จัดการ'}</button>}
    {confirming && <ManagerModal busy={reporting} onClose={() => setConfirming(false)} onConfirm={notifyManager} />}
  </div>
}

function TicketScanner({ busy, error, onScan }) {
  const [ticketCode, setTicketCode] = useState('')

  const submit = event => {
    event.preventDefault()
    onScan(ticketCode)
  }

  return <div className="reg-root">
    <main className="reg-simulator-page">
      <section className="reg-intro">
        <span>EVENT CHECK-IN</span>
        <h1>ลงทะเบียนเข้างาน</h1>
        <p>กรอกรหัสจาก QR Code หรือรหัส Ticket เพื่อยืนยันการเข้างาน</p>
      </section>
      <form className="reg-scanner-card" onSubmit={submit}>
        <div className="reg-qr-frame"><i>▦</i><b /></div>
        <label htmlFor="reg-ticket-code">รหัสบัตร</label>
        <input
          id="reg-ticket-code"
          value={ticketCode}
          disabled={busy}
          placeholder="เช่น 1 หรือ TK-000001"
          autoComplete="off"
          onChange={event => setTicketCode(event.target.value)}
        />
        <p className="reg-helper">รองรับ Ticket ID แบบตัวเลข และรูปแบบ TK-000001</p>
        {error && <p className="reg-error" role="alert">{error}</p>}
        <button type="submit" className="reg-button scan" disabled={busy || !ticketCode.trim()}>{busy ? 'กำลังตรวจสอบ...' : 'ตรวจสอบและลงทะเบียน'}</button>
      </form>
    </main>
  </div>
}

export default function RegistrationApp() {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const scanTicket = async ticketCode => {
    setBusy(true)
    setError('')
    try {
      setResult(await checkInTicket(ticketCode))
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  const scanAgain = () => {
    setResult(null)
    setError('')
  }

  return result
    ? <ScanStatus result={result} onScanAgain={scanAgain} />
    : <TicketScanner busy={busy} error={error} onScan={scanTicket} />
}
