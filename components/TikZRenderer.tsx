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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

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

    // Try CodeCogs first (supports TikZ better)
    const encodedLatex = encodeURIComponent(latexDocument)
    const codeCogsUrl = `https://latex.codecogs.com/svg.latex?${encodedLatex}`

    // Test if the image loads
    const img = new Image()
    img.onload = () => {
      setImageUrl(codeCogsUrl)
      setIsLoading(false)
      setError(null)
    }
    img.onerror = () => {
      // Fallback: Try QuickLaTeX
      const quickLatexUrl = `https://quicklatex.com/latex3.f?formula=${encodedLatex}&fsize=17px&fcolor=000000&mode=0&out=1`
      const fallbackImg = new Image()
      fallbackImg.onload = () => {
        setImageUrl(quickLatexUrl)
        setIsLoading(false)
        setError(null)
      }
      fallbackImg.onerror = () => {
        setIsLoading(false)
        setError("Unable to render TikZ diagram. The code may contain errors or use unsupported features.")
      }
      fallbackImg.src = quickLatexUrl
    }
    img.src = codeCogsUrl

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false)
        setError("Rendering timeout. The diagram may be too complex.")
      }
    }, 10000)

    return () => clearTimeout(timeout)
  }, [tikzCode, isLoading])

  if (!tikzCode || !tikzCode.trim()) {
    return null
  }

  if (error) {
    return (
      <div className={`my-4 ${className}`}>
        <div className="p-4 border rounded-lg bg-muted">
          <p className="text-sm text-red-500 mb-2">{error}</p>
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer">View TikZ Code</summary>
            <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-40 mt-2 font-mono whitespace-pre-wrap">
              {tikzCode}
            </pre>
          </details>
          <p className="text-xs text-muted-foreground mt-2">
            Tip: Ensure your TikZ code is valid. Example: <code className="bg-background px-1 rounded">\begin{tikzpicture}\draw (0,0) -- (1,1);\end{tikzpicture}</code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`my-4 ${className}`}>
      {isLoading && (
        <div className="flex items-center justify-center py-8 border rounded-lg bg-muted">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading diagram...</span>
        </div>
      )}
      {imageUrl && (
        <div className="border rounded-lg p-4 bg-white flex items-center justify-center">
          <img 
            src={imageUrl}
            alt="TikZ Diagram"
            className="max-w-full h-auto"
            onError={() => {
              setIsLoading(false)
              setError("Failed to load diagram image")
            }}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </div>
      )}
    </div>
  )
}

