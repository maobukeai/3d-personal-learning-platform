const FORMAT_COLORS: Record<string, { bg: string; accent: string; label: string }> = {
  GLB: { bg: '#1e3a5f', accent: '#3b82f6', label: 'GLB' },
  GLTF: { bg: '#1e3a5f', accent: '#60a5fa', label: 'GLTF' },
  FBX: { bg: '#3b1f4e', accent: '#a855f7', label: 'FBX' },
  OBJ: { bg: '#1f3b2e', accent: '#22c55e', label: 'OBJ' },
  STL: { bg: '#3b2f1f', accent: '#f59e0b', label: 'STL' },
  DAE: { bg: '#3b1f2e', accent: '#ec4899', label: 'DAE' },
  '3DS': { bg: '#1f2e3b', accent: '#06b6d4', label: '3DS' },
  MP4: { bg: '#3b1f1f', accent: '#ef4444', label: 'MP4' },
  WEBM: { bg: '#3b1f1f', accent: '#f97316', label: 'WEBM' },
}

const DEFAULT_STYLE = { bg: '#1e293b', accent: '#64748b', label: '3D' }

export function generateDefaultThumbnail(format: string, width = 400, height = 500): string {
  const style = FORMAT_COLORS[format?.toUpperCase()] || DEFAULT_STYLE

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, style.bg)
  gradient.addColorStop(1, '#0f172a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = style.accent
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.08
  for (let i = 0; i < width; i += 30) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, height)
    ctx.stroke()
  }
  for (let i = 0; i < height; i += 30) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(width, i)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  const cx = width / 2
  const cy = height / 2 - 20
  const size = 60

  ctx.strokeStyle = style.accent
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.moveTo(cx, cy - size)
  ctx.lineTo(cx + size, cy)
  ctx.lineTo(cx, cy + size)
  ctx.lineTo(cx - size, cy)
  ctx.closePath()
  ctx.stroke()

  ctx.globalAlpha = 0.15
  ctx.fillStyle = style.accent
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.beginPath()
  ctx.moveTo(cx, cy - size)
  ctx.lineTo(cx + size, cy)
  ctx.strokeStyle = style.accent
  ctx.lineWidth = 2.5
  ctx.globalAlpha = 0.9
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.beginPath()
  ctx.moveTo(cx + size, cy)
  ctx.lineTo(cx, cy + size)
  ctx.globalAlpha = 0.5
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.beginPath()
  ctx.moveTo(cx, cy + size)
  ctx.lineTo(cx - size, cy)
  ctx.globalAlpha = 0.3
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.beginPath()
  ctx.moveTo(cx - size, cy)
  ctx.lineTo(cx, cy - size)
  ctx.globalAlpha = 0.15
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.fillStyle = style.accent
  ctx.font = 'bold 28px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(style.label, cx, cy + size + 40)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('3D 模型资产', cx, cy + size + 65)

  return canvas.toDataURL('image/png')
}

export function getDefaultThumbnailUrl(format: string): string {
  return generateDefaultThumbnail(format)
}
