import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, CheckIcon, CloseIcon, PlusIcon, SaveIcon, SearchIcon, TrashIcon, UploadIcon, UsersIcon } from './icons'
import { blankConcert, initialConcerts } from './seed'
import { clearConcertLayout, loadConcerts, saveConcertLayout, saveConcertPlan, saveTicketDesign } from './api'
import { nextLayerOrder } from './layerOrder'
import { normalizeZoneForEditor, seatKey } from './zoneData'

const STORAGE_KEY = 'octavia-concerts-v1'

function useStoredConcerts() {
  const [concerts, setConcerts] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      return Array.isArray(stored) ? stored.map(hydrateConcert) : initialConcerts.map(hydrateConcert)
    }
    catch { return initialConcerts }
  })
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(concerts)) }
    catch (error) { console.warn('ไม่สามารถบันทึกข้อมูลลง localStorage ได้', error) }
  }, [concerts])
  useEffect(() => {
	let active = true
	loadConcerts().then(rows => {
	  if (!active || !Array.isArray(rows)) return
	  setConcerts(rows.map(hydrateConcert))
	})
	return () => { active = false }
  }, [])
  return [concerts, setConcerts]
}

const hydrateConcert = concert => ({
  ...blankConcert(), ...concert,
  date: normalizeDateOnly(concert.date),
  endDate: normalizeDateOnly(concert.endDate),
  rounds: concert.rounds || [],
  publishing: { ...blankConcert().publishing, ...(concert.publishing || {}) },
  zones: (concert.zones || []).map(normalizeZoneForEditor),
  layoutObjects: concert.layoutObjects || [],
  ticketLayoutObjects: concert.ticketLayoutObjects || [],
})

const normalizeDateOnly = value => typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : ''

const RESIZE_DIRECTIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const keepImageInsideCanvas = item => item.kind !== 'image' ? item : {
  ...item,
  x: clamp(Number(item.x), Number(item.width) / 2, 100 - Number(item.width) / 2),
  y: clamp(Number(item.y), Number(item.height) / 2, 100 - Number(item.height) / 2),
}

function startResize(event, item, direction, canvas, onChange) {
  event.preventDefault()
  event.stopPropagation()
  const rect = canvas.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  const startWidth = Number(item.width || 12)
  const startHeight = Number(item.height || 12)
  const minWidth = item.shape === 'line' ? 2 : 4
  const minHeight = item.shape === 'line' ? 0.6 : 4
  const move = pointer => {
    const deltaX = (pointer.clientX - startX) / rect.width * 100
    const deltaY = (pointer.clientY - startY) / rect.height * 100
    let width = startWidth
    let height = startHeight
    const preserveImageRatio = item.kind === 'image' && direction.length === 2
    if (direction.includes('e')) {
      width = clamp(startWidth + deltaX, minWidth, 96)
    }
    if (direction.includes('w')) {
      width = clamp(startWidth - deltaX, minWidth, 96)
    }
    if (direction.includes('s')) {
      height = clamp(startHeight + deltaY, minHeight, 96)
    }
    if (direction.includes('n')) {
      height = clamp(startHeight - deltaY, minHeight, 96)
    }
    if (preserveImageRatio) {
      const pixelAspect = Number(item.aspectRatio) || (startWidth * rect.width) / (startHeight * rect.height)
      if (Math.abs(pointer.clientX - startX) >= Math.abs(pointer.clientY - startY)) {
        height = width * rect.width / (pixelAspect * rect.height)
        if (height > 96) { height = 96; width = height * pixelAspect * rect.height / rect.width }
        if (height < minHeight) { height = minHeight; width = height * pixelAspect * rect.height / rect.width }
      } else {
        width = height * pixelAspect * rect.height / rect.width
        if (width > 96) { width = 96; height = width * rect.width / (pixelAspect * rect.height) }
        if (width < minWidth) { width = minWidth; height = width * rect.width / (pixelAspect * rect.height) }
      }
    }
    let x = Number(item.x)
    let y = Number(item.y)
    if (direction.includes('e')) x += (width - startWidth) / 2
    if (direction.includes('w')) x += (startWidth - width) / 2
    if (direction.includes('s')) y += (height - startHeight) / 2
    if (direction.includes('n')) y += (startHeight - height) / 2
    onChange(keepImageInsideCanvas({ ...item, width, height, x: clamp(x, 1, 99), y: clamp(y, 1, 99) }))
  }
  const stop = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
}

function startRotate(event, item, canvas, onChange) {
  event.preventDefault()
  event.stopPropagation()
  const rect = canvas.getBoundingClientRect()
  const centerX = rect.left + Number(item.x) / 100 * rect.width
  const centerY = rect.top + Number(item.y) / 100 * rect.height
  const move = pointer => {
    const rotation = Math.round(Math.atan2(pointer.clientY - centerY, pointer.clientX - centerX) * 180 / Math.PI + 90)
    onChange({ ...item, rotation })
  }
  const stop = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
}

function TransformHandles({ item, canvasRef, onChange }) {
  return <>
    <span className="rotation-stem" aria-hidden="true"/>
    <span className="rotate-handle" title="หมุนวัตถุ" onPointerDown={event => startRotate(event, item, canvasRef.current, onChange)}/>
    {RESIZE_DIRECTIONS.map(direction => <span key={direction} className={`resize-handle resize-${direction}`} title="ยืดหรือบิดรูป" onPointerDown={event => startResize(event, item, direction, canvasRef.current, onChange)}/>)}
  </>
}

function RangeControl({ label, value, min = 2, max = 96, step = 1, onChange }) {
  return <label className="range-control"><span>{label}<output>{Math.round(Number(value || 0))}%</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}/></label>
}

function Toast({ message, onDone }) {
  useEffect(() => { const timer = setTimeout(onDone, 2400); return () => clearTimeout(timer) }, [message, onDone])
  return <div className="toast"><span><CheckIcon size={17}/></span>{message}</div>
}

function Poster({ concert }) {
  if (concert.cover) return <img className="poster" src={concert.cover} alt={`โปสเตอร์ ${concert.name}`} />
  return <div className={`poster poster-${concert.id.slice(-1)}`}><small>LIVE</small><b>{concert.name || 'CONCERT'}</b><span>2026</span></div>
}

function ConcertList({ concerts, onEdit, onDelete }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ทั้งหมด')
  const [currentPage, setCurrentPage] = useState(1)
  const filtered = concerts.filter(c => {
    const matchesText = `${c.name} ${c.artist}`.toLowerCase().includes(query.toLowerCase())
    return matchesText && (status === 'ทั้งหมด' || c.status === status)
  })
  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const activePage = Math.min(currentPage, totalPages)
  const visibleConcerts = filtered.slice((activePage - 1) * pageSize, activePage * pageSize)
  const changePage = page => setCurrentPage(Math.max(1, Math.min(totalPages, page)))
  const pageButtons = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : activePage <= 3
      ? [1, 2, 3, 'end-gap', totalPages]
      : activePage >= totalPages - 2
        ? [1, 'start-gap', totalPages - 2, totalPages - 1, totalPages]
        : [1, 'start-gap', activePage, 'end-gap', totalPages]
  return <main className="content list-page">
    <div className="page-heading"><div><span className="eyebrow">TICKET SALES PLANNING</span><h1>เลือกคอนเสิร์ต</h1><p>เลือกคอนเสิร์ตเพื่อจัดทำแผนจำหน่ายบัตร</p></div></div>
    <section className="filter-card">
      <label><span>ค้นหา</span><div className="search-box"><input value={query} onChange={e => { setQuery(e.target.value); setCurrentPage(1) }} placeholder="ชื่อคอนเสิร์ต หรือ ศิลปิน..."/><SearchIcon/></div></label>
      <label><span>สถานะ</span><select value={status} onChange={e => { setStatus(e.target.value); setCurrentPage(1) }}><option>ทั้งหมด</option><option>ฉบับร่าง</option><option>กำลังแสดง</option><option>สิ้นสุดแล้ว</option></select></label>
    </section>
    <section className="table-card">
      <div className="concert-table table-head"><span>หน้าปก</span><span>ชื่อคอนเสิร์ต</span><span>ศิลปิน</span><span>วันที่แสดง</span><span>สถานที่</span><span>สถานะแผน</span><span>จัดการ</span></div>
      {visibleConcerts.length ? visibleConcerts.map(concert => <div className="concert-table table-row" key={concert.id}>
        <span><Poster concert={concert}/></span><strong>{concert.name}</strong><span>{concert.artist || '-'}</span>
        <span>{formatDateRange(concert.date, concert.endDate)}</span><span>{concert.location || '-'}</span>
        <span><i className={`status-pill ${concert.status === 'ฉบับร่าง' ? 'draft' : ''}`}>{concert.status}</i></span>
        <span className="actions"><button className="select-plan" title="เลือกคอนเสิร์ต" onClick={() => onEdit(concert)}>เลือกเพื่อวางแผน</button><button className="danger-icon" title="ล้างผัง" onClick={() => onDelete(concert)}><TrashIcon/></button></span>
      </div>) : <div className="empty">ไม่มีข้อมูล</div>}
      <div className="pagination" aria-label="เปลี่ยนหน้ารายการคอนเสิร์ต">
        <button type="button" aria-label="หน้าก่อนหน้า" onClick={() => changePage(activePage - 1)} disabled={activePage === 1}>‹</button>
        {pageButtons.map(page => typeof page === 'number'
          ? <button type="button" key={page} className={activePage === page ? 'current' : ''} aria-current={activePage === page ? 'page' : undefined} onClick={() => changePage(page)}>{page}</button>
          : <span key={page}>...</span>)}
        <button type="button" aria-label="หน้าถัดไป" onClick={() => changePage(activePage + 1)} disabled={activePage === totalPages}>›</button>
      </div>
    </section>
  </main>
}

const formatDateRange = (start, end) => {
  if (!start) return '-'
  const f = value => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
  return end ? `${f(start)} - ${f(end)}` : f(start)
}

function FormField({ label, required, children, className = '' }) {
  return <label className={`field ${className}`}><span>{label}{required && <em>*</em>}</span>{children}</label>
}

function GeneralTab({ draft, update }) {
  const fileRef = useRef(null)
  const chooseCover = event => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update('cover', reader.result)
    reader.readAsDataURL(file)
  }
  return <div className="general-grid">
    <div className="form-grid">
      <FormField label="ชื่อคอนเสิร์ต" required className="full"><input value={draft.name} onChange={e => update('name', e.target.value)} placeholder="ระบุชื่อคอนเสิร์ต"/></FormField>
      <FormField label="สถานที่จัดงาน" required><input value={draft.location} onChange={e => update('location', e.target.value)} placeholder="ระบุสถานที่"/></FormField>
      <FormField label="หมวดหมู่" required><input value={draft.category} onChange={e => update('category', e.target.value)} placeholder="เช่น คอนเสิร์ต"/></FormField>
      <FormField label="ศิลปิน/ไลน์อัพ" required className="full"><input value={draft.artist} onChange={e => update('artist', e.target.value)} placeholder="ระบุชื่อศิลปิน"/></FormField>
      <FormField label="วันที่แสดง" required><input type="date" value={draft.date} onChange={e => update('date', e.target.value)}/></FormField>
      <FormField label="วันสิ้นสุด"><input type="date" value={draft.endDate} onChange={e => update('endDate', e.target.value)}/></FormField>
      <FormField label="สถานะคอนเสิร์ต" required className="full"><select value={draft.status || 'ฉบับร่าง'} onChange={e => update('status', e.target.value)}><option value="ฉบับร่าง">ฉบับร่าง</option><option value="กำลังแสดง">กำลังแสดง</option><option value="สิ้นสุดแล้ว">สิ้นสุดแล้ว</option></select></FormField>
      <FormField label="คำอธิบายงาน" required className="full"><textarea value={draft.description} onChange={e => update('description', e.target.value)} placeholder="เขียนรายละเอียดเบื้องต้นเกี่ยวกับคอนเสิร์ต"/></FormField>
    </div>
    <FormField label="รูปภาพปกคอนเสิร์ต" required>
      <button type="button" className={`upload-box cover-upload ${draft.cover ? 'has-image' : ''}`} onClick={() => fileRef.current.click()}>
        {draft.cover ? <img src={draft.cover} alt="ตัวอย่างปกคอนเสิร์ต"/> : <><UploadIcon size={34}/><b>วางไฟล์ที่นี่</b><small>แนะนำขนาด 1200 × 1600px</small><span className="btn subtle">เลือกไฟล์</span></>}
      </button>
      <input ref={fileRef} hidden type="file" accept="image/*" onChange={chooseCover}/>
    </FormField>
  </div>
}

function RoundsTab({ rounds }) {
  return <div className="rounds-section">
    <div className="section-bar"><div><h3>รอบการแสดง</h3><p>ข้อมูลอ่านจากตาราง PerformanceSchedule</p></div></div>
    <div className="round-table"><div className="round-row round-head"><span>รอบที่</span><span>วันที่แสดง</span><span>เวลาเริ่มแสดง</span><span>สถานะ</span></div>
      {rounds.map(round => <div className="round-row" key={round.id}><strong>{round.name}</strong><span>{formatDateRange(round.date)}</span><span>{round.doorTime} น.</span><span><i className="status-pill">{round.status || 'ยืนยันแล้ว'}</i></span></div>)}
      {!rounds.length && <div className="empty">ยังไม่มีข้อมูลรอบการแสดงจาก PerformanceSchedule</div>}
    </div>
  </div>
}

function OverviewTab({ draft, update }) {
  const zones = draft.zones || []
  const layoutObjects = draft.layoutObjects || []
  const layoutItems = [...layoutObjects, ...zones].sort((a, b) => Number(a.z || 0) - Number(b.z || 0))
  const totalSeats = zones.reduce((sum, zone) => sum + Number(zone.seatItems?.length ?? zone.seats ?? 0), 0)
  const plannedSeats = zones.reduce((sum, zone) => sum + Number(zone.seatItems?.length || 0), 0)
  const quotaPercent = totalSeats ? Math.min(100, Math.round(plannedSeats / totalSeats * 100)) : 0
  return <div className="overview-page">
    <div className="overview-cards">
      <article><span>ความจุทั้งหมด</span><strong>{totalSeats.toLocaleString('th-TH')} <small>ที่นั่ง</small></strong></article>
      <article><span>ที่นั่งที่วางแผนแล้ว</span><strong>{plannedSeats.toLocaleString('th-TH')} <small>ที่นั่ง</small></strong></article>
      <article><span>ที่นั่งคงเหลือ</span><strong>{Math.max(0, totalSeats - plannedSeats).toLocaleString('th-TH')} <small>ที่นั่ง</small></strong></article>
      <article><span>ความครบถ้วนของผัง</span><strong>{quotaPercent}%</strong></article>
    </div>
    <div className="overview-grid">
      <section className="overview-map-card"><div className="section-title"><div><h3>แผนผังที่นั่งในสถานที่</h3><p>ภาพรวมโซนและจำนวนที่นั่ง</p></div><strong>{totalSeats.toLocaleString('th-TH')} ที่นั่ง</strong></div>
        <div className="overview-map">
          {layoutItems.map((item, index) => <div key={item.id} className="overview-layout-node" style={{ left:`${item.x}%`,top:`${item.y}%`,width:`${item.width || 12}%`,height:`${item.height || 12}%`,transform:`translate(-50%,-50%) rotate(${item.rotation || 0}deg)`,zIndex:index + 1 }}><div className={`overview-layout-item ${item.kind || 'zone'} ${item.shape || 'rectangle'}`} style={{background:item.color,color:item.textColor || '#fff',...shapeStyle(item.shape)}}>{item.shape === 'line' ? '' : <><b>{item.name || item.type}</b>{item.kind !== 'object' && <><span>{item.seatItems?.length ?? item.seats ?? 0} ที่นั่ง</span><small>{Number(item.zonePrice || 0).toLocaleString()} ฿</small></>}</>}</div></div>)}
          {!layoutItems.length && <div className="empty-map"><UsersIcon size={38}/><b>ผังยังว่างอยู่</b><span>เพิ่มโซนหรือวัตถุจากแท็บ “ออกแบบผังและที่นั่ง”</span></div>}
        </div>
      </section>
      <section className="overview-form"><h3>ข้อมูลคอนเสิร์ต</h3><GeneralTab draft={draft} update={update}/></section>
    </div>
    <section className="overview-zones"><div className="section-title"><div><h3>สรุปโซนจำหน่ายบัตร</h3><p>ราคาแผนอ่านจาก Zone.ZonePrice</p></div></div>
      <div className="zone-summary-row zone-summary-head"><span>โซน</span><span>ราคา</span><span>ความจุ</span><span>สัดส่วน</span></div>
      {zones.map(zone => <div className="zone-summary-row" key={zone.id}><span><i style={{background:zone.color}}></i><b>{zone.name || zone.type}</b></span><span>{Number(zone.zonePrice || 0).toLocaleString()} บาท</span><span>{Number(zone.seatItems?.length ?? zone.seats ?? 0).toLocaleString()} ที่นั่ง</span><span>{totalSeats ? ((Number(zone.seatItems?.length ?? zone.seats ?? 0) / totalSeats) * 100).toFixed(1) : '0.0'}%</span></div>)}
      {!zones.length && <div className="empty">ยังไม่มีโซน กรุณาสร้างในแท็บ “ออกแบบผังและที่นั่ง”</div>}
    </section>
    <RoundsTab rounds={draft.rounds || []}/>
  </div>
}

function PublishingTab({ concertName, value, setValue }) {
  const fileRef = useRef(null)
  const update = (key, next) => setValue({ ...value, [key]: next })
  const chooseImage = event => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setValue({ ...value, scheduleFile: file.name, scheduleImage: reader.result })
    reader.readAsDataURL(file)
  }
  return <div className="publishing-grid">
    <div><h3>ข้อมูลที่แสดงบนหน้าเว็บ</h3><FormField label="ชื่อที่แสดงบนหน้าเว็บ"><input value={concertName || ''} readOnly title="แก้ชื่อคอนเสิร์ตได้จากแท็บภาพรวม"/></FormField><FormField label="คำอธิบาย"><textarea value={value.description || ''} onChange={e => update('description', e.target.value)} placeholder="รายละเอียดสำหรับหน้าจำหน่ายบัตร"/></FormField><h3>รูปภาพปกหน้าเว็บ</h3><button className={`upload-box schedule-upload ${value.scheduleImage ? 'has-image' : ''}`} onClick={() => fileRef.current.click()}>{value.scheduleImage ? <><img src={value.scheduleImage} alt="ภาพตัวอย่างการเผยแพร่"/><span className="image-name">{value.scheduleFile}</span><span className="btn subtle change-image">เปลี่ยนรูป</span></> : <><UploadIcon size={38}/><b>อัปโหลดรูปภาพ</b><small>แนะนำ 1200 × 628 px รองรับ JPG, PNG และ WEBP</small><span className="btn subtle">เลือกไฟล์</span></>}</button><input hidden ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage}/></div>
    <div className="publishing-fields">
      <h3>ช่วงเวลาแสดงบนหน้าเว็บ</h3>
      <FormField label="วันขึ้นหน้าเว็บ"><input type="datetime-local" value={value.publishAt} onChange={e => update('publishAt', e.target.value)}/></FormField>
      <FormField label="วันลงจากหน้าเว็บ"><input type="datetime-local" value={value.unpublishAt} onChange={e => update('unpublishAt', e.target.value)}/></FormField>
      <h3>ช่วงเวลาจำหน่ายบัตร</h3>
      <FormField label="วันเริ่มจำหน่ายบัตร"><input type="datetime-local" value={value.saleStart} onChange={e => update('saleStart', e.target.value)}/></FormField>
      <FormField label="วันสิ้นสุดจำหน่ายบัตร"><input type="datetime-local" value={value.saleEnd} onChange={e => update('saleEnd', e.target.value)}/></FormField>
      <div className="publish-note"><CheckIcon/>คอนเสิร์ตจะแสดงบนหน้าเว็บเฉพาะช่วงเวลาที่กำหนด และปุ่มซื้อบัตรจะเปิดตามช่วงจำหน่าย</div>
    </div>
  </div>
}

const shapeNames = { rectangle: 'สี่เหลี่ยม', circle: 'วงกลม', triangle: 'สามเหลี่ยม' }
const shapeStyle = shape => shape === 'circle' ? { borderRadius: '50%' } : shape === 'triangle' ? { clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' } : { borderRadius: '8px' }

const triangleBoundsAtY = y => {
  const halfSpan = clamp((Number(y) - 1.5) / 97, 0, 1) * 48.5
  return { minX: 50 - halfSpan + 3, maxX: 50 + halfSpan - 3 }
}

const isInsideTriangle = seat => {
  const y = Number(seat.y)
  const x = Number(seat.x)
  if (y < 7 || y > 93) return false
  const { minX, maxX } = triangleBoundsAtY(y)
  return x >= minX && x <= maxX
}

const constrainSeatPosition = (x, y, shape) => {
  if (shape !== 'triangle') return { x: clamp(x, 2, 98), y: clamp(y, 3, 97) }
  const safeY = clamp(y, 7, 93)
  const { minX, maxX } = triangleBoundsAtY(safeY)
  return { x: clamp(x, Math.min(minX, 50), Math.max(maxX, 50)), y: safeY }
}

export const avoidSeatCollision = (desired, currentSeat, seats) => {
  const collision = seats.some(seat => seatKey(seat) !== seatKey(currentSeat)
    && Math.abs(Number(seat.x) - Number(desired.x)) < 3.5
    && Math.abs(Number(seat.y) - Number(desired.y)) < 3.5)
  return collision ? { x: Number(currentSeat.x), y: Number(currentSeat.y) } : desired
}

function arrangeSeats(count, shape, oldSeats = []) {
  const total = Math.max(0, Number(count) || 0)
  const positionFor = index => {
    let x = 50, y = 50
    if (shape === 'circle') {
      const angle = index * 2.39996
      const radius = total < 2 ? 0 : Math.sqrt(index / (total - 1)) * 42
      x = 50 + Math.cos(angle) * radius; y = 50 + Math.sin(angle) * radius
    } else if (shape === 'triangle') {
      const row = Math.floor((Math.sqrt(8 * index + 1) - 1) / 2)
      const first = row * (row + 1) / 2
      const position = index - first
      const rows = Math.ceil((Math.sqrt(8 * total + 1) - 1) / 2)
      y = rows < 2 ? 50 : 8 + row * (84 / Math.max(rows - 1, 1))
      const { minX, maxX } = triangleBoundsAtY(y)
      x = row === 0 ? 50 : minX + position * ((maxX - minX) / row)
    } else {
      const columns = Math.max(1, Math.ceil(Math.sqrt(total * 1.5)))
      const rows = Math.ceil(total / columns)
      x = 7 + (index % columns) * (86 / Math.max(columns - 1, 1))
      y = 9 + Math.floor(index / columns) * (82 / Math.max(rows - 1, 1))
    }
    return { x, y }
  }
  const positionKey = ({ x, y }) => `${Number(x).toFixed(4)}:${Number(y).toFixed(4)}`
  const occupied = new Set(oldSeats.filter(seat => shape !== 'triangle' || isInsideTriangle(seat)).map(positionKey))
  const availablePositions = Array.from({ length: total }, (_, index) => positionFor(index)).filter(position => !occupied.has(positionKey(position)))
  let nextPosition = 0
  const assigned = new Set()
  return Array.from({ length: total }, (_, index) => {
    const existing = oldSeats[index]
    const existingKey = existing ? positionKey(existing) : ''
    if (existing && (shape !== 'triangle' || isInsideTriangle(existing)) && !assigned.has(existingKey)) {
      assigned.add(existingKey)
      return existing
    }
    const { x, y } = availablePositions[nextPosition++] || positionFor(index)
    assigned.add(positionKey({ x, y }))
    return existing
      ? { ...existing, x, y }
      : { clientKey: `seat-${Date.now()}-${index}`, name: `${String.fromCharCode(65 + Math.floor(index / 26))}${index + 1}`, x, y, disabled: false }
  })
}

function ItemModal({ kind, shape, onClose, onSave }) {
  const isZone = kind === 'zone'
  const [item, setItem] = useState({ id: `${kind}-${Date.now()}`, kind, shape, name: isZone ? '' : 'วัตถุ', color: isZone ? '#e72d70' : '#777b91', textColor: '#ffffff', seats: 0, seatItems: [], zonePrice: 0, type: '', x: 50, y: 50, width: 13, height: 15, rotation: 0, z: 0 })
  const update = (key, value) => setItem(current => ({ ...current, [key]: value }))
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal zone-modal">
    <div className="modal-title"><div><span className="eyebrow">LAYOUT ITEM</span><h2>สร้าง{isZone ? 'โซนที่นั่ง' : 'วัตถุปกติ'}รูป{shapeNames[shape]}</h2></div><button className="icon-button" onClick={onClose}><CloseIcon/></button></div>
    <div className="form-grid">
      <FormField label={isZone ? 'ชื่อโซน' : 'ชื่อวัตถุ'} required><input value={item.name} onChange={e => update('name', e.target.value)} placeholder={isZone ? 'เช่น A1' : 'เช่น เวที หรือ ทางเข้า'}/></FormField>
      <FormField label="สี" required><input className="color-input" type="color" value={item.color} onChange={e => update('color', e.target.value)}/></FormField>
      {isZone && <FormField label="ราคาโซน (บาท)" required><input type="number" min="0" step="0.01" value={item.zonePrice} onChange={e => update('zonePrice', Number(e.target.value))}/></FormField>}
    </div>
    <div className="modal-actions"><button className="btn ghost" onClick={onClose}>ยกเลิก</button><button disabled={!item.name} className="btn primary" onClick={() => onSave(item)}><PlusIcon/>สร้าง{isZone ? 'โซน' : 'วัตถุ'}</button></div>
  </div></div>
}

function ZoneDetail({ zone, onBack, onSave, onDelete }) {
  const [working, setWorking] = useState(() => {
    const shape = zone.shape || 'rectangle'
    const seats = zone.seatItems?.length ? zone.seatItems : arrangeSeats(zone.seats, shape)
    return { ...zone, shape, seatItems: arrangeSeats(seats.length, shape, seats) }
  })
  const [addCount, setAddCount] = useState(1)
  const [selectedSeat, setSelectedSeat] = useState(null)
  const seatCanvas = useRef(null)
  const update = (key, value) => setWorking(current => ({ ...current, [key]: value }))
  const changeShape = shape => setWorking(current => ({ ...current, shape, seatItems: arrangeSeats(current.seatItems.length, shape, current.seatItems) }))
  const addSeats = () => setWorking(current => { const count = current.seatItems.length + Math.max(1, addCount); return { ...current, seats: count, seatItems: arrangeSeats(count, current.shape, current.seatItems) } })
  const updateSeat = next => { setWorking(current => ({ ...current, seatItems: current.seatItems.map(seat => seatKey(seat) === seatKey(next) ? next : seat) })); setSelectedSeat(next) }
  const dragSeat = (event, seat) => {
    event.stopPropagation(); setSelectedSeat(seat)
    const rect = seatCanvas.current.getBoundingClientRect()
    const move = e => { const position = constrainSeatPosition((e.clientX - rect.left) / rect.width * 100, (e.clientY - rect.top) / rect.height * 100, working.shape); const availablePosition = avoidSeatCollision(position, seat, working.seatItems); updateSeat({ ...seat, ...availablePosition }) }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const activeSeat = working.seatItems.find(seat => seatKey(seat) === seatKey(selectedSeat))
  const disabledCount = working.seatItems.filter(seat => seat.disabled).length
  return <div className="zone-detail">
    <div className="section-bar"><button className="back-link" onClick={onBack}><ArrowLeftIcon/>กลับไปยังผังรวม</button><div className="detail-actions"><button className="btn danger small" onClick={onDelete}><TrashIcon/>ลบโซน</button><button className="btn success small" onClick={() => onSave({ ...working, seats: working.seatItems.length })}><SaveIcon/>บันทึกผังที่นั่ง</button></div></div>
    <div className="seat-editor-toolbar"><div className="shape-switch"><b>รูปทรงโซน</b>{Object.keys(shapeNames).map(shape => <button key={shape} className={working.shape === shape ? 'active' : ''} onClick={() => changeShape(shape)}><i className={`shape-icon ${shape}`}></i>{shapeNames[shape]}</button>)}</div><div className="add-seat-control"><input type="number" min="1" value={addCount} onChange={e => setAddCount(+e.target.value)}/><button className="btn primary small" onClick={addSeats}><PlusIcon/>เพิ่มเก้าอี้</button></div></div>
    <div className="zone-detail-grid">
      <div className="seat-shape-frame"><div ref={seatCanvas} className={`free-seat-canvas ${working.shape}`} style={{ '--zone-color': working.color }} onClick={() => setSelectedSeat(null)}>{working.shape === 'triangle' && <svg className="triangle-zone-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon data-testid="triangle-zone-outline" points="50,1.5 98.5,98.5 1.5,98.5" fill="none" stroke="#e72d70" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/></svg>}{working.seatItems.map(seat => <button key={seatKey(seat)} className={`free-seat ${seat.disabled ? 'disabled' : ''} ${seatKey(activeSeat) === seatKey(seat) ? 'selected' : ''}`} style={{ left: `${seat.x}%`, top: `${seat.y}%` }} onPointerDown={e => dragSeat(e, seat)} onClick={e => { e.stopPropagation(); setSelectedSeat(seat) }}>{seat.name}</button>)}</div><p className="seat-hint">ลากเก้าอี้ได้อย่างอิสระ และคลิกเพื่อแก้ชื่อรายตัว</p></div>
      <aside className="zone-form"><div className="zone-badge" style={{ background: working.color, ...shapeStyle(working.shape) }}>{working.name}<small>{working.seatItems.length} ที่นั่ง</small></div>
        <FormField label="ชื่อโซน"><input value={working.name} onChange={e => update('name', e.target.value)}/></FormField><FormField label="สีโซน"><input className="color-input" type="color" value={working.color} onChange={e => update('color', e.target.value)}/></FormField><FormField label="ราคาโซน (บาท)"><input type="number" min="0" step="0.01" value={working.zonePrice || 0} onChange={e => update('zonePrice', Number(e.target.value))}/></FormField>
        {activeSeat && <div className="seat-inspector"><b>เก้าอี้ที่เลือก</b><FormField label="ชื่อเก้าอี้"><input value={activeSeat.name} onChange={e => updateSeat({ ...activeSeat, name: e.target.value })}/></FormField><button className={`btn small ${activeSeat.disabled ? 'success' : 'ghost'}`} onClick={() => updateSeat({ ...activeSeat, disabled: !activeSeat.disabled })}>{activeSeat.disabled ? 'เปิดใช้งานเก้าอี้' : 'ปิดใช้งานเก้าอี้'}</button><button className="btn danger small" onClick={() => { setWorking(current => ({ ...current, seatItems: current.seatItems.filter(seat => seatKey(seat) !== seatKey(activeSeat)) })); setSelectedSeat(null) }}><TrashIcon/>ลบเก้าอี้</button></div>}
        <div className="zone-stat"><span>ที่นั่งพร้อมใช้</span><b>{working.seatItems.length - disabledCount}</b></div><div className="zone-stat"><span>ปิดใช้งาน</span><b>{disabledCount}</b></div>
      </aside>
    </div>
  </div>
}

function SeatPlanner({ zones, setZones, objects, setObjects, onSeatSave }) {
  const [createConfig, setCreateConfig] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const mapRef = useRef(null)
  const selectedZone = selected?.kind === 'zone' ? zones.find(item => item.id === selected.id) : null
  const selectedObject = selected?.kind === 'object' ? objects.find(item => item.id === selected.id) : null
  const selectedItem = selectedZone || selectedObject
  const total = zones.reduce((sum, zone) => sum + Number(zone.seatItems?.length ?? zone.seats ?? 0), 0)
  const updateItem = next => next.kind === 'object' ? setObjects(objects.map(item => item.id === next.id ? next : item)) : setZones(zones.map(item => item.id === next.id ? next : item))
  const removeSelected = () => { if (!selectedItem) return; if (selectedItem.kind === 'object') setObjects(objects.filter(item => item.id !== selectedItem.id)); else setZones(zones.filter(item => item.id !== selectedItem.id)); setSelected(null) }
  const duplicate = () => { if (!selectedItem) return; const copy = { ...selectedItem, id: `${selectedItem.kind}-${Date.now()}`, name: `${selectedItem.name} สำเนา`, x: Math.min(94, selectedItem.x + 4), y: Math.min(94, selectedItem.y + 4), z: nextLayerOrder([...objects, ...zones]), seatItems: selectedItem.seatItems?.map((seat, index) => ({ ...seat, id: undefined, clientKey: `seat-${Date.now()}-${index}` })) }; if (copy.kind === 'object') setObjects([...objects, copy]); else setZones([...zones, copy]); setSelected({ kind: copy.kind || 'zone', id: copy.id }) }
  const moveLayer = direction => {
    if (!selectedItem) return
    const ordered = [...objects, ...zones].sort((a, b) => Number(a.z || 0) - Number(b.z || 0))
    const withoutSelected = ordered.filter(item => item.id !== selectedItem.id)
    const reordered = direction > 0 ? [...withoutSelected, selectedItem] : [selectedItem, ...withoutSelected]
    const normalized = new Map(reordered.map((item, index) => [item.id, index + 1]))
    setObjects(objects.map(item => ({ ...item, z: normalized.get(item.id) })))
    setZones(zones.map(item => ({ ...item, z: normalized.get(item.id) })))
  }
  const dragItem = (event, item) => {
    event.stopPropagation(); setSelected({ kind: item.kind || 'zone', id: item.id })
    const rect = mapRef.current.getBoundingClientRect()
    const move = e => updateItem({ ...item, x: Math.max(2, Math.min(98, (e.clientX - rect.left) / rect.width * 100)), y: Math.max(2, Math.min(98, (e.clientY - rect.top) / rect.height * 100)) })
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const detailZone = zones.find(zone => zone.id === detailId)
  if (detailZone) return <ZoneDetail zone={detailZone} onBack={() => setDetailId(null)} onSave={updated => { const next = zones.map(zone => zone.id === updated.id ? updated : zone); setZones(next); onSeatSave(next, objects); setDetailId(null) }} onDelete={() => { const next = zones.filter(zone => zone.id !== detailZone.id); setZones(next); onSeatSave(next, objects); setDetailId(null) }}/>
  const addQuickObject = (shape, name) => setObjects([...objects, { id: `object-${Date.now()}`, kind: 'object', shape, name, color: '#777b91', textColor: '#ffffff', x: 50, y: 50, width: shape === 'line' ? 25 : 14, height: shape === 'line' ? 1 : 10, rotation: 0, z: nextLayerOrder([...objects, ...zones]) }])
  return <div className="seat-planner">
    <div className="seat-summary"><div><UsersIcon/><span>ความจุรวมทั้งหมด<small>นับเฉพาะวัตถุที่กำหนดเป็นโซน</small></span></div><strong>{total.toLocaleString('th-TH')} <small>ที่นั่ง</small></strong><button className="btn success small" onClick={() => onSeatSave(zones, objects)}><SaveIcon/>บันทึกผังที่นั่ง</button></div>
    <div className="designer-toolbar"><div className="tool-group"><b>โซน</b>{Object.keys(shapeNames).map(shape => <button key={`z-${shape}`} title={`สร้างโซน${shapeNames[shape]}`} onClick={() => setCreateConfig({ kind: 'zone', shape })}><i className={`shape-icon ${shape}`}></i>{shapeNames[shape]}</button>)}</div><div className="tool-divider"></div><div className="tool-group"><b>วัตถุปกติ</b>{Object.keys(shapeNames).map(shape => <button key={`o-${shape}`} title={`สร้างวัตถุ${shapeNames[shape]}`} onClick={() => setCreateConfig({ kind: 'object', shape })}><i className={`shape-icon ${shape}`}></i>{shapeNames[shape]}</button>)}<button onClick={() => addQuickObject('text', 'ข้อความ')}><b className="text-tool">T</b>ข้อความ</button><button onClick={() => addQuickObject('line', '')}><b className="line-tool"></b>เส้น</button><button onClick={() => addQuickObject('text', '→')}><b className="arrow-tool">→</b>ลูกศร</button></div></div>
    {selectedItem && <div className="item-inspector"><span className={`kind-pill ${selectedItem.kind || 'zone'}`}>{selectedItem.kind === 'object' ? 'วัตถุปกติ' : 'โซนที่นั่ง'}</span><input aria-label="ชื่อวัตถุ" value={selectedItem.name} onChange={e => updateItem({ ...selectedItem, name: e.target.value })}/><label>สี <input type="color" value={selectedItem.color} onChange={e => updateItem({ ...selectedItem, color: e.target.value })}/></label><RangeControl label="กว้าง" min={selectedItem.shape === 'line' ? 2 : 4} value={selectedItem.width || 12} onChange={width => updateItem({ ...selectedItem, width })}/><RangeControl label="สูง" min={selectedItem.shape === 'line' ? 0.6 : 4} step={selectedItem.shape === 'line' ? 0.2 : 1} value={selectedItem.height || 12} onChange={height => updateItem({ ...selectedItem, height })}/><label>หมุน <input type="number" value={selectedItem.rotation || 0} onChange={e => updateItem({ ...selectedItem, rotation: +e.target.value })}/></label><button onClick={() => moveLayer(1)}>ขึ้นหน้า</button><button onClick={() => moveLayer(-1)}>ลงหลัง</button><button onClick={duplicate}>คัดลอก</button><button className="danger-tool" onClick={removeSelected}><TrashIcon size={16}/></button></div>}
    <div className="map-toolbar"><span><b>ผังที่นั่ง</b> ลากวัตถุได้อิสระทุกตำแหน่ง</span><span className="legend"><i></i>ดับเบิลคลิกโซนเพื่อจัดเก้าอี้</span></div>
    <div className="zone-map designer-map" ref={mapRef} onPointerDown={() => setSelected(null)}>
      {[...objects, ...zones].sort((a,b) => Number(a.z || 0) - Number(b.z || 0)).map((item, index) => <div key={item.id} className={`layout-node ${selected?.id === item.id ? 'selected' : ''}`} style={{ left:`${item.x}%`,top:`${item.y}%`,width:`${item.width || 12}%`,height:`${item.height || 12}%`,transform:`translate(-50%,-50%) rotate(${item.rotation || 0}deg)`,zIndex:index + 1 }} onPointerDown={e => dragItem(e,item)} onDoubleClick={() => item.kind !== 'object' && setDetailId(item.id)}><div className={`layout-item ${item.kind || 'zone'} ${item.shape || 'rectangle'}`} style={{background:item.color,color:item.textColor || '#fff',...shapeStyle(item.shape)}}>{item.shape === 'line' ? '' : <><strong>{item.name}</strong>{item.kind !== 'object' && <><span>{item.seatItems?.length ?? item.seats ?? 0}</span><small>{Number(item.zonePrice || 0).toLocaleString()} ฿</small></>}</>}</div>{selected?.id === item.id && <TransformHandles item={item} canvasRef={mapRef} onChange={updateItem}/>}</div>)}
      {!zones.length && !objects.length && <div className="empty-map"><UsersIcon size={38}/><b>ผังยังว่างอยู่</b><span>เลือกเครื่องมือด้านบนเพื่อสร้างโซนหรือวัตถุ</span></div>}
    </div>
    {createConfig && (
      <ItemModal {...createConfig} onClose={() => setCreateConfig(null)} onSave={item => {
        const next = { ...item, z: nextLayerOrder([...objects, ...zones]) }
        if (next.kind === 'zone') setZones([...zones,next])
        else setObjects([...objects,next])
        setCreateConfig(null)
      }}/>
    )}
  </div>
}

const ticketDefaults = concert => [
  { id:`ticket-bg-${concert.id}`,kind:'shape',shape:'rectangle',name:'',color:'#071033',textColor:'#ffffff',x:50,y:50,width:94,height:84,rotation:0,z:0,side:'FRONT' },
  { id:`ticket-title-${concert.id}`,kind:'text',shape:'rectangle',name:concert.name || 'CONCERT NAME',color:'transparent',textColor:'#ffffff',fontSize:32,x:34,y:29,width:50,height:18,rotation:0,z:2,side:'FRONT' },
  { id:`ticket-qr-${concert.id}`,kind:'qr',shape:'rectangle',name:'QR CODE',color:'#ffffff',textColor:'#071033',x:81,y:42,width:18,height:32,rotation:0,z:3,side:'FRONT' },
  { id:`ticket-back-${concert.id}`,kind:'shape',shape:'rectangle',name:'THANK YOU FOR BEING PART OF THE MUSIC',color:'#071033',textColor:'#ffffff',x:50,y:50,width:94,height:84,rotation:0,z:0,side:'BACK' },
]

function TicketDesigner({ concert, objects, setObjects, onSave }) {
  const [side, setSide] = useState('FRONT')
  const [selectedId, setSelectedId] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const canvasRef = useRef(null)
  const imageInputRef = useRef(null)
  const replaceImageIdRef = useRef(null)
  const allObjects = objects?.length ? objects : ticketDefaults(concert)
  const visible = allObjects.filter(item => (item.side || 'FRONT') === side)
  const selected = allObjects.find(item => item.id === selectedId)
  const changeObjects = next => setObjects(next)
  const update = next => changeObjects(allObjects.map(item => item.id === next.id ? next : item))
  const add = (kind, values = {}) => {
    const item = { id:`ticket-${kind}-${Date.now()}`,kind,shape:'rectangle',name:kind === 'qr' ? 'QR CODE' : kind === 'image' ? 'รูปภาพ' : kind === 'shape' ? '' : 'ข้อความใหม่',color:kind === 'shape' ? '#e72d70' : kind === 'image' ? 'transparent' : '#ffffff',textColor:'#071033',fontSize:kind === 'text' ? 24 : 0,x:50,y:50,width:kind === 'text' ? 34 : 18,height:kind === 'text' ? 12 : 20,rotation:0,z:nextLayerOrder(allObjects),side,...values }
    changeObjects([...allObjects,item]); setSelectedId(item.id); setSaveError('')
  }
  const saveDesign = () => {
    if (!allObjects.some(item => item.kind === 'qr')) {
      setSaveError('กรุณาวาง QR Code อย่างน้อยหนึ่งตำแหน่งก่อนบันทึกแบบบัตร')
      return
    }
    setSaveError('')
    onSave(allObjects)
  }
  const openImagePicker = (itemId = null) => {
    replaceImageIdRef.current = itemId
    setUploadError('')
    imageInputRef.current?.click()
  }
  const chooseImage = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setUploadError('รองรับ JPG, PNG หรือ WEBP ขนาดไม่เกิน 5 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const imageSrc = String(reader.result || '')
      const preview = new Image()
      preview.onload = () => {
        const aspectRatio = preview.naturalWidth / preview.naturalHeight
        const target = allObjects.find(item => item.id === replaceImageIdRef.current)
        if (target) update({ ...target, imageSrc, aspectRatio, name:file.name })
        else {
          const canvasAspect = canvasRef.current ? canvasRef.current.clientWidth / canvasRef.current.clientHeight : 2.05
          let width = 28
          let height = width * canvasAspect / aspectRatio
          if (height > 70) { height = 70; width = height * aspectRatio / canvasAspect }
          add('image', { imageSrc, aspectRatio, name:file.name, width, height })
        }
        replaceImageIdRef.current = null
        setUploadError('')
      }
      preview.onerror = () => setUploadError('ไม่สามารถเปิดไฟล์รูปภาพนี้ได้')
      preview.src = imageSrc
    }
    reader.onerror = () => setUploadError('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้')
    reader.readAsDataURL(file)
  }
  const drag = (event,item) => {
    event.stopPropagation(); setSelectedId(item.id)
    const rect = canvasRef.current.getBoundingClientRect()
    const move = e => update(keepImageInsideCanvas({ ...item, x:Math.max(3,Math.min(97,(e.clientX-rect.left)/rect.width*100)), y:Math.max(4,Math.min(96,(e.clientY-rect.top)/rect.height*100)) }))
    const up = () => { window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up) }
    window.addEventListener('pointermove',move); window.addEventListener('pointerup',up)
  }
  return <div className="ticket-designer">
    <div className="ticket-toolbar"><div><button onClick={() => add('text')}><b className="text-tool">T</b>ข้อความ</button><button onClick={() => openImagePicker()}><UploadIcon/>รูปภาพ</button><button onClick={() => add('shape')}><i className="shape-icon rectangle"></i>รูปทรง</button><button onClick={() => add('qr')}><span className="qr-tool">▦</span>QR Code</button><input ref={imageInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage}/>{uploadError && <span className="ticket-upload-error" role="alert">{uploadError}</span>}{saveError && <span className="ticket-upload-error" role="alert">{saveError}</span>}</div><button className="btn success small" onClick={saveDesign}><SaveIcon/>บันทึกแบบบัตร</button></div>
    <div className="ticket-workspace">
      <aside className="ticket-assets"><h3>องค์ประกอบ</h3><p>ลากวัตถุบนบัตร แล้วปรับค่าจากแถบคุณสมบัติ</p><div className="data-fields"><button onClick={() => add('text', {name:'{ชื่อคอนเสิร์ต}'})}>{'{ชื่อคอนเสิร์ต}'}</button><button onClick={() => add('text', {name:'{รหัสบัตร}'})}>{'{รหัสบัตร}'}</button><button onClick={() => add('text', {name:'{ชื่อผู้ถือบัตร}'})}>{'{ชื่อผู้ถือบัตร}'}</button><button onClick={() => add('text', {name:'{โซน}'})}>{'{โซน}'}</button><button onClick={() => add('text', {name:'{ที่นั่ง}'})}>{'{ที่นั่ง}'}</button></div></aside>
      <section className="ticket-canvas-wrap"><div className="ticket-side-tabs"><button className={side === 'FRONT' ? 'active' : ''} onClick={() => {setSide('FRONT');setSelectedId(null)}}>ด้านหน้า</button><button className={side === 'BACK' ? 'active' : ''} onClick={() => {setSide('BACK');setSelectedId(null)}}>ด้านหลัง</button></div><div className="ticket-canvas" ref={canvasRef} onPointerDown={() => setSelectedId(null)}>{visible.sort((a,b)=>Number(a.z)-Number(b.z)).map((item, index) => <div key={item.id} className={`ticket-node ${selectedId === item.id ? 'selected' : ''}`} style={{left:`${item.x}%`,top:`${item.y}%`,width:`${item.width}%`,height:`${item.height}%`,transform:`translate(-50%,-50%) rotate(${item.rotation || 0}deg)`,zIndex:index + 1}} onPointerDown={e => drag(e,item)}><div className={`ticket-object ${item.kind}`} style={{background:item.color,color:item.textColor,fontSize:item.kind === 'text' ? `${item.fontSize || 24}px` : undefined}}>{item.kind === 'qr' ? <><span className="fake-qr">▦</span><small>QR</small></> : item.kind === 'image' ? item.imageSrc ? <img className="ticket-uploaded-image" src={item.imageSrc} alt={item.name || 'รูปภาพบนบัตร'} onLoad={event => { const aspectRatio = event.currentTarget.naturalWidth / event.currentTarget.naturalHeight; if (!item.aspectRatio && aspectRatio) update({ ...item, aspectRatio }) }}/> : <UploadIcon/> : item.name}</div>{selectedId === item.id && <TransformHandles item={item} canvasRef={canvasRef} onChange={update}/>}</div>)}</div></section>
      <aside className="ticket-properties"><h3>คุณสมบัติวัตถุ</h3>{selected ? <>{selected.kind === 'image' ? <div className="image-property"><div className="image-property-preview">{selected.imageSrc ? <img src={selected.imageSrc} alt={selected.name || 'รูปภาพบนบัตร'}/> : <UploadIcon/>}</div><small>แสดงเต็มภาพ · ลากมุมเพื่อย่อ–ขยายตามสัดส่วน</small><button className="btn ghost small" onClick={() => openImagePicker(selected.id)}><UploadIcon/>เปลี่ยนรูป</button></div> : <><FormField label="ข้อความ"><input value={selected.name} onChange={e => update({...selected,name:e.target.value})}/></FormField><FormField label="สีพื้น"><input type="color" value={selected.color === 'transparent' ? '#ffffff' : selected.color} onChange={e => update({...selected,color:e.target.value})}/></FormField><FormField label="สีข้อความ"><input type="color" value={selected.textColor || '#071033'} onChange={e => update({...selected,textColor:e.target.value})}/></FormField>{selected.kind === 'text' && <RangeControl label="ขนาดตัวอักษร" min={8} max={96} value={selected.fontSize || 24} onChange={fontSize => update({...selected,fontSize})}/>}</>}<div className="property-pair"><RangeControl label="กว้าง" min={4} value={selected.width} onChange={width => update(keepImageInsideCanvas({...selected,width}))}/><RangeControl label="สูง" min={4} value={selected.height} onChange={height => update(keepImageInsideCanvas({...selected,height}))}/></div><FormField label="หมุน"><input type="number" value={selected.rotation || 0} onChange={e => update({...selected,rotation:+e.target.value})}/></FormField><button className="btn danger small" onClick={() => {changeObjects(allObjects.filter(item=>item.id!==selected.id));setSelectedId(null)}}><TrashIcon/>ลบวัตถุ</button></> : <p>เลือกวัตถุบนบัตรเพื่อแก้ไข</p>}</aside>
    </div>
  </div>
}

function Editor({ source, onCancel, onSave, onSeatSave, onTicketSave }) {
  const [draft, setDraft] = useState(() => structuredClone(source))
  const [tab, setTab] = useState('overview')
  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const saveSeatLayout = async (zones, layoutObjects) => {
    const next = { ...draft, zones, layoutObjects }
    setDraft(next)
    const persisted = await onSeatSave(next)
    if (persisted) {
      setDraft(current => ({
        ...current,
        zones: (persisted.zones || []).map(normalizeZoneForEditor),
        layoutObjects: persisted.layoutObjects || [],
      }))
    }
  }
  const saveTicketLayout = ticketLayoutObjects => {
    const next = { ...draft, ticketLayoutObjects }
    setDraft(next)
    onTicketSave(next)
  }
  const tabs = [{ id: 'overview', label: 'ภาพรวม' }, { id: 'publishing', label: 'วางขายหน้าเว็บ' }, { id: 'seats', label: 'ออกแบบผังและที่นั่ง' }, { id: 'ticket', label: 'ออกแบบบัตร' }]
  return <main className="content editor-page">
    <div className="editor-heading"><div><button className="back-link" onClick={onCancel}><ArrowLeftIcon/>กลับไปหน้าเลือกคอนเสิร์ต</button><span className="eyebrow">TICKET SALES PLANNING</span><h1>วางแผนจำหน่ายบัตร</h1><p>{source.name || 'กรอกข้อมูลเพื่อสร้างคอนเสิร์ตใหม่'}</p></div><div className="header-actions"><span className="plan-status">สถานะแผน <b>{draft.status || 'ฉบับร่าง'}</b></span><button className="btn danger" onClick={onCancel}>ยกเลิก</button><button className="btn success" onClick={() => onSave(draft)}><SaveIcon/>บันทึกข้อมูล</button></div></div>
    <section className="editor-card"><nav className="tabs">{tabs.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}{item.id === 'rounds' && <small>{draft.rounds.length}</small>}{item.id === 'seats' && <small>{draft.zones.length}</small>}</button>)}</nav>
      <div className="tab-content">
        {tab === 'overview' && <OverviewTab draft={draft} update={update}/>}
        {tab === 'publishing' && <PublishingTab concertName={draft.name} value={draft.publishing} setValue={value => update('publishing', value)}/>}
        {tab === 'seats' && <SeatPlanner zones={draft.zones || []} setZones={zones => update('zones', zones)} objects={draft.layoutObjects || []} setObjects={objects => update('layoutObjects', objects)} onSeatSave={saveSeatLayout}/>}
        {tab === 'ticket' && (
          <TicketDesigner
            concert={draft}
            objects={draft.ticketLayoutObjects || []}
            setObjects={objects => update('ticketLayoutObjects', objects)}
            onSave={saveTicketLayout}
          />
        )}
      </div>
    </section>
  </main>
}

function DeleteModal({ concert, onClose, onConfirm }) {
  return <div className="modal-backdrop"><div className="modal delete-modal"><div className="delete-symbol"><TrashIcon size={34}/></div><h2>ยืนยันการล้างผังที่นั่ง?</h2><p>ระบบจะล้างเฉพาะผัง โซน และเก้าอี้ของ <b>{concert.name}</b><br/>ข้อมูลคอนเสิร์ตหลักจะยังคงอยู่</p><div className="modal-actions centered"><button className="btn ghost" onClick={onClose}>ยกเลิก</button><button className="btn danger" onClick={onConfirm}><TrashIcon/>ยืนยันการล้างผัง</button></div></div></div>
}

export default function App() {
  const [concerts, setConcerts] = useStoredConcerts()
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast] = useState('')
  const active = useMemo(() => editing ? concerts.find(c => c.id === editing) || blankConcert() : null, [editing, concerts])
  const save = async draft => {
    const saved = { ...draft, status: draft.status || 'ฉบับร่าง' }
    try {
      const plan = await saveConcertPlan(saved)
      const layout = await saveConcertLayout(saved.id, saved.zones || [], saved.layoutObjects || [])
      const ticketDesign = await saveTicketDesign(saved.id, saved.ticketLayoutObjects || [])
      const next = hydrateConcert({ ...saved, ...plan, zones: layout.zones, layoutObjects: layout.layoutObjects, ticketLayoutObjects: ticketDesign.objects })
      setConcerts(current => current.map(c => c.id === draft.id ? next : c))
      setEditing(null)
      setToast('บันทึกข้อมูลทุกหน้าเรียบร้อยแล้ว')
    } catch {
      setToast('บันทึกไม่สำเร็จ กรุณาตรวจสอบ API และลองอีกครั้ง')
    }
  }
  const saveSeats = async draft => {
    try {
      const layout = await saveConcertLayout(draft.id, draft.zones || [], draft.layoutObjects || [])
      const normalizedLayout = { ...layout, zones: (layout.zones || []).map(normalizeZoneForEditor) }
      setConcerts(current => current.map(c => c.id === draft.id ? { ...c, zones: normalizedLayout.zones, layoutObjects: normalizedLayout.layoutObjects } : c))
      setToast('บันทึกผังและตำแหน่งที่นั่งเรียบร้อยแล้ว')
      return normalizedLayout
    } catch {
      setToast('บันทึกผังไม่สำเร็จ อาจมีบัตรอ้างอิงที่นั่งอยู่หรือ API ไม่พร้อมใช้งาน')
      return null
    }
  }
  const saveTickets = async draft => {
    try {
      const result = await saveTicketDesign(draft.id, draft.ticketLayoutObjects || [])
      setConcerts(current => current.map(c => c.id === draft.id ? { ...c, ticketLayoutObjects: result.objects } : c))
      setToast('บันทึกแบบบัตรเรียบร้อยแล้ว')
    } catch {
      setToast('บันทึกแบบบัตรไม่สำเร็จ กรุณาตรวจสอบ API และลองอีกครั้ง')
    }
  }
  const clearLayout = async () => {
    if (!deleting) return
    try {
      await clearConcertLayout(deleting.id)
      setConcerts(current => current.map(c => c.id === deleting.id ? { ...c, zones: [], layoutObjects: [] } : c))
      setDeleting(null)
      setToast('ล้างผังที่นั่งแล้ว โดยยังเก็บข้อมูลคอนเสิร์ตและแบบบัตรไว้')
    } catch {
      setDeleting(null)
      setToast('ล้างผังไม่สำเร็จ เพราะมีบัตรอ้างอิงที่นั่งอยู่หรือ API ไม่พร้อมใช้งาน')
    }
  }
  const cancel = () => {
    const item = concerts.find(c => c.id === editing)
    if (item && !item.name) setConcerts(current => current.filter(c => c.id !== editing))
    setEditing(null)
  }
  return <div className="app-shell venue-seat-app">{active ? <Editor source={active} onCancel={cancel} onSave={save} onSeatSave={saveSeats} onTicketSave={saveTickets}/> : <ConcertList concerts={concerts} onEdit={concert => setEditing(concert.id)} onDelete={setDeleting}/>} {deleting && <DeleteModal concert={deleting} onClose={() => setDeleting(null)} onConfirm={clearLayout}/>} {toast && <Toast message={toast} onDone={() => setToast('')}/>}</div>
}
