import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { registrationApi } from './api'
import { STATUS_EXAMPLES } from './statusExamples'
import { formatTicketCode, normalizeTicketCode } from './ticketCode'
import { runAutomaticCheckIn } from './checkInFlow'

const SAMPLE_TICKET = { ticketId:'TK-2026-0459',concertName:'Acoustic Sessions: Bangkok',zoneType:'B',seatRow:'B',seatColumn:'24',ticketStatus:'VALID' }
const formatDateTime = value => value ? new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'medium'}).format(new Date(value)) : '-'

function LoadingState({ text='กำลังโหลดข้อมูล...' }) { return <div className="reg-loading"><span/> {text}</div> }

function ConcertPicker({ onSelect }) {
  const [concerts,setConcerts] = useState([])
  const [query,setQuery] = useState('')
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  useEffect(() => { let active=true; registrationApi.listConcerts().then(rows => active && setConcerts(Array.isArray(rows)?rows:[])).catch(() => active && setError('ไม่สามารถโหลดรายการคอนเสิร์ตได้')).finally(() => active && setLoading(false)); return () => { active=false } },[])
  const filtered = useMemo(() => concerts.filter(item => `${item.name} ${item.location}`.toLowerCase().includes(query.toLowerCase())),[concerts,query])
  return <main className="reg-page reg-select-page">
    <header className="reg-page-heading"><div><span>EVENT CHECK-IN</span><h1>เลือกคอนเสิร์ต</h1><p>เลือกคอนเสิร์ตเพื่อจัดการการลงทะเบียนเข้างาน</p></div></header>
    <section className="reg-search-card"><label>ค้นหาคอนเสิร์ต<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="ชื่อคอนเสิร์ต หรือสถานที่..."/></label></section>
    {loading ? <LoadingState/> : error ? <div className="reg-empty">{error}</div> : <section className="reg-concert-list">{filtered.map(concert => <article key={concert.id}><div className="reg-concert-poster">{concert.cover?<img src={concert.cover} alt=""/>:<><small>LIVE</small><b>{concert.name}</b></>}</div><div><h2>{concert.name}</h2><p>{concert.location||'-'} · {concert.date||'-'}</p></div><span className="reg-plan-pill">{concert.status||'ไม่ระบุสถานะ'}</span><button type="button" onClick={()=>onSelect(concert)}>เลือกคอนเสิร์ต</button></article>)}{!filtered.length&&<div className="reg-empty">ไม่พบคอนเสิร์ต</div>}</section>}
  </main>
}

function Dashboard({ concert,gateId,setGateId,onBack,onScan,onExamples }) {
  const [dashboard,setDashboard] = useState(null)
  const [error,setError] = useState('')
  useEffect(() => { let active=true; registrationApi.dashboard(concert.id).then(data=>active&&setDashboard(data)).catch(()=>active&&setError('ยังไม่มีข้อมูลบัตรสำหรับคอนเสิร์ตนี้')); return()=>{active=false} },[concert.id])
  const total=dashboard?.totalTickets||0, checked=dashboard?.checkedIn||0, remaining=dashboard?.remaining||Math.max(0,total-checked)
  const gates=dashboard?.gates||[1,2,3,4].map(id=>({gateId:id,checkedIn:0,percentage:0}))
  return <main className="reg-page reg-dashboard">
    <header className="reg-dashboard-header"><div><button className="reg-back" onClick={onBack}>← เปลี่ยนคอนเสิร์ต</button><h1>ระบบลงทะเบียนเข้างาน</h1><p><b>{concert.name}</b> · {concert.date||'-'}</p></div><div className="reg-header-actions"><label>ประตู<select value={gateId} onChange={event=>setGateId(Number(event.target.value))}>{[1,2,3,4].map(id=><option key={id} value={id}>ประตู {String.fromCharCode(64+id)}</option>)}</select></label><button className="reg-outline-button" onClick={onExamples}>ตัวอย่างสถานะ</button><button className="reg-primary-button" onClick={onScan}>สแกนและค้นหาบัตร</button></div></header>
    {error&&<div className="reg-notice">{error}</div>}
    <section className="reg-metric-grid"><article className="pink"><span>ผู้เข้างานแล้ว</span><strong>{checked.toLocaleString('th-TH')} <small>คน</small></strong><p>จาก {total.toLocaleString('th-TH')} คน</p></article><article className="green"><span>คงเหลือ</span><strong>{remaining.toLocaleString('th-TH')} <small>คน</small></strong><p>{total?((remaining/total)*100).toFixed(1):'0.0'}%</p></article>{gates.map(gate=><article key={gate.gateId}><span>ประตู {String.fromCharCode(64+gate.gateId)}</span><strong>{gate.checkedIn.toLocaleString('th-TH')} <small>คน</small></strong><p>{Number(gate.percentage||0).toFixed(1)}%</p></article>)}</section>
    <section className="reg-dashboard-main"><article className="reg-scan-callout"><div className="reg-ticket-visual"><div>ADMISSION TICKET</div><b>{concert.name}</b><span>▦</span></div><div><span className="reg-online">● อุปกรณ์สแกนออนไลน์</span><h2>พร้อมรับผู้เข้าร่วมงาน</h2><p>สแกน QR Code หรือกรอกรหัสบัตรเพื่อตรวจสอบและบันทึกการเข้างาน</p><button className="reg-primary-button" onClick={onScan}>เปิดหน้าสแกนบัตร →</button></div></article><article className="reg-gate-summary"><h2>ประตูที่เลือก</h2><strong>ประตู {String.fromCharCode(64+gateId)}</strong><p>รายการเช็คอินทั้งหมดจะบันทึกด้วยประตูนี้</p><button className="reg-outline-button" onClick={onExamples}>ดูตัวอย่างสถานะทั้ง 4 แบบ</button></article></section>
    <section className="reg-recent"><div><h2>รายการเข้างานล่าสุด</h2><span>{dashboard?.recent?.length||0} รายการ</span></div><div className="reg-recent-head"><span>เวลาเข้าระบบ</span><span>รหัสบัตร</span><span>โซน / ที่นั่ง</span><span>ประตู</span><span>สถานะ</span></div>{dashboard?.recent?.map(row=><div className="reg-recent-row" key={`${row.ticketId}-${row.checkedInAt}`}><span>{formatDateTime(row.checkedInAt)}</span><b>#{formatTicketCode(row.ticketId)}</b><span>{row.zoneType} · {row.seatRow}-{row.seatColumn}</span><span>ประตู {String.fromCharCode(64+row.gateId)}</span><em>ผ่านการตรวจสอบ</em></div>)}{!dashboard?.recent?.length&&<div className="reg-empty">ยังไม่มีรายการเข้างาน</div>}</section>
  </main>
}

function TicketDetails({ ticket }) { return <dl className="reg-ticket-details"><div><dt>งานแสดง</dt><dd>{ticket.concertName||'-'}</dd></div><div><dt>รหัสบัตร</dt><dd>#{formatTicketCode(ticket.ticketId)}</dd></div><div><dt>โซน / ที่นั่ง</dt><dd>{ticket.zoneType||'-'} · {ticket.seatRow||'-'}-{ticket.seatColumn||'-'}</dd></div><div><dt>สถานะบัตร</dt><dd>{ticket.ticketStatus||'-'}</dd></div></dl> }

function Scanner({ concert,gateId,onBack,onResult }) {
  const videoRef=useRef(null),streamRef=useRef(null),scanLock=useRef(false),lookupBusyRef=useRef(false),zxingControlsRef=useRef(null)
  const [ticketCode,setTicketCode]=useState(''),[cameraState,setCameraState]=useState('requesting'),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const lookup=useCallback(async raw=>{
    const code=normalizeTicketCode(raw)
    if(!code||lookupBusyRef.current)return
    lookupBusyRef.current=true;scanLock.current=true;setBusy(true);setError('')
    try{onResult(await runAutomaticCheckIn(raw,concert.id,gateId,registrationApi))}
    catch{setError('ไม่สามารถเชื่อมต่อ Server ได้ กรุณาลองอีกครั้ง');scanLock.current=false}
    finally{lookupBusyRef.current=false;setBusy(false)}
  },[concert.id,gateId,onResult])
  useEffect(()=>{
    let stopped=false,frame=0
    const startCamera=async()=>{
      const isLocal=['localhost','127.0.0.1','::1'].includes(window.location.hostname)
      if(!window.isSecureContext&&!isLocal){setCameraState('insecure');return}
      if(!navigator.mediaDevices?.getUserMedia){setCameraState('unsupported');return}
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})
        if(stopped){stream.getTracks().forEach(track=>track.stop());return}
        streamRef.current=stream
        if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play().catch(()=>{})}
        setCameraState('active')
        if('BarcodeDetector'in window){
          const detector=new window.BarcodeDetector({formats:['qr_code']})
          const detect=async()=>{if(stopped)return;try{const codes=videoRef.current?.readyState>=2?await detector.detect(videoRef.current):[];if(codes[0]?.rawValue&&!scanLock.current){setTicketCode(codes[0].rawValue);await lookup(codes[0].rawValue)}}catch{/* manual entry remains available */}frame=requestAnimationFrame(detect)}
          frame=requestAnimationFrame(detect)
        }else if(videoRef.current){
          const reader=new BrowserQRCodeReader()
          zxingControlsRef.current=await reader.decodeFromStream(stream,videoRef.current,result=>{const raw=result?.getText();if(raw&&!scanLock.current){setTicketCode(raw);void lookup(raw)}})
        }
      }catch(cameraError){setCameraState(cameraError?.name==='NotAllowedError'?'denied':'unavailable')}
    }
    void startCamera()
    return()=>{stopped=true;cancelAnimationFrame(frame);zxingControlsRef.current?.stop();streamRef.current?.getTracks().forEach(track=>track.stop())}
  },[lookup])
  const cameraMessage=cameraState==='denied'?'ไม่ได้รับสิทธิ์เปิดกล้อง':cameraState==='unsupported'?'อุปกรณ์นี้ไม่รองรับกล้อง':cameraState==='insecure'?'กล้องใช้งานได้เฉพาะ localhost หรือ HTTPS':cameraState==='active'?'':'กำลังเปิดกล้อง...'
  return <main className="reg-page reg-scanner-page"><header className="reg-dashboard-header"><div><button className="reg-back" onClick={onBack}>← กลับไปหน้าภาพรวม</button><h1>สแกนและค้นหาบัตร</h1><p><b>{concert.name}</b> · ประตู {String.fromCharCode(64+gateId)}</p></div><span className={`reg-camera-status ${cameraState}`}>{cameraState==='active'?'● กล้องพร้อมใช้งาน':cameraState==='requesting'?'กำลังขอสิทธิ์กล้อง...':'ใช้การกรอกรหัสบัตร'}</span></header>{error&&<div className="reg-notice">{error}</div>}<section className="reg-scan-workspace"><div className="reg-camera-panel"><h2>สแกน QR Code</h2><p>วาง QR Code ให้อยู่ในกรอบ ระบบจะตรวจและเช็กอินทันที</p><div className="reg-live-camera"><video ref={videoRef} playsInline muted/><div className="reg-scan-corners"/><i/><span>{cameraMessage}</span></div></div><div className="reg-lookup-panel"><h2>หรือค้นหาด้วยรหัสบัตร</h2><label>รหัสบัตรหรือ QR payload<input value={ticketCode} onChange={event=>{setTicketCode(event.target.value);scanLock.current=false}} onKeyDown={event=>event.key==='Enter'&&lookup(ticketCode)} placeholder="เช่น 45, TK-45 หรือ OCTAVIA|45|..."/></label><button className="reg-primary-button" disabled={!ticketCode.trim()||busy} onClick={()=>lookup(ticketCode)}>{busy?'กำลังตรวจสอบและเช็กอิน...':'ตรวจสอบและเช็กอิน'}</button></div></section></main>
}

function StatusPage({ tone,ticket=SAMPLE_TICKET,message,onBack }) { const example=STATUS_EXAMPLES.find(item=>item.tone===tone)||STATUS_EXAMPLES[2];const description=message||(tone==='warning'&&ticket.checkedInAt?`เช็คอินเมื่อ ${formatDateTime(ticket.checkedInAt)}`:example.description);return <main className="reg-status-page"><section className={`reg-ticket-card ${tone}`}><div className="reg-status-icon">{example.symbol}</div><h1>{example.title}</h1><p className="reg-subtitle">{description}</p><div className="reg-divider"/><TicketDetails ticket={ticket}/><button className="reg-button scan" onClick={onBack}>{tone==='danger'?'ลองสแกนอีกครั้ง':'สแกนใบถัดไป'}</button></section></main> }

function StatusExamples({ onBack }) { return <main className="reg-page reg-examples"><header className="reg-page-heading"><div><button className="reg-back" onClick={onBack}>← กลับไปหน้า Dashboard</button><span>STATUS PREVIEW</span><h1>ตัวอย่างสถานะในระบบ</h1><p>หน้านี้เป็นเพียงตัวอย่างและไม่บันทึกการเข้างาน</p></div></header><section className="reg-example-grid">{STATUS_EXAMPLES.map(example=><article className={example.tone} key={example.key}><div>{example.symbol}</div><h2>{example.title}</h2><p>{example.description}</p><TicketDetails ticket={{...SAMPLE_TICKET,ticketId:example.key==='not-found'?'TK-2026-9999':SAMPLE_TICKET.ticketId,ticketStatus:example.ticketStatus}}/></article>)}</section></main> }

export default function RegistrationApp(){const[page,setPage]=useState('select'),[concert,setConcert]=useState(null),[gateId,setGateId]=useState(1),[result,setResult]=useState(null);if(page==='select'||!concert)return <ConcertPicker onSelect={item=>{setConcert(item);setPage('dashboard')}}/>;if(page==='scanner')return <Scanner concert={concert} gateId={gateId} onBack={()=>setPage('dashboard')} onResult={next=>{setResult(next);setPage('status')}}/>;if(page==='examples')return <StatusExamples onBack={()=>setPage('dashboard')}/>;if(page==='status')return <StatusPage tone={result?.tone||'danger'} ticket={result?.ticket} message={result?.message} onBack={()=>setPage('scanner')}/>;return <Dashboard concert={concert} gateId={gateId} setGateId={setGateId} onBack={()=>setPage('select')} onScan={()=>setPage('scanner')} onExamples={()=>setPage('examples')}/>}
