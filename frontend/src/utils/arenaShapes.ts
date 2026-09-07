import type { ZoneShape } from '@/interface/IZoneInterface'

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180
  return { x: cx + radius * Math.cos(angleRad), y: cy + radius * Math.sin(angleRad) }
}

function arcPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle)
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle)
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle)
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

export function zoneShapeToPath(shape: ZoneShape, cx: number, cy: number): string {
  if (shape.kind === 'rect') {
    return `M ${shape.x} ${shape.y} h ${shape.width} v ${shape.height} h ${-shape.width} Z`
  }
  return arcPath(cx, cy, shape.innerRadius, shape.outerRadius, shape.startAngle, shape.endAngle)
}

export function zoneShapeCenter(
  shape: ZoneShape,
  cx: number,
  cy: number,
): { x: number; y: number } {
  if (shape.kind === 'rect') {
    return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }
  }
  const midAngle = (shape.startAngle + shape.endAngle) / 2
  const midRadius = (shape.innerRadius + shape.outerRadius) / 2
  return polarToCartesian(cx, cy, midRadius, midAngle)
}
