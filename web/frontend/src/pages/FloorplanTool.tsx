/**
 * Floorplan 测量工具 — 公开页面，不登录即可用
 * 访问 /tools/floorplan
 *
 * 流程：
 *   1. 上传户型图
 *   2. 点两下校准（在门/床/已标注尺寸的边上），输入真实长度 → 建立 px↔cm 比例
 *   3. 用距离/矩形工具量出其他房间
 *   4. 导出标注好的 PNG
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, InputNumber, Modal, Segmented, Upload, message } from 'antd'

type Point = { x: number; y: number } // 图片原始像素坐标

type Annotation =
  | { id: string; type: 'distance'; p1: Point; p2: Point }
  | { id: string; type: 'rectangle'; p1: Point; p2: Point }

type Tool = 'calibrate' | 'distance' | 'rectangle' | 'pan'

type View = { scale: number; offsetX: number; offsetY: number }

const TOOL_OPTIONS: { label: string; value: Tool; hint: string }[] = [
  { label: '校准', value: 'calibrate', hint: '点两下已知长度的线段' },
  { label: '距离', value: 'distance', hint: '点两下测量任意距离' },
  { label: '矩形', value: 'rectangle', hint: '拖出矩形测量房间' },
  { label: '平移', value: 'pan', hint: '拖动画面' },
]

type Preset = { label: string; cm: number; hint?: string }

const DOOR_PRESETS: Preset[] = [
  { label: '卧室/大门 3ft（最常见）', cm: 91.5 },
  { label: '卧室门 38"（新盘）', cm: 96.5 },
  { label: '卧室门 33"（老式）', cm: 83.8 },
  { label: '卫生间门', cm: 76 },
  { label: '大门双开', cm: 122 },
]
const BED_PRESETS: Preset[] = [
  { label: '双人床 Queen/Double 宽', cm: 150 },
  { label: '单人床 宽', cm: 90 },
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function distancePx(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function formatLength(cm: number): string {
  if (cm >= 100) return `${(cm / 100).toFixed(2)} m`
  return `${cm.toFixed(0)} cm`
}

function formatArea(sqm: number): string {
  return `${sqm.toFixed(2)} m²`
}

export default function FloorplanTool() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const imageUrlRef = useRef<string | null>(null)

  const [hasImage, setHasImage] = useState(false)
  const [view, setView] = useState<View>({ scale: 1, offsetX: 0, offsetY: 0 })
  const [tool, setTool] = useState<Tool>('calibrate')
  const [pxPerCm, setPxPerCm] = useState<number | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 正在绘制中的第一点（距离/校准）或拖动起点（矩形）
  const [drawStart, setDrawStart] = useState<Point | null>(null)
  // 当前鼠标位置（图片坐标），用于预览绘制中的线
  const [cursor, setCursor] = useState<Point | null>(null)
  // 平移拖拽的屏幕起点
  const panStartRef = useRef<{ sx: number; sy: number; offsetX: number; offsetY: number } | null>(null)

  // 校准完两点后等待用户输入真实长度
  const [pendingCalib, setPendingCalib] = useState<{ p1: Point; p2: Point } | null>(null)

  // 上传
  const handleUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
      const img = new Image()
      img.onload = () => {
        imageRef.current = img
        imageUrlRef.current = url
        setHasImage(true)
        // 重置所有状态
        setPxPerCm(null)
        setAnnotations([])
        setSelectedId(null)
        setDrawStart(null)
        setTool('calibrate')
        fitImageToContainer(img)
      }
      img.onerror = () => message.error('图片加载失败')
      img.src = url
    }
    reader.readAsDataURL(file)
    return false // 阻止 antd 默认上传
  }, [])

  const fitImageToContainer = useCallback((img: HTMLImageElement) => {
    const container = containerRef.current
    if (!container) return
    const cw = container.clientWidth
    const ch = container.clientHeight
    const margin = 40
    const scale = Math.min((cw - margin) / img.width, (ch - margin) / img.height, 1)
    const offsetX = (cw - img.width * scale) / 2
    const offsetY = (ch - img.height * scale) / 2
    setView({ scale, offsetX, offsetY })
  }, [])

  // 图片坐标 <-> 屏幕坐标
  const screenToImage = useCallback(
    (sx: number, sy: number): Point => ({
      x: (sx - view.offsetX) / view.scale,
      y: (sy - view.offsetY) / view.scale,
    }),
    [view]
  )

  // 渲染
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const container = containerRef.current
    if (!container) return
    const cw = container.clientWidth
    const ch = container.clientHeight

    // 重设 canvas 尺寸以匹配容器 + DPR
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr
      canvas.height = ch * dpr
      canvas.style.width = `${cw}px`
      canvas.style.height = `${ch}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)
    ctx.fillStyle = '#f5f5f4'
    ctx.fillRect(0, 0, cw, ch)

    if (!img) return

    // 画图片
    ctx.save()
    ctx.translate(view.offsetX, view.offsetY)
    ctx.scale(view.scale, view.scale)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(img, 0, 0)
    ctx.restore()

    // 画标注（屏幕空间，保证线宽和字号不随缩放变化）
    const drawLine = (p1: Point, p2: Point, color: string, dashed = false) => {
      const s1 = { x: p1.x * view.scale + view.offsetX, y: p1.y * view.scale + view.offsetY }
      const s2 = { x: p2.x * view.scale + view.offsetX, y: p2.y * view.scale + view.offsetY }
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      if (dashed) ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(s1.x, s1.y)
      ctx.lineTo(s2.x, s2.y)
      ctx.stroke()
      // 端点小圆
      ctx.setLineDash([])
      ctx.fillStyle = color
      for (const p of [s1, s2]) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const drawRect = (p1: Point, p2: Point, color: string, dashed = false) => {
      const s1 = { x: p1.x * view.scale + view.offsetX, y: p1.y * view.scale + view.offsetY }
      const s2 = { x: p2.x * view.scale + view.offsetX, y: p2.y * view.scale + view.offsetY }
      const x = Math.min(s1.x, s2.x)
      const y = Math.min(s1.y, s2.y)
      const w = Math.abs(s1.x - s2.x)
      const h = Math.abs(s1.y - s2.y)
      ctx.save()
      ctx.strokeStyle = color
      ctx.fillStyle = color + '22'
      ctx.lineWidth = 2
      if (dashed) ctx.setLineDash([6, 4])
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
      ctx.restore()
    }

    const drawLabel = (sx: number, sy: number, text: string, color: string) => {
      ctx.save()
      ctx.font = 'bold 14px ui-sans-serif, system-ui, -apple-system, sans-serif'
      const padding = 4
      const metrics = ctx.measureText(text)
      const tw = metrics.width + padding * 2
      const th = 20
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.fillRect(sx, sy - th, tw, th)
      ctx.strokeRect(sx, sy - th, tw, th)
      ctx.fillStyle = color
      ctx.fillText(text, sx + padding, sy - 6)
      ctx.restore()
    }

    const COLOR_DISTANCE = '#d97706' // amber
    const COLOR_RECT = '#2563eb' // blue
    const COLOR_CALIB = '#dc2626' // red
    const COLOR_SELECTED = '#10b981' // green

    for (const ann of annotations) {
      const color = selectedId === ann.id ? COLOR_SELECTED : ann.type === 'distance' ? COLOR_DISTANCE : COLOR_RECT
      if (ann.type === 'distance') {
        drawLine(ann.p1, ann.p2, color)
        if (pxPerCm) {
          const px = distancePx(ann.p1, ann.p2)
          const cm = px / pxPerCm
          const mid = {
            x: ((ann.p1.x + ann.p2.x) / 2) * view.scale + view.offsetX,
            y: ((ann.p1.y + ann.p2.y) / 2) * view.scale + view.offsetY,
          }
          drawLabel(mid.x, mid.y, formatLength(cm), color)
        }
      } else {
        drawRect(ann.p1, ann.p2, color)
        if (pxPerCm) {
          const wCm = Math.abs(ann.p1.x - ann.p2.x) / pxPerCm
          const hCm = Math.abs(ann.p1.y - ann.p2.y) / pxPerCm
          const areaSqm = (wCm * hCm) / 10000
          const text = `${formatLength(wCm)} × ${formatLength(hCm)} · ${formatArea(areaSqm)}`
          const sx = Math.min(ann.p1.x, ann.p2.x) * view.scale + view.offsetX
          const sy = Math.min(ann.p1.y, ann.p2.y) * view.scale + view.offsetY
          drawLabel(sx, sy, text, color)
        }
      }
    }

    // 正在绘制的预览
    if (drawStart && cursor) {
      if (tool === 'calibrate') drawLine(drawStart, cursor, COLOR_CALIB, true)
      else if (tool === 'distance') drawLine(drawStart, cursor, COLOR_DISTANCE, true)
      else if (tool === 'rectangle') drawRect(drawStart, cursor, COLOR_RECT, true)
    }
  }, [annotations, view, pxPerCm, drawStart, cursor, tool, selectedId])

  useEffect(() => {
    redraw()
  }, [redraw])

  // 容器 resize 重绘
  useEffect(() => {
    const handleResize = () => redraw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [redraw])

  // 清理图片 URL
  useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    }
  }, [])

  // 鼠标事件
  const getImagePoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return screenToImage(e.clientX - rect.left, e.clientY - rect.top)
  }

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasImage) return
    if (tool === 'pan') {
      const rect = canvasRef.current!.getBoundingClientRect()
      panStartRef.current = {
        sx: e.clientX - rect.left,
        sy: e.clientY - rect.top,
        offsetX: view.offsetX,
        offsetY: view.offsetY,
      }
      return
    }
    if (tool === 'rectangle') {
      setDrawStart(getImagePoint(e))
    }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasImage) return
    if (tool === 'pan' && panStartRef.current) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const dx = e.clientX - rect.left - panStartRef.current.sx
      const dy = e.clientY - rect.top - panStartRef.current.sy
      setView((v) => ({ ...v, offsetX: panStartRef.current!.offsetX + dx, offsetY: panStartRef.current!.offsetY + dy }))
      return
    }
    setCursor(getImagePoint(e))
  }

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasImage) return
    if (tool === 'pan') {
      panStartRef.current = null
      return
    }
    if (tool === 'rectangle' && drawStart) {
      const p2 = getImagePoint(e)
      if (distancePx(drawStart, p2) > 4) {
        setAnnotations((anns) => [...anns, { id: uid(), type: 'rectangle', p1: drawStart, p2 }])
      }
      setDrawStart(null)
    }
  }

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasImage) return
    if (tool === 'calibrate' || tool === 'distance') {
      const p = getImagePoint(e)
      if (!drawStart) {
        setDrawStart(p)
      } else {
        if (distancePx(drawStart, p) < 4) return // 误点
        if (tool === 'calibrate') {
          setPendingCalib({ p1: drawStart, p2: p })
        } else {
          setAnnotations((anns) => [...anns, { id: uid(), type: 'distance', p1: drawStart, p2: p }])
        }
        setDrawStart(null)
      }
    }
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!hasImage) return
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const delta = -e.deltaY
    const factor = delta > 0 ? 1.1 : 1 / 1.1
    setView((v) => {
      const newScale = Math.max(0.05, Math.min(20, v.scale * factor))
      // 保持鼠标下的图片点不动
      const ix = (sx - v.offsetX) / v.scale
      const iy = (sy - v.offsetY) / v.scale
      return {
        scale: newScale,
        offsetX: sx - ix * newScale,
        offsetY: sy - iy * newScale,
      }
    })
  }

  // 校准完成
  const applyCalibration = (realCm: number) => {
    if (!pendingCalib) return
    const px = distancePx(pendingCalib.p1, pendingCalib.p2)
    if (realCm <= 0 || px <= 0) {
      message.error('数值无效')
      return
    }
    setPxPerCm(px / realCm)
    setPendingCalib(null)
    setTool('distance') // 校准完自动切到距离工具
    message.success(`校准完成：1 cm ≈ ${(px / realCm).toFixed(2)} px`)
  }

  // 重新校准（清除比例但保留标注）
  const recalibrate = () => {
    setPxPerCm(null)
    setTool('calibrate')
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setAnnotations((anns) => anns.filter((a) => a.id !== selectedId))
    setSelectedId(null)
  }

  const clearAll = () => {
    Modal.confirm({
      title: '清空所有标注？',
      content: '比例会保留，只清除标注。',
      okText: '清空',
      cancelText: '取消',
      onOk: () => {
        setAnnotations([])
        setSelectedId(null)
      },
    })
  }

  const exportPng = () => {
    const img = imageRef.current
    if (!img) return
    const out = document.createElement('canvas')
    out.width = img.width
    out.height = img.height
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const lineW = Math.max(2, Math.round(img.width / 600))
    const fontSize = Math.max(14, Math.round(img.width / 80))
    ctx.lineWidth = lineW
    ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`

    const drawExportLabel = (sx: number, sy: number, text: string, color: string) => {
      const padding = fontSize * 0.3
      const metrics = ctx.measureText(text)
      const tw = metrics.width + padding * 2
      const th = fontSize * 1.4
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.fillRect(sx, sy - th, tw, th)
      ctx.strokeRect(sx, sy - th, tw, th)
      ctx.fillStyle = color
      ctx.fillText(text, sx + padding, sy - padding)
      ctx.lineWidth = lineW
    }

    for (const ann of annotations) {
      const color = ann.type === 'distance' ? '#d97706' : '#2563eb'
      ctx.strokeStyle = color
      ctx.fillStyle = color + '22'
      if (ann.type === 'distance') {
        ctx.beginPath()
        ctx.moveTo(ann.p1.x, ann.p1.y)
        ctx.lineTo(ann.p2.x, ann.p2.y)
        ctx.stroke()
        if (pxPerCm) {
          const cm = distancePx(ann.p1, ann.p2) / pxPerCm
          drawExportLabel((ann.p1.x + ann.p2.x) / 2, (ann.p1.y + ann.p2.y) / 2, formatLength(cm), color)
        }
      } else {
        const x = Math.min(ann.p1.x, ann.p2.x)
        const y = Math.min(ann.p1.y, ann.p2.y)
        const w = Math.abs(ann.p1.x - ann.p2.x)
        const h = Math.abs(ann.p1.y - ann.p2.y)
        ctx.fillRect(x, y, w, h)
        ctx.strokeRect(x, y, w, h)
        if (pxPerCm) {
          const wCm = w / pxPerCm
          const hCm = h / pxPerCm
          const areaSqm = (wCm * hCm) / 10000
          drawExportLabel(x, y, `${formatLength(wCm)} × ${formatLength(hCm)} · ${formatArea(areaSqm)}`, color)
        }
      }
    }
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `floorplan-annotated-${Date.now()}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  // 总面积汇总
  const totalAreaSqm = (() => {
    if (!pxPerCm) return 0
    return annotations
      .filter((a) => a.type === 'rectangle')
      .reduce((sum, a) => {
        const w = Math.abs(a.p1.x - a.p2.x) / pxPerCm
        const h = Math.abs(a.p1.y - a.p2.y) / pxPerCm
        return sum + (w * h) / 10000
      }, 0)
  })()

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col">
      {/* 顶部 */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-stone-500 hover:text-stone-800">← 返回首页</Link>
          <h1 className="text-lg font-semibold">户型图测量工具</h1>
          <span className="text-xs text-stone-400">Adobe 式手动校准 · 新加坡公寓场景</span>
        </div>
        <div className="text-xs text-stone-500">
          {pxPerCm ? <span className="text-emerald-600">✓ 已校准 · 1 cm = {pxPerCm.toFixed(2)} px</span> : <span>未校准</span>}
        </div>
      </header>

      {/* 工具栏 */}
      {hasImage && (
        <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-4 flex-wrap">
          <Segmented
            value={tool}
            onChange={(v) => {
              setTool(v as Tool)
              setDrawStart(null)
            }}
            options={TOOL_OPTIONS.map((o) => ({ label: o.label, value: o.value, disabled: !pxPerCm && o.value !== 'calibrate' && o.value !== 'pan' }))}
          />
          <span className="text-xs text-stone-500">{TOOL_OPTIONS.find((o) => o.value === tool)?.hint}</span>
          <div className="flex-1" />
          <Button size="small" onClick={recalibrate} disabled={!pxPerCm}>重新校准</Button>
          <Button size="small" onClick={clearAll} disabled={annotations.length === 0}>清空标注</Button>
          <Button size="small" type="primary" onClick={exportPng} disabled={annotations.length === 0}>导出 PNG</Button>
          <Upload accept="image/*" beforeUpload={handleUpload} showUploadList={false}>
            <Button size="small">换一张图</Button>
          </Upload>
        </div>
      )}

      {/* 主区域 */}
      <div className="flex-1 flex overflow-hidden">
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-stone-200">
          {!hasImage && (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <Upload.Dragger
                accept="image/*"
                beforeUpload={handleUpload}
                showUploadList={false}
                className="max-w-xl w-full"
              >
                <div className="py-8">
                  <p className="text-4xl">📐</p>
                  <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>
                    点击或拖拽上传户型图
                  </p>
                  <p className="ant-upload-hint" style={{ marginTop: 8 }}>
                    支持 JPG / PNG。上传后用"校准"工具点两下已知长度的线段（门、床、已印尺寸），输入真实长度即可开始测量。
                  </p>
                </div>
              </Upload.Dragger>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="block"
            style={{
              cursor:
                tool === 'pan' ? (panStartRef.current ? 'grabbing' : 'grab') : tool === 'calibrate' || tool === 'distance' ? 'crosshair' : 'crosshair',
              display: hasImage ? 'block' : 'none',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => {
              setCursor(null)
              panStartRef.current = null
            }}
            onClick={onClick}
            onWheel={onWheel}
          />
        </div>

        {/* 右侧栏 */}
        {hasImage && (
          <aside className="w-80 bg-white border-l border-stone-200 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200">
              <div className="text-sm font-semibold mb-1">状态</div>
              <div className="text-xs text-stone-600 space-y-1">
                <div>比例：{pxPerCm ? `1 px = ${(1 / pxPerCm).toFixed(3)} cm` : <span className="text-amber-600">未校准</span>}</div>
                <div>缩放：{(view.scale * 100).toFixed(0)}%</div>
                <div>标注：{annotations.length} 个（矩形 {annotations.filter((a) => a.type === 'rectangle').length}，距离 {annotations.filter((a) => a.type === 'distance').length}）</div>
                {pxPerCm && totalAreaSqm > 0 && <div className="pt-1 text-sm text-emerald-700 font-semibold">矩形总面积：{formatArea(totalAreaSqm)}</div>}
              </div>
            </div>
            <div className="px-5 py-4 flex-1 overflow-y-auto">
              <div className="text-sm font-semibold mb-2">标注列表</div>
              {annotations.length === 0 && <div className="text-xs text-stone-400">还没有标注。选择工具后开始量。</div>}
              <ul className="space-y-1">
                {annotations.map((a, i) => {
                  const isSel = selectedId === a.id
                  let label = ''
                  if (pxPerCm) {
                    if (a.type === 'distance') {
                      label = `距离 ${formatLength(distancePx(a.p1, a.p2) / pxPerCm)}`
                    } else {
                      const w = Math.abs(a.p1.x - a.p2.x) / pxPerCm
                      const h = Math.abs(a.p1.y - a.p2.y) / pxPerCm
                      label = `矩形 ${formatLength(w)}×${formatLength(h)} = ${formatArea((w * h) / 10000)}`
                    }
                  } else {
                    label = a.type === 'distance' ? '距离（未校准）' : '矩形（未校准）'
                  }
                  return (
                    <li
                      key={a.id}
                      onClick={() => setSelectedId(isSel ? null : a.id)}
                      className={`text-xs px-2 py-1.5 rounded cursor-pointer flex items-center gap-2 ${isSel ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-stone-50'}`}
                    >
                      <span className="text-stone-400 w-5">{i + 1}.</span>
                      <span className="flex-1">{label}</span>
                    </li>
                  )
                })}
              </ul>
              {selectedId && (
                <Button size="small" danger onClick={deleteSelected} className="mt-3 w-full">删除选中</Button>
              )}
            </div>
            <div className="px-5 py-3 border-t border-stone-200 text-[11px] text-stone-500 leading-relaxed">
              提示：滚轮缩放，「平移」工具拖动画面。校准越精确（线段越长、点得越准），后续测量越准。
            </div>
          </aside>
        )}
      </div>

      {/* 校准弹框 */}
      <CalibrationModal
        open={!!pendingCalib}
        pxDistance={pendingCalib ? distancePx(pendingCalib.p1, pendingCalib.p2) : 0}
        onCancel={() => setPendingCalib(null)}
        onConfirm={applyCalibration}
      />
    </div>
  )
}

function CalibrationModal({
  open,
  pxDistance,
  onCancel,
  onConfirm,
}: {
  open: boolean
  pxDistance: number
  onCancel: () => void
  onConfirm: (cm: number) => void
}) {
  const [cm, setCm] = useState<number | null>(null)

  useEffect(() => {
    if (open) setCm(null)
  }, [open])

  return (
    <Modal
      open={open}
      title="校准：这条线段的真实长度是多少？"
      onCancel={onCancel}
      onOk={() => cm && onConfirm(cm)}
      okButtonProps={{ disabled: !cm || cm <= 0 }}
      okText="确认"
      cancelText="取消"
      width={520}
    >
      <div className="space-y-4">
        <div className="text-xs text-stone-500">你刚点的线段长度：<b>{pxDistance.toFixed(1)} px</b></div>

        <div>
          <div className="text-xs text-stone-500 mb-1">实际长度（cm）</div>
          <InputNumber
            value={cm}
            onChange={(v) => setCm(v as number | null)}
            min={0.1}
            step={0.5}
            placeholder="输入真实长度"
            className="w-full"
            autoFocus
          />
        </div>

        <div>
          <div className="text-xs text-stone-500 mb-2">快捷：新加坡公寓门宽</div>
          <div className="flex flex-wrap gap-2">
            {DOOR_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setCm(p.cm)}
                className="text-xs px-2.5 py-1 rounded border border-stone-300 hover:bg-stone-50"
              >
                {p.label} · {p.cm} cm
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-stone-500 mb-2">快捷：床</div>
          <div className="flex flex-wrap gap-2">
            {BED_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setCm(p.cm)}
                className="text-xs px-2.5 py-1 rounded border border-stone-300 hover:bg-stone-50"
              >
                {p.label} · {p.cm} cm
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-stone-400 pt-2 border-t border-stone-100">
          公寓门宽个体差异大（范围 838–965mm）。如果图上已经印了尺寸，直接在那条标注线的两端点一下、填入相应数值会最准。
        </div>
      </div>
    </Modal>
  )
}
