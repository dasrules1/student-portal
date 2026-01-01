"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

interface TikZRendererProps {
  tikzCode: string
  className?: string
}

/**
 * Component to render TikZ diagrams for display in questions
 * Uses QuickLaTeX API to render TikZ code to an image
 */
export function TikZRenderer({ tikzCode, className = "" }: TikZRendererProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (!tikzCode || !tikzCode.trim()) {
    return null
  }

  // Create a complete LaTeX document with TikZ
  const latexDocument = `\\documentclass[border=10pt]{standalone}
\\usepackage{tikz}
\\usetikzlibrary{shapes,arrows,positioning}
\\begin{document}
${tikzCode}
\\end{document}`

  // Use QuickLaTeX API
  const encodedLatex = encodeURIComponent(latexDocument)
  const imageUrl = `https://quicklatex.com/latex3.f?formula=${encodedLatex}&fsize=17px&fcolor=000000&mode=0&out=1`

  return (
    <div className={`my-4 ${className}`}>
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading diagram...</span>
        </div>
      )}
      <img 
        src={imageUrl}
        alt="Diagram"
        className="max-w-full h-auto mx-auto"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setError("Failed to load diagram")
        }}
        style={{ display: isLoading ? 'none' : 'block' }}
      />
      {error && (
        <div className="p-4 border rounded-lg bg-muted">
          <p className="text-sm text-red-500 mb-2">{error}</p>
          <p className="text-xs text-muted-foreground">TikZ code could not be rendered</p>
        </div>
      )}
    </div>
  )
}

