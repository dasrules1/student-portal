"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"

interface TikZRendererProps {
  tikzCode: string
  className?: string
}

/**
 * Component to render TikZ diagrams for display in questions
 * Uses CodeCogs LaTeX renderer with fallback to code display
 */
export function TikZRenderer({ tikzCode, className = "" }: TikZRendererProps) {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!tikzCode || !tikzCode.trim()) {
      setIsLoading(false)
      return
    }
    setIsLoading(false)
  }, [tikzCode])

  if (!tikzCode || !tikzCode.trim()) {
    return null
  }

  // Display TikZ code with instructions
  return (
    <div className={`my-4 ${className}`}>
      <div className="p-4 border rounded-lg bg-white">
        <div className="mb-3">
          <p className="text-sm font-medium mb-2">TikZ Diagram Code:</p>
          <div className="bg-muted p-3 rounded border">
            <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-60">
              {tikzCode}
            </pre>
          </div>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Note:</p>
          <p>TikZ diagrams require a LaTeX compiler to render. To preview this diagram:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Copy the code above</li>
            <li>Visit an online TikZ editor like <a href="https://tikzcd.yichuanshen.de/" target="_blank" rel="noopener noreferrer" className="text-primary underline">TikZcd Editor</a> or <a href="https://www.tikzcd-editor.xyz/" target="_blank" rel="noopener noreferrer" className="text-primary underline">TikZcd Editor XYZ</a></li>
            <li>Paste the code to see the rendered diagram</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

