"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

interface Point {
  x: number
  y: number
}

interface Line {
  start: Point
  end: Point
}

interface GraphData {
  points: Point[]
  lines: Line[]
}

interface GraphEditorProps {
  value?: GraphData
  onChange?: (data: GraphData) => void
  readonly?: boolean
}

export function GraphEditor({ value, onChange, readonly = false }: GraphEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [points, setPoints] = useState<Point[]>(value?.points || [])
  const [lines, setLines] = useState<Line[]>(value?.lines || [])
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [mode, setMode] = useState<"point" | "line">("point")
  // Track if we've initialized from external value to prevent loops
  const initializedRef = useRef(false)
  // Track if changes are from internal user interactions
  const isInternalChangeRef = useRef(false)

  const CANVAS_SIZE = 400
  const GRID_SIZE = 20
  const ORIGIN_X = CANVAS_SIZE / 2
  const ORIGIN_Y = CANVAS_SIZE / 2

  // Memoize a stable reference for comparing arrays
  const valuePointsStr = useMemo(() => JSON.stringify(value?.points || []), [value?.points])
  const valueLinesStr = useMemo(() => JSON.stringify(value?.lines || []), [value?.lines])

  // Only sync from external value on mount or when external value genuinely changes
  useEffect(() => {
    // Skip if this was triggered by our own onChange callback
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false
      return
    }
    
    const newPoints = value?.points || []
    const newLines = value?.lines || []
    
    // Only update if the external value is different from current internal state
    const currentPointsStr = JSON.stringify(points)
    const currentLinesStr = JSON.stringify(lines)
    
    if (valuePointsStr !== currentPointsStr || valueLinesStr !== currentLinesStr) {
      setPoints(newPoints)
      setLines(newLines)
    }
    
    initializedRef.current = true
  }, [valuePointsStr, valueLinesStr])

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw grid
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    for (let i = 0; i <= CANVAS_SIZE; i += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, CANVAS_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(CANVAS_SIZE, i)
      ctx.stroke()
    }

    // Draw axes
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, ORIGIN_Y)
    ctx.lineTo(CANVAS_SIZE, ORIGIN_Y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ORIGIN_X, 0)
    ctx.lineTo(ORIGIN_X, CANVAS_SIZE)
    ctx.stroke()

    // Draw axis labels
    ctx.fillStyle = "#000"
    ctx.font = "12px Arial"
    ctx.fillText("0", ORIGIN_X + 5, ORIGIN_Y + 15)
    for (let i = -10; i <= 10; i++) {
      if (i === 0) continue
      const x = ORIGIN_X + i * GRID_SIZE
      const y = ORIGIN_Y - i * GRID_SIZE
      if (x >= 0 && x <= CANVAS_SIZE) {
        ctx.fillText(i.toString(), x - 5, ORIGIN_Y + 15)
      }
      if (y >= 0 && y <= CANVAS_SIZE) {
        ctx.fillText(i.toString(), ORIGIN_X + 5, y + 5)
      }
    }

    // Draw lines
    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 2
    lines.forEach((line) => {
      const startX = ORIGIN_X + line.start.x * GRID_SIZE
      const startY = ORIGIN_Y - line.start.y * GRID_SIZE
      const endX = ORIGIN_X + line.end.x * GRID_SIZE
      const endY = ORIGIN_Y - line.end.y * GRID_SIZE
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
    })

    // Draw points
    points.forEach((point) => {
      const x = ORIGIN_X + point.x * GRID_SIZE
      const y = ORIGIN_Y - point.y * GRID_SIZE
      ctx.fillStyle = "#ef4444"
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, 2 * Math.PI)
      ctx.fill()
    })
  }

  useEffect(() => {
    draw()
  }, [points, lines, mode, isDrawing, startPoint])

  const canvasToGraph = (canvasX: number, canvasY: number): Point => {
    const x = (canvasX - ORIGIN_X) / GRID_SIZE
    const y = (ORIGIN_Y - canvasY) / GRID_SIZE
    return { x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 } // Round to nearest 0.5
  }

  // Notify parent of changes - only for user-initiated changes
  const notifyChange = useCallback((newPoints: Point[], newLines: Line[]) => {
    if (onChange) {
      isInternalChangeRef.current = true
      onChange({ points: newPoints, lines: newLines })
    }
  }, [onChange])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readonly) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const graphPoint = canvasToGraph(x, y)

    if (mode === "point") {
      const newPoints = [...points, graphPoint]
      setPoints(newPoints)
      notifyChange(newPoints, lines)
    } else if (mode === "line") {
      if (!isDrawing) {
        setStartPoint(graphPoint)
        setIsDrawing(true)
      } else {
        if (startPoint) {
          const newLines = [...lines, { start: startPoint, end: graphPoint }]
          setLines(newLines)
          setIsDrawing(false)
          setStartPoint(null)
          notifyChange(points, newLines)
        }
      }
    }
  }

  const clearAll = () => {
    setPoints([])
    setLines([])
    setIsDrawing(false)
    setStartPoint(null)
    notifyChange([], [])
  }

  // Handle button clicks with better responsiveness
  const handleModeChange = useCallback((newMode: "point" | "line") => {
    setMode(newMode)
    setIsDrawing(false)
    setStartPoint(null)
  }, [])

  return (
    <div className="space-y-4">
      {!readonly && (
        <div className="flex space-x-2">
          <Button
            type="button"
            variant={mode === "point" ? "default" : "outline"}
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleModeChange("point")
            }}
          >
            Add Point
          </Button>
          <Button
            type="button"
            variant={mode === "line" ? "default" : "outline"}
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleModeChange("line")
            }}
          >
            Draw Line
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              clearAll()
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>
      )}
      <div className="border rounded-lg overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onClick={handleCanvasClick}
          className="cursor-crosshair bg-white"
          style={{ display: "block", touchAction: 'none' }}
        />
      </div>
      {!readonly && (
        <div className="text-sm text-muted-foreground">
          {mode === "point" 
            ? "Click on the graph to add points" 
            : isDrawing 
            ? "Click to set the end point of the line" 
            : "Click to set the start point of the line"}
        </div>
      )}
    </div>
  )
}

