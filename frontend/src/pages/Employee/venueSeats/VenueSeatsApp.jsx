import { useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, CheckIcon, CloseIcon, EditIcon, PlusIcon, SaveIcon, SearchIcon, TrashIcon, UploadIcon, UsersIcon } from './icons'
import { clearConcertLayout, loadConcert, loadConcertLayout, loadConcerts, saveConcertLayout, savePublication } from './api'

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
    <div className="page-heading"><div><span className="eyebrow">CONCERT MANAGEMENT</span><h1>จัดการรายการคอนเสิร์ต</h1><p>เลือกคอนเสิร์ตเพื่อดูข้อมูล จัดการการเผยแพร่ และออกแบบผังที่นั่ง</p></div></div>
    <section className="filter-card">
      <label><span>ค้นหา</span><div className="search-box"><input value={query} onChange={e => { setQuery(e.target.value); setCurrentPage(1) }} placeholder="ชื่อคอนเสิร์ต หรือ ศิลปิน..."/><SearchIcon/></div></label>
      <label><span>สถานะ</span><select value={status} onChange={e => { setStatus(e.target.value); setCurrentPage(1) }}><option>ทั้งหมด</option><option>ฉบับร่าง</option><option>กำลังแสดง</option><option>สิ้นสุดแล้ว</option></select></label>
    </section>
    <section className="table-card">
      <div className="concert-table table-head"><span>หน้าปก</span><span>ชื่อคอนเสิร์ต</span><span>ศิลปิน</span><span>วันที่แสดง</span><span>สถานที่</span><span>สถานะ</span><span>จัดการ</span></div>
      {visibleConcerts.length ? visibleConcerts.map(concert => <div className="concert-table table-row" key={concert.id}>
        <span><Poster concert={concert}/></span><strong>{concert.name}</strong><span>{concert.artist || '-'}</span>
        <span>{formatDateRange(concert.date, concert.endDate)}</span><span>{concert.location || '-'}</span>
        <span><i className={`status-pill ${concert.status === 'ฉบับร่าง' ? 'draft' : ''}`}>{concert.status}</i></span>
        <span className="actions"><button title="เปิดรายละเอียด" onClick={() => onEdit(concert)}><EditIcon/></button><button className="danger-icon" title="ล้างผังที่นั่ง" onClick={() => onDelete(concert)}><TrashIcon/></button></span>
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
  const f = value => {
    const text = String(value || '').trim()
    const parsed = new Date(text.includes('T') ? text : `${text}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? text || '-' : new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
  }
  return end ? `${f(start)} - ${f(end)}` : f(start)
}

function FormField({ label, required, children, className = '' }) {
  return <label className={`field ${className}`}><span>{label}{required && <em>*</em>}</span>{children}</label>
}

function GeneralTab({ draft }) {
  return <div className="general-grid">
    <div className="form-grid">
      <FormField label="ชื่อคอนเสิร์ต" className="full"><input value={draft.name || ''} readOnly/></FormField>
      <FormField label="สถานที่จัดงาน"><input value={draft.location || ''} readOnly/></FormField>
      <FormField label="สถานะคอนเสิร์ต"><input value={draft.status || ''} readOnly/></FormField>
      <FormField label="ศิลปิน/ไลน์อัพ" className="full"><input value={draft.artist || ''} readOnly/></FormField>
      <FormField label="วันที่แสดง"><input type="date" value={draft.date || ''} readOnly/></FormField>
      <FormField label="วันสิ้นสุด"><input type="date" value={draft.endDate || ''} readOnly/></FormField>
      <FormField label="คำอธิบายงาน" className="full"><textarea value={draft.description || ''} readOnly/></FormField>
    </div>
    <FormField label="รูปภาพปกคอนเสิร์ต">
      <div className={`upload-box cover-upload readonly-upload ${draft.cover ? 'has-image' : ''}`}>
        {draft.cover ? <img src={draft.cover} alt="ปกคอนเสิร์ต"/> : <><UploadIcon size={34}/><b>ไม่มีรูปภาพปก</b></>}
      </div>
    </FormField>
  </div>
}

function RoundsTab({ rounds }) {
  return <div className="rounds-section">
    <div className="section-bar"><div><h3>รอบการแสดง</h3><p>ข้อมูลจากตารางการแสดงและข้อมูลคอนเสิร์ต</p></div></div>
    <div className="round-table"><div className="round-row round-head"><span>รอบที่</span><span>วันที่แสดง</span><span>เวลาเปิดประตู</span><span>เวลาเริ่ม</span><span>เวลาจบ</span><span>สถานะ</span></div>
      {rounds.map(round => <div className="round-row" key={round.id}><strong>{round.performanceOrder}</strong><span>{formatDateRange(round.date)}</span><span>{round.doorTime || '-'} น.</span><span>{round.startShow || '-'} น.</span><span>{round.endShow || '-'} น.</span><span><i className="status-pill">{round.status}</i></span></div>)}
      {!rounds.length && <div className="empty">ยังไม่มีข้อมูลรอบการแสดง</div>}
    </div>
  </div>
}

function PublishingTab({ value, setValue }) {
  const fileRef = useRef(null)
  const update = (key, next) => setValue({ ...value, [key]: next })
  const chooseImage = event => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setValue({ ...value, posterImage: reader.result })
    reader.readAsDataURL(file)
  }
  return <div className="publishing-grid">
    <div><h3>รูปภาพการเผยแพร่</h3><button className={`upload-box schedule-upload ${value.posterImage ? 'has-image' : ''}`} onClick={() => fileRef.current.click()}>{value.posterImage ? <><img src={value.posterImage} alt="ภาพตัวอย่างการเผยแพร่"/><span className="btn subtle change-image">เปลี่ยนรูป</span></> : <><UploadIcon size={38}/><b>เลือกไฟล์รูปภาพ</b><small>รองรับ JPG, PNG และ WEBP</small><span className="btn subtle">เลือกไฟล์</span></>}</button><input hidden ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage}/></div>
    <div className="publishing-fields">
      <FormField label="คำอธิบายการเผยแพร่"><textarea value={value.description || ''} onChange={e => update('description', e.target.value)}/></FormField>
      <FormField label="วันที่เปิดขายบัตร"><input type="datetime-local" value={value.saleStart} onChange={e => update('saleStart', e.target.value)}/></FormField>
      <FormField label="วันที่ปิดการจอง"><input type="datetime-local" value={value.saleEnd} onChange={e => update('saleEnd', e.target.value)}/></FormField>
      <FormField label="วันที่นำขึ้นหน้าเว็บ"><input type="datetime-local" value={value.publishAt} onChange={e => update('publishAt', e.target.value)}/></FormField>
      <FormField label="วันที่นำออกจากหน้าเว็บ"><input type="datetime-local" value={value.unpublishAt} onChange={e => update('unpublishAt', e.target.value)}/></FormField>
    </div>
  </div>
}

const shapeNames = { rectangle: 'สี่เหลี่ยม', circle: 'วงกลม', triangle: 'สามเหลี่ยม' }
const shapeStyle = shape => shape === 'circle' ? { borderRadius: '50%' } : shape === 'triangle' ? { clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' } : { borderRadius: '8px' }

function createFlowchartImage(zones, objects) {
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 800
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#edf0f5'
  context.lineWidth = 1
  for (let x = 0; x <= canvas.width; x += 28) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke() }
  for (let y = 0; y <= canvas.height; y += 28) { context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke() }

  const items = [...objects, ...zones].sort((a, b) => Number(a.z || 0) - Number(b.z || 0))
  items.forEach(item => {
    const centerX = Number(item.x || 0) / 100 * canvas.width
    const centerY = Number(item.y || 0) / 100 * canvas.height
    const width = Number(item.width || 12) / 100 * canvas.width
    const height = Number(item.height || 12) / 100 * canvas.height
    context.save()
    context.translate(centerX, centerY)
    context.rotate(Number(item.rotation || 0) * Math.PI / 180)
    context.fillStyle = item.color || '#777b91'
    context.beginPath()
    if (item.shape === 'circle') context.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2)
    else if (item.shape === 'triangle') { context.moveTo(0, -height / 2); context.lineTo(width / 2, height / 2); context.lineTo(-width / 2, height / 2); context.closePath() }
    else context.rect(-width / 2, -Math.max(height, 3) / 2, width, Math.max(height, 3))
    context.fill()

    if (item.kind !== 'object') {
      context.fillStyle = '#ffffff'
      for (const seat of item.seatItems || []) {
        const seatX = -width / 2 + Number(seat.x || 0) / 100 * width
        const seatY = -height / 2 + Number(seat.y || 0) / 100 * height
        context.globalAlpha = seat.disabled ? 0.35 : 0.9
        context.beginPath(); context.arc(seatX, seatY, 3, 0, Math.PI * 2); context.fill()
      }
      context.globalAlpha = 1
    }
    if (item.shape !== 'line') {
      context.fillStyle = item.textColor || '#ffffff'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.font = '600 18px sans-serif'
      context.fillText(item.name || '', 0, 0, Math.max(20, width - 12))
    }
    context.restore()
  })
  return canvas.toDataURL('image/png')
}

function arrangeSeats(count, shape, oldSeats = []) {
  const total = Math.max(0, Number(count) || 0)
  return Array.from({ length: total }, (_, index) => {
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
      x = 50 + (position - row / 2) * (82 / Math.max(rows, 1))
      y = 10 + row * (80 / Math.max(rows - 1, 1))
    } else {
      const columns = Math.max(1, Math.ceil(Math.sqrt(total * 1.5)))
      const rows = Math.ceil(total / columns)
      x = 7 + (index % columns) * (86 / Math.max(columns - 1, 1))
      y = 9 + Math.floor(index / columns) * (82 / Math.max(rows - 1, 1))
    }
    const existing = oldSeats[index]
    return existing ? { ...existing, x, y } : { id: `seat-${Date.now()}-${index}`, name: `${String.fromCharCode(65 + Math.floor(index / 26))}${index + 1}`, x, y, disabled: false }
  })
}

function ItemModal({ kind, shape, onClose, onSave }) {
  const isZone = kind === 'zone'
  const [item, setItem] = useState({ id: `${kind}-${Date.now()}`, kind, shape, name: isZone ? '' : 'วัตถุ', color: isZone ? '#e72d70' : '#777b91', textColor: '#ffffff', seats: 0, seatItems: [], price: 0, type: 'ปกติ', x: 50, y: 50, width: 13, height: 15, rotation: 0, z: Date.now() })
  const update = (key, value) => setItem(current => ({ ...current, [key]: value }))
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal zone-modal">
    <div className="modal-title"><div><span className="eyebrow">LAYOUT ITEM</span><h2>สร้าง{isZone ? 'โซนที่นั่ง' : 'วัตถุปกติ'}รูป{shapeNames[shape]}</h2></div><button className="icon-button" onClick={onClose}><CloseIcon/></button></div>
    <div className="form-grid">
      <FormField label={isZone ? 'ชื่อโซน' : 'ชื่อวัตถุ'} required><input value={item.name} onChange={e => update('name', e.target.value)} placeholder={isZone ? 'เช่น A1' : 'เช่น เวที หรือ ทางเข้า'}/></FormField>
      <FormField label="สี" required><input className="color-input" type="color" value={item.color} onChange={e => update('color', e.target.value)}/></FormField>
      {isZone && <><FormField label="ราคา (บาท)"><input type="number" min="0" value={item.price} onChange={e => update('price', +e.target.value)}/></FormField><FormField label="ประเภทบัตร"><input value={item.type} onChange={e => update('type', e.target.value)}/></FormField></>}
    </div>
    <div className="modal-actions"><button className="btn ghost" onClick={onClose}>ยกเลิก</button><button disabled={!item.name} className="btn primary" onClick={() => onSave(item)}><PlusIcon/>สร้าง{isZone ? 'โซน' : 'วัตถุ'}</button></div>
  </div></div>
}

function ZoneDetail({ zone, onBack, onSave, onDelete }) {
  const [working, setWorking] = useState(() => ({ ...zone, shape: zone.shape || 'rectangle', seatItems: zone.seatItems?.length ? zone.seatItems : arrangeSeats(zone.seats, zone.shape || 'rectangle') }))
  const [addCount, setAddCount] = useState(1)
  const [selectedSeat, setSelectedSeat] = useState(null)
  const seatCanvas = useRef(null)
  const update = (key, value) => setWorking(current => ({ ...current, [key]: value }))
  const changeShape = shape => setWorking(current => ({ ...current, shape, seatItems: arrangeSeats(current.seatItems.length, shape, current.seatItems) }))
  const addSeats = () => setWorking(current => { const count = current.seatItems.length + Math.max(1, addCount); return { ...current, seats: count, seatItems: arrangeSeats(count, current.shape, current.seatItems) } })
  const updateSeat = next => { setWorking(current => ({ ...current, seatItems: current.seatItems.map(seat => seat.id === next.id ? next : seat) })); setSelectedSeat(next) }
  const dragSeat = (event, seat) => {
    event.stopPropagation(); setSelectedSeat(seat)
    const rect = seatCanvas.current.getBoundingClientRect()
    const move = e => updateSeat({ ...seat, x: Math.max(2, Math.min(98, (e.clientX - rect.left) / rect.width * 100)), y: Math.max(3, Math.min(97, (e.clientY - rect.top) / rect.height * 100)) })
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const activeSeat = working.seatItems.find(seat => seat.id === selectedSeat?.id)
  const disabledCount = working.seatItems.filter(seat => seat.disabled).length
  return <div className="zone-detail">
    <div className="section-bar"><button className="back-link" onClick={onBack}><ArrowLeftIcon/>กลับไปยังผังรวม</button><div className="detail-actions"><button className="btn danger small" onClick={onDelete}><TrashIcon/>ลบโซน</button><button className="btn success small" onClick={() => onSave({ ...working, seats: working.seatItems.length })}><SaveIcon/>บันทึกผังที่นั่ง</button></div></div>
    <div className="seat-editor-toolbar"><div className="shape-switch"><b>รูปทรงโซน</b>{Object.keys(shapeNames).map(shape => <button key={shape} className={working.shape === shape ? 'active' : ''} onClick={() => changeShape(shape)}><i className={`shape-icon ${shape}`}></i>{shapeNames[shape]}</button>)}</div><div className="add-seat-control"><input type="number" min="1" value={addCount} onChange={e => setAddCount(+e.target.value)}/><button className="btn primary small" onClick={addSeats}><PlusIcon/>เพิ่มเก้าอี้</button></div></div>
    <div className="zone-detail-grid">
      <div className="seat-shape-frame"><div ref={seatCanvas} className={`free-seat-canvas ${working.shape}`} style={{ '--zone-color': working.color }} onClick={() => setSelectedSeat(null)}>{working.seatItems.map(seat => <button key={seat.id} className={`free-seat ${seat.disabled ? 'disabled' : ''} ${activeSeat?.id === seat.id ? 'selected' : ''}`} style={{ left: `${seat.x}%`, top: `${seat.y}%` }} onPointerDown={e => dragSeat(e, seat)} onClick={e => { e.stopPropagation(); setSelectedSeat(seat) }}>{seat.name}</button>)}</div><p className="seat-hint">ลากเก้าอี้ได้อย่างอิสระ และคลิกเพื่อแก้ชื่อรายตัว</p></div>
      <aside className="zone-form"><div className="zone-badge" style={{ background: working.color, ...shapeStyle(working.shape) }}>{working.name}<small>{working.seatItems.length} ที่นั่ง</small></div>
        <FormField label="ชื่อโซน"><input value={working.name} onChange={e => update('name', e.target.value)}/></FormField><FormField label="สีโซน"><input className="color-input" type="color" value={working.color} onChange={e => update('color', e.target.value)}/></FormField><FormField label="ราคา"><input type="number" value={working.price} onChange={e => update('price', +e.target.value)}/></FormField><FormField label="ประเภท"><input value={working.type} onChange={e => update('type', e.target.value)}/></FormField>
        {activeSeat && <div className="seat-inspector"><b>เก้าอี้ที่เลือก</b><FormField label="ชื่อเก้าอี้"><input value={activeSeat.name} onChange={e => updateSeat({ ...activeSeat, name: e.target.value })}/></FormField><button className={`btn small ${activeSeat.disabled ? 'success' : 'ghost'}`} onClick={() => updateSeat({ ...activeSeat, disabled: !activeSeat.disabled })}>{activeSeat.disabled ? 'เปิดใช้งานเก้าอี้' : 'ปิดใช้งานเก้าอี้'}</button><button className="btn danger small" onClick={() => { setWorking(current => ({ ...current, seatItems: current.seatItems.filter(seat => seat.id !== activeSeat.id) })); setSelectedSeat(null) }}><TrashIcon/>ลบเก้าอี้</button></div>}
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
  const duplicate = () => { if (!selectedItem) return; const copy = { ...selectedItem, id: `${selectedItem.kind}-${Date.now()}`, name: `${selectedItem.name} สำเนา`, x: Math.min(94, selectedItem.x + 4), y: Math.min(94, selectedItem.y + 4), z: Date.now(), seatItems: selectedItem.seatItems?.map(seat => ({ ...seat, id: `seat-${Date.now()}-${seat.id}` })) }; if (copy.kind === 'object') setObjects([...objects, copy]); else setZones([...zones, copy]); setSelected({ kind: copy.kind || 'zone', id: copy.id }) }
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
  if (detailZone) return <ZoneDetail zone={detailZone} onBack={() => setDetailId(null)} onSave={updated => { const next = zones.map(zone => zone.id === updated.id ? updated : zone); setZones(next); onSeatSave(next, objects, createFlowchartImage(next, objects)); setDetailId(null) }} onDelete={() => { const next = zones.filter(zone => zone.id !== detailZone.id); setZones(next); onSeatSave(next, objects, createFlowchartImage(next, objects)); setDetailId(null) }}/>
  const orderedItems = [...objects, ...zones].sort((a, b) => Number(a.z || 0) - Number(b.z || 0))
  const addQuickObject = (shape, name) => setObjects([...objects, { id: `object-${Date.now()}`, kind: 'object', shape, name, color: '#777b91', textColor: '#ffffff', x: 50, y: 50, width: shape === 'line' ? 25 : 14, height: shape === 'line' ? 1 : 10, rotation: 0, z: Date.now() }])
  return <div className="seat-planner">
    <div className="seat-summary"><div><UsersIcon/><span>ความจุรวมทั้งหมด<small>นับเฉพาะวัตถุที่กำหนดเป็นโซน</small></span></div><strong>{total.toLocaleString('th-TH')} <small>ที่นั่ง</small></strong><button className="btn success small" onClick={() => onSeatSave(zones, objects, createFlowchartImage(zones, objects))}><SaveIcon/>บันทึกผังที่นั่ง</button></div>
    <div className="designer-toolbar"><div className="tool-group"><b>โซน</b>{Object.keys(shapeNames).map(shape => <button key={`z-${shape}`} title={`สร้างโซน${shapeNames[shape]}`} onClick={() => setCreateConfig({ kind: 'zone', shape })}><i className={`shape-icon ${shape}`}></i>{shapeNames[shape]}</button>)}</div><div className="tool-divider"></div><div className="tool-group"><b>วัตถุปกติ</b>{Object.keys(shapeNames).map(shape => <button key={`o-${shape}`} title={`สร้างวัตถุ${shapeNames[shape]}`} onClick={() => setCreateConfig({ kind: 'object', shape })}><i className={`shape-icon ${shape}`}></i>{shapeNames[shape]}</button>)}<button onClick={() => addQuickObject('text', 'ข้อความ')}><b className="text-tool">T</b>ข้อความ</button><button onClick={() => addQuickObject('line', '')}><b className="line-tool"></b>เส้น</button><button onClick={() => addQuickObject('text', '→')}><b className="arrow-tool">→</b>ลูกศร</button></div></div>
    {selectedItem && <div className="item-inspector"><span className={`kind-pill ${selectedItem.kind || 'zone'}`}>{selectedItem.kind === 'object' ? 'วัตถุปกติ' : 'โซนที่นั่ง'}</span><input aria-label="ชื่อวัตถุ" value={selectedItem.name} onChange={e => updateItem({ ...selectedItem, name: e.target.value })}/><label>สี <input type="color" value={selectedItem.color} onChange={e => updateItem({ ...selectedItem, color: e.target.value })}/></label><label className="range-control">กว้าง <input aria-label="ความกว้าง" type="range" min="2" max="80" step="1" value={selectedItem.width || 12} onChange={e => updateItem({ ...selectedItem, width: +e.target.value })}/><output>{selectedItem.width || 12}%</output></label><label className="range-control">สูง <input aria-label="ความสูง" type="range" min="1" max="80" step="1" value={selectedItem.height || 12} onChange={e => updateItem({ ...selectedItem, height: +e.target.value })}/><output>{selectedItem.height || 12}%</output></label><label>หมุน <input type="number" value={selectedItem.rotation || 0} onChange={e => updateItem({ ...selectedItem, rotation: +e.target.value })}/></label><button onClick={() => moveLayer(1)}>ขึ้นหน้า</button><button onClick={() => moveLayer(-1)}>ลงหลัง</button><button onClick={duplicate}>คัดลอก</button><button className="danger-tool" onClick={removeSelected}><TrashIcon size={16}/></button></div>}
    <div className="map-toolbar"><span><b>ผังที่นั่ง</b> ลากวัตถุได้อิสระทุกตำแหน่ง</span><span className="legend"><i></i>ดับเบิลคลิกโซนเพื่อจัดเก้าอี้</span></div>
    <div className="zone-map designer-map" ref={mapRef} onPointerDown={() => setSelected(null)}>
      {orderedItems.map((item, index) => <button key={item.id} className={`layout-item ${item.kind || 'zone'} ${item.shape || 'rectangle'} ${selected?.id === item.id ? 'selected' : ''}`} style={{ left:`${item.x}%`,top:`${item.y}%`,width:`${item.width || 12}%`,height:`${item.height || 12}%`,background:item.color,color:item.textColor || '#fff',transform:`translate(-50%,-50%) rotate(${item.rotation || 0}deg)`,zIndex:index + 1,...shapeStyle(item.shape) }} onPointerDown={e => dragItem(e,item)} onDoubleClick={() => item.kind !== 'object' && setDetailId(item.id)}>{item.shape === 'line' ? '' : <><strong>{item.name}</strong>{item.kind !== 'object' && <><span>{item.seatItems?.length ?? item.seats ?? 0}</span><small>{Number(item.price || 0).toLocaleString()} ฿</small></>}</>}</button>)}
      {!zones.length && !objects.length && <div className="empty-map"><UsersIcon size={38}/><b>ผังยังว่างอยู่</b><span>เลือกเครื่องมือด้านบนเพื่อสร้างโซนหรือวัตถุ</span></div>}
    </div>
    {createConfig && <ItemModal {...createConfig} onClose={() => setCreateConfig(null)} onSave={item => { if (item.kind === 'zone') setZones([...zones,item]); else setObjects([...objects,item]); setCreateConfig(null) }}/>} 
  </div>
}

function Editor({ source, onCancel, onPublicationSave, onLayoutLoad, onSeatSave, onError, onToast }) {
  const [draft, setDraft] = useState(() => structuredClone(source))
  const [tab, setTab] = useState('general')
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  const [layoutLoading, setLayoutLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const changeTab = async nextTab => {
    setTab(nextTab)
    if (nextTab !== 'seats' || layoutLoaded || layoutLoading) return
    setLayoutLoading(true)
    try {
      const layout = await onLayoutLoad(source.id)
      setDraft(current => ({ ...current, zones: layout.zones || [], layoutObjects: layout.layoutObjects || [], flowchart: layout.flowchart || '' }))
      setLayoutLoaded(true)
    } catch (error) {
      onError(error.message)
    } finally {
      setLayoutLoading(false)
    }
  }
  const saveSeatLayout = async (zones, layoutObjects, flowchart) => {
    setSaving(true)
    try {
      const saved = await onSeatSave(source.id, zones, layoutObjects, flowchart)
      setDraft(current => ({ ...current, zones: saved.zones, layoutObjects: saved.layoutObjects, flowchart: saved.flowchart }))
      onToast('บันทึกผังและตำแหน่งที่นั่งเรียบร้อยแล้ว')
    } catch (error) {
      onError(error.message)
    } finally {
      setSaving(false)
    }
  }
  const savePublishing = async () => {
    setSaving(true)
    try {
      const saved = await onPublicationSave(source.id, draft.publishing)
      update('publishing', saved)
      onToast('บันทึกข้อมูลการเผยแพร่เรียบร้อยแล้ว')
    } catch (error) {
      onError(error.message)
    } finally {
      setSaving(false)
    }
  }
  const tabs = [{ id: 'general', label: 'ข้อมูลทั่วไป' }, { id: 'rounds', label: 'รอบการแสดง' }, { id: 'publishing', label: 'การเผยแพร่' }, { id: 'seats', label: 'ผังที่นั่ง' }]
  return <main className="content editor-page">
    <div className="editor-heading"><div><button className="back-link" onClick={onCancel}><ArrowLeftIcon/>กลับไปหน้ารายการ</button><h1>รายละเอียดคอนเสิร์ต</h1><p>{source.name}</p></div><div className="header-actions"><button className="btn danger" onClick={onCancel}>ย้อนกลับ</button>{tab === 'publishing' && <button className="btn success" disabled={saving} onClick={savePublishing}><SaveIcon/>{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>}</div></div>
    <section className="editor-card"><nav className="tabs">{tabs.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => changeTab(item.id)}>{item.label}{item.id === 'rounds' && <small>{draft.rounds.length}</small>}{item.id === 'seats' && layoutLoaded && <small>{draft.zones?.length || 0}</small>}</button>)}</nav>
      <div className="tab-content">
        {tab === 'general' && <GeneralTab draft={draft}/>}
        {tab === 'rounds' && <RoundsTab rounds={draft.rounds}/>}
        {tab === 'publishing' && <PublishingTab value={draft.publishing} setValue={value => update('publishing', value)}/>} 
        {tab === 'seats' && layoutLoading && <div className="empty">กำลังโหลดผังที่นั่ง...</div>}
        {tab === 'seats' && !layoutLoading && layoutLoaded && <SeatPlanner zones={draft.zones || []} setZones={zones => update('zones', zones)} objects={draft.layoutObjects || []} setObjects={objects => update('layoutObjects', objects)} onSeatSave={saveSeatLayout}/>}
      </div>
    </section>
  </main>
}

function DeleteModal({ concert, onClose, onConfirm }) {
  return <div className="modal-backdrop"><div className="modal delete-modal"><div className="delete-symbol"><TrashIcon size={34}/></div><h2>ยืนยันการล้างผังที่นั่ง?</h2><p>ระบบจะล้างเฉพาะผัง โซน และเก้าอี้ของ <b>{concert.name}</b><br/>ข้อมูลคอนเสิร์ตหลักจะยังคงอยู่</p><div className="modal-actions centered"><button className="btn ghost" onClick={onClose}>ยกเลิก</button><button className="btn danger" onClick={onConfirm}><TrashIcon/>ยืนยันการล้างผัง</button></div></div></div>
}

export default function App() {
  const [concerts, setConcerts] = useState([])
  const [active, setActive] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadConcerts().then(items => { if (!cancelled) setConcerts(items || []) }).catch(reason => { if (!cancelled) setError(reason.message) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const openEditor = async concert => {
    setLoading(true); setError('')
    try {
      const detail = await loadConcert(concert.id)
      setActive(detail)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setLoading(false)
    }
  }
  const clearLayout = async () => {
    try {
      await clearConcertLayout(deleting.id)
      if (active?.id === deleting.id) setActive(current => ({ ...current, zones: [], layoutObjects: [], flowchart: '' }))
      setDeleting(null)
      setToast('ล้างผังที่นั่งแล้ว โดยยังเก็บข้อมูลคอนเสิร์ตไว้')
    } catch (reason) {
      setDeleting(null)
      setError(reason.message)
    }
  }
  return <div className="app-shell venue-seat-app">
    {error && <div className="api-error"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}
    {loading && <div className="api-loading">กำลังโหลดข้อมูล...</div>}
    {active
      ? <Editor source={active} onCancel={() => setActive(null)} onPublicationSave={savePublication} onLayoutLoad={loadConcertLayout} onSeatSave={saveConcertLayout} onError={setError} onToast={setToast}/>
      : <ConcertList concerts={concerts} onEdit={openEditor} onDelete={setDeleting}/>}
    {deleting && <DeleteModal concert={deleting} onClose={() => setDeleting(null)} onConfirm={clearLayout}/>}
    {toast && <Toast message={toast} onDone={() => setToast('')}/>}
  </div>
}
