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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  if (!tikzCode || !tikzCode.trim()) {
    return (
      <div className={`p-4 border rounded-lg bg-muted ${className}`}>
        <p className="text-sm text-muted-foreground">No TikZ code provided</p>
      </div>
    )
  }

  useEffect(() => {
    if (!tikzCode || !tikzCode.trim()) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    setImageUrl(null)

    // Create a complete LaTeX document with TikZ
    const latexDocument = `\\documentclass[border=10pt]{standalone}
\\usepackage{tikz}
\\usetikzlibrary{shapes,arrows,positioning,calc}
\\begin{document}
${tikzCode}
\\end{document}`

    const encodedLatex = encodeURIComponent(latexDocument)
    const codeCogsUrl = `https://latex.codecogs.com/svg.latex?${encodedLatex}`

    // Test if image loads
    const img = new Image()
    img.onload = () => {
      setImageUrl(codeCogsUrl)
      setIsLoading(false)
      setError(null)
    }
    img.onerror = () => {
      // Fallback to QuickLaTeX
      const quickLatexUrl = `https://quicklatex.com/latex3.f?formula=${encodedLatex}&fsize=17px&fcolor=000000&mode=0&out=1`
      const fallbackImg = new Image()
      fallbackImg.onload = () => {
        setImageUrl(quickLatexUrl)
        setIsLoading(false)
        setError(null)
      }
      fallbackImg.onerror = () => {
        setIsLoading(false)
        setError("Failed to load preview. The TikZ code may contain errors.")
      }
      fallbackImg.src = quickLatexUrl
    }
    img.src = codeCogsUrl

    const timeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false)
        setError("Preview timeout. Please check your TikZ code.")
      }
    }, 10000)

    return () => clearTimeout(timeout)
  }, [tikzCode, isLoading])

  return (
    <div className={`p-4 border rounded-lg bg-white ${className}`}>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Preview:
        </p>
        <div className="border rounded p-2 bg-gray-50 min-h-[200px] flex items-center justify-center relative">
          {isLoading && (
            <div className="absolute flex items-center z-10">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Rendering...</span>
            </div>
          )}
          {imageUrl && (
            <img 
              src={imageUrl}
              alt="TikZ Diagram Preview"
              className="max-w-full h-auto"
              style={{ display: isLoading ? 'none' : 'block' }}
            />
          )}
        </div>
        {error && (
          <div className="mt-2">
            <p className="text-xs text-red-500 mb-2">{error}</p>
            <p className="text-xs text-muted-foreground">
              Tip: Make sure your TikZ code is valid and doesn't use unsupported libraries.
            </p>
          </div>
        )}
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

