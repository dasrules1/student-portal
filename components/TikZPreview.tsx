"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"

interface TikZPreviewProps {
  tikzCode: string
  className?: string
}

/**
 * Component to preview TikZ diagrams
 * Uses an iframe to render TikZ via an external service
 */
export function TikZPreview({ tikzCode, className = "" }: TikZPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (!tikzCode || !tikzCode.trim()) {
    return (
      <div className={`p-4 border rounded-lg bg-muted ${className}`}>
        <p className="text-sm text-muted-foreground">No TikZ code provided</p>
      </div>
    )
  }

  // Create a complete LaTeX document with TikZ
  const latexDocument = `\\documentclass[border=10pt]{standalone}
\\usepackage{tikz}
\\usetikzlibrary{shapes,arrows,positioning}
\\begin{document}
${tikzCode}
\\end{document}`

  // Use QuickLaTeX or similar service
  // For now, we'll show the code and use an iframe approach
  const encodedLatex = encodeURIComponent(latexDocument)
  const quickLatexUrl = `https://quicklatex.com/latex3.f?formula=${encodedLatex}&fsize=17px&fcolor=000000&mode=0&out=1`

  return (
    <div className={`p-4 border rounded-lg bg-white ${className}`}>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Preview (rendered via QuickLaTeX):
        </p>
        <div className="border rounded p-2 bg-gray-50 min-h-[200px] flex items-center justify-center relative">
          {isLoading && (
            <div className="absolute flex items-center">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Rendering...</span>
            </div>
          )}
          <img 
            src={quickLatexUrl}
            alt="TikZ Diagram Preview"
            className="max-w-full h-auto"
            onError={() => {
              setIsLoading(false)
              setError("Failed to load preview. The TikZ code may contain errors.")
            }}
            onLoad={() => setIsLoading(false)}
          />
        </div>
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer">View TikZ Code</summary>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 mt-2">
            {tikzCode}
          </pre>
        </details>
      </div>
    </div>
  )
}

