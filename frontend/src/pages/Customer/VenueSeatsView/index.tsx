import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Box,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import EventSeatOutlinedIcon from '@mui/icons-material/EventSeatOutlined'
import SearchIcon from '@mui/icons-material/Search'

const STORAGE_KEY = 'octavia-concerts-v1'

type Seat = {
  id: string
  disabled?: boolean
}

type LayoutItem = {
  id: string
  kind?: string
  shape?: 'rectangle' | 'circle' | 'triangle' | 'text' | 'line'
  name: string
  color?: string
  textColor?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  z?: number
}

type Zone = LayoutItem & {
  seats?: number
  seatItems?: Seat[]
  zonePrice?: number
  price?: number
  type?: string
}

type ConcertPlan = {
  id: string
  name: string
  zones?: Zone[]
  layoutObjects?: LayoutItem[]
}

type RenderedItem = {
  item: LayoutItem | Zone
  isZone: boolean
}

function readStoredConcerts(): ConcertPlan[] {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY)
    if (!rawValue) return []

    const value: unknown = JSON.parse(rawValue)
    return Array.isArray(value) ? value as ConcertPlan[] : []
  } catch {
    return []
  }
}

function getSeatCount(zone: Zone) {
  if (zone.seatItems?.length) return zone.seatItems.length
  return Number(zone.seats ?? 0)
}

function getShapeStyle(shape?: LayoutItem['shape']): CSSProperties {
  if (shape === 'circle') return { borderRadius: '50%' }
  if (shape === 'triangle') return { clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }
  if (shape === 'line') {
    return {
      minHeight: 3,
      border: 0,
      borderRadius: 999,
      padding: 0,
      boxShadow: 'none',
    }
  }
  return { borderRadius: 8 }
}

export default function VenueSeatsViewPage() {
  const [concerts] = useState<ConcertPlan[]>(readStoredConcerts)
  const [selectedConcertId, setSelectedConcertId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading] = useState(false)

  const availableConcerts = useMemo(
    () => concerts.filter((concert) => (concert.zones?.length ?? 0) > 0),
    [concerts],
  )
  const filteredConcerts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('th-TH')
    if (!normalizedQuery) return availableConcerts

    return availableConcerts.filter((concert) => (
      concert.name.toLocaleLowerCase('th-TH').includes(normalizedQuery)
    ))
  }, [availableConcerts, searchQuery])

  useEffect(() => {
    if (!filteredConcerts.some((concert) => concert.id === selectedConcertId)) {
      setSelectedConcertId(filteredConcerts[0]?.id ?? '')
    }
  }, [filteredConcerts, selectedConcertId])

  const selectedConcert = filteredConcerts.find(
    (concert) => concert.id === selectedConcertId,
  )
  const zones = useMemo(
    () => [...(selectedConcert?.zones ?? [])].sort(
      (left, right) => Number(left.z ?? 0) - Number(right.z ?? 0),
    ),
    [selectedConcert],
  )
  const renderedItems = useMemo<RenderedItem[]>(
    () => [
      ...(selectedConcert?.layoutObjects ?? []).map((item) => ({ item, isZone: false })),
      ...zones.map((item) => ({ item, isZone: true })),
    ].sort((left, right) => Number(left.item.z ?? 0) - Number(right.item.z ?? 0)),
    [selectedConcert, zones],
  )
  const totalSeats = zones.reduce((total, zone) => total + getSeatCount(zone), 0)

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1600,
        mx: 'auto',
        fontFamily: "'Noto Sans Thai', 'Inter', sans-serif",
        lineHeight: 1.5,
        '& .MuiInputBase-root, & .MuiInputLabel-root': {
          fontFamily: 'inherit',
          fontSize: 18,
        },
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          mb: 2.5,
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          display: 'flex',
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: '#fff0f6',
              color: '#d63384',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <EventSeatOutlinedIcon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#11183f', fontSize: 22, fontWeight: 700, lineHeight: 1.4 }}>
              ผังที่นั่งที่บันทึกแล้ว
            </Typography>
            <Typography sx={{ color: '#777b91', fontSize: 16, lineHeight: 1.5 }}>
              เลือกคอนเสิร์ตเพื่อดูตำแหน่งโซนและสรุปจำนวนที่นั่ง
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            width: { xs: '100%', md: 'auto' },
          }}
        >
          <TextField
            size="small"
            label="ค้นหาคอนเสิร์ต"
            placeholder="พิมพ์ชื่อคอนเสิร์ต..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            disabled={availableConcerts.length === 0}
            sx={{ width: { xs: '100%', sm: 220 }, flex: { sm: '1 1 220px' }, minWidth: 0 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#777b91', fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 240 }, flex: { sm: '1 1 240px' }, minWidth: 0 }}>
            <InputLabel id="saved-seat-concert-label">คอนเสิร์ต</InputLabel>
            <Select
              labelId="saved-seat-concert-label"
              value={selectedConcertId}
              label="คอนเสิร์ต"
              onChange={(event) => setSelectedConcertId(event.target.value)}
              disabled={filteredConcerts.length === 0}
            >
              {filteredConcerts.map((concert) => (
                <MenuItem key={concert.id} value={concert.id}>{concert.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {isLoading && availableConcerts.length === 0 ? (
        <Paper variant="outlined" sx={{ minHeight: 420, borderRadius: 3, display: 'grid', placeItems: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ color: '#d63384', mb: 1.5 }} />
            <Typography sx={{ color: '#777b91', fontSize: 18 }}>กำลังโหลดผังที่นั่ง...</Typography>
          </Box>
        </Paper>
      ) : !selectedConcert ? (
        <Paper variant="outlined" sx={{ minHeight: 420, borderRadius: 3, display: 'grid', placeItems: 'center' }}>
          <Box sx={{ textAlign: 'center', color: '#777b91' }}>
            <EventSeatOutlinedIcon sx={{ fontSize: 46, mb: 1, color: '#b4b6c3' }} />
            <Typography sx={{ fontWeight: 600, color: '#55596e', fontSize: 18, lineHeight: 1.5 }}>
              {searchQuery.trim()
                ? `ไม่พบคอนเสิร์ต “${searchQuery.trim()}” ที่มีผังที่นั่ง`
                : 'ยังไม่มีผังที่นั่งที่บันทึกไว้'}
            </Typography>
          </Box>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' },
            gap: 2.5,
            alignItems: 'start',
          }}
        >
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box
              sx={{
                minHeight: 72,
                px: 2.5,
                py: 1.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                bgcolor: '#fafafd',
                borderBottom: '1px solid #d8d8df',
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700, color: '#11183f', fontSize: 22, lineHeight: 1.4 }}>
                  {selectedConcert.name}
                </Typography>
                <Typography sx={{ color: '#777b91', fontSize: 14, lineHeight: 1.5 }}>
                  ผังแสดงผลอย่างเดียว ไม่สามารถลากหรือแก้ไขได้
                </Typography>
              </Box>
              <Typography sx={{ color: '#070d3d', fontSize: 28, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {totalSeats.toLocaleString('th-TH')}{' '}
                <Typography component="span" sx={{ fontSize: 14, fontWeight: 400 }}>ที่นั่ง</Typography>
              </Typography>
            </Box>

            <Box
              role="img"
              aria-label={`ผังที่นั่ง ${selectedConcert.name} รวม ${totalSeats} ที่นั่ง`}
              sx={{
                position: 'relative',
                height: { xs: 420, md: 560 },
                bgcolor: '#fff',
                backgroundImage:
                  'linear-gradient(#e7e7ec 1px, transparent 1px), linear-gradient(90deg, #e7e7ec 1px, transparent 1px)',
                backgroundSize: '25px 25px',
                overflow: 'hidden',
              }}
            >
              {renderedItems.map(({ item, isZone }) => {
                const zone = isZone ? item as Zone : undefined
                return (
                  <Box
                    key={`${isZone ? 'zone' : 'object'}-${item.id}`}
                    aria-label={zone ? `${zone.name} ${getSeatCount(zone)} ที่นั่ง` : item.name}
                    sx={{
                      position: 'absolute',
                      left: `${item.x ?? 50}%`,
                      top: `${item.y ?? 50}%`,
                      width: `${item.width || 12}%`,
                      height: `${item.height || 12}%`,
                      minWidth: item.shape === 'line' ? 0 : isZone ? 100 : 80,
                      minHeight: item.shape === 'line' ? 3 : isZone ? 76 : 48,
                      transform: `translate(-50%, -50%) rotate(${item.rotation ?? 0}deg)`,
                      zIndex: item.z ?? 1,
                      bgcolor: item.color || '#777b91',
                      color: item.textColor || '#fff',
                      border: item.shape === 'line' ? 0 : '3px solid #fff',
                      boxShadow: item.shape === 'line' ? 'none' : '0 7px 17px #11152c36',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 0.5,
                      overflow: 'hidden',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      ...getShapeStyle(item.shape),
                    }}
                  >
                    {item.shape !== 'line' && (
                      <>
                        <Typography sx={{ fontSize: 'clamp(14px, 1.25vw, 20px)', fontWeight: 700, lineHeight: 1.3 }}>
                          {item.name}
                        </Typography>
                        {zone && (
                          <>
                            <Typography sx={{ fontSize: 'clamp(12px, .9vw, 16px)', lineHeight: 1.35 }}>
                              {getSeatCount(zone)}
                            </Typography>
                            <Typography sx={{ fontSize: 'clamp(11px, .75vw, 14px)', lineHeight: 1.35, opacity: 0.9 }}>
                              {Number(zone.zonePrice ?? zone.price ?? 0).toLocaleString('th-TH')} ฿
                            </Typography>
                          </>
                        )}
                      </>
                    )}
                  </Box>
                )
              })}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ px: 2.25, py: 1.75, bgcolor: '#11183f', color: '#fff' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 22, lineHeight: 1.4 }}>สรุปจำนวนที่นั่งแต่ละโซน</Typography>
              <Typography sx={{ mt: 0.25, fontSize: 14, color: '#c8cad8', lineHeight: 1.5 }}>
                {zones.length} โซน · รวม {totalSeats.toLocaleString('th-TH')} ที่นั่ง
              </Typography>
            </Box>
            <Box sx={{ maxHeight: { lg: 560 }, overflowY: 'auto' }}>
              {zones.map((zone) => (
                <Box
                  key={zone.id}
                  sx={{
                    px: 2.25,
                    py: 1.4,
                    display: 'grid',
                    gridTemplateColumns: '14px minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: 1.25,
                    borderBottom: '1px solid #ececf1',
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: zone.color || '#777b91' }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ color: '#171a35', fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>
                      {zone.name}
                    </Typography>
                    <Typography sx={{ color: '#777b91', fontSize: 14, lineHeight: 1.5 }}>
                      {Number(zone.zonePrice ?? zone.price ?? 0).toLocaleString('th-TH')} บาท
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ color: '#070d3d', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                      {getSeatCount(zone).toLocaleString('th-TH')}
                    </Typography>
                    <Typography sx={{ color: '#777b91', fontSize: 12, lineHeight: 1.4 }}>ที่นั่ง</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  )
}
