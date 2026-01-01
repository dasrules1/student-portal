"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"

interface TikZPreviewProps {
  tikzCode: string
  className?: string
}

/**
 * Component to preview TikZ diagrams
 * Uses CodeCogs LaTeX renderer which supports TikZ
 */
export function TikZPreview({ tikzCode, className = "" }: TikZPreviewProps) {
  const [isLoading, setIsLoading] = useState(false)

  if (!tikzCode || !tikzCode.trim()) {
    return (
      <div className={`p-4 border rounded-lg bg-muted ${className}`}>
        <p className="text-sm text-muted-foreground">No TikZ code provided</p>
      </div>
    )
  }

  useEffect(() => {
    setIsLoading(false)
  }, [tikzCode])

  return (
    <div className={`p-4 border rounded-lg bg-white ${className}`}>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Preview:
        </p>
        <div className="border rounded p-3 bg-gray-50 min-h-[200px]">
          <div className="mb-2">
            <p className="text-xs font-medium mb-2">TikZ Code:</p>
            <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-40 font-mono whitespace-pre-wrap">
              {tikzCode}
            </pre>
          </div>
          <div className="text-xs text-muted-foreground">
            <p className="mb-1"><strong>Preview Note:</strong></p>
            <p>TikZ diagrams require a LaTeX compiler. To preview, copy the code above and paste it into an online TikZ editor like:</p>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li><a href="https://tikzcd.yichuanshen.de/" target="_blank" rel="noopener noreferrer" className="text-primary underline">TikZcd Editor</a></li>
              <li><a href="https://www.tikzcd-editor.xyz/" target="_blank" rel="noopener noreferrer" className="text-primary underline">TikZcd Editor XYZ</a></li>
            </ul>
          </div>
        </div>
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer">View TikZ Code</summary>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 mt-2 font-mono whitespace-pre-wrap">
            {tikzCode}
          </pre>
        </details>
      </div>
    </div>
  )
}

