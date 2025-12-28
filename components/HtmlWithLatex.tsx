"use client"

import { InlineMath, BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'

interface HtmlWithLatexProps {
  html?: string | null
  className?: string
}

/**
 * Client component that renders HTML content with LaTeX math expressions.
 * 
 * - Parses inline LaTeX: $...$
 * - Parses block LaTeX: $$...$$
 * - Renders HTML using dangerouslySetInnerHTML for formatted content
 * - Provides SSR fallback for server-side rendering
 * 
 * @param html - The HTML string to render (can contain LaTeX)
 * @param className - Optional CSS class name for styling
 */
export function HtmlWithLatex({ html, className = '' }: HtmlWithLatexProps) {
  // Handle empty/null content
  if (!html) {
    return (
      <div className={`text-muted-foreground ${className}`}>
        No instructions provided.
      </div>
    )
  }

  // SSR fallback - render plain HTML without LaTeX processing on server
  if (typeof window === 'undefined') {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  // Client-side: Parse and render HTML with LaTeX
  try {
    // Split content by block LaTeX ($$...$$) first, then inline LaTeX ($...$)
    const parts: Array<{ type: 'text' | 'inline-latex' | 'block-latex'; content: string }> = []
    
    // Regex patterns
    const blockLatexPattern = /\$\$([\s\S]*?)\$\$/g
    const inlineLatexPattern = /\$([^$\n]+?)\$/g
    
    let lastIndex = 0
    let match: RegExpExecArray | null
    
    // First pass: Find all block LaTeX
    const blockMatches: Array<{ start: number; end: number; content: string }> = []
    while ((match = blockLatexPattern.exec(html)) !== null) {
      blockMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      })
    }
    
    // Second pass: Process text and find inline LaTeX
    for (let i = 0; i < blockMatches.length; i++) {
      const blockMatch = blockMatches[i]
      
      // Process text before this block match
      if (blockMatch.start > lastIndex) {
        const textBefore = html.substring(lastIndex, blockMatch.start)
        processInlineLatex(textBefore, parts)
      }
      
      // Add block LaTeX
      parts.push({
        type: 'block-latex',
        content: blockMatch.content,
      })
      
      lastIndex = blockMatch.end
    }
    
    // Process remaining text after last block match
    if (lastIndex < html.length) {
      const remainingText = html.substring(lastIndex)
      processInlineLatex(remainingText, parts)
    }
    
    // If no block matches, process entire string for inline LaTeX
    if (blockMatches.length === 0) {
      processInlineLatex(html, parts)
    }
    
    // Helper function to process inline LaTeX in text segments
    function processInlineLatex(
      text: string,
      parts: Array<{ type: 'text' | 'inline-latex' | 'block-latex'; content: string }>
    ) {
      let lastIdx = 0
      const inlinePattern = /\$([^$\n]+?)\$/g
      let inlineMatch: RegExpExecArray | null
      
      while ((inlineMatch = inlinePattern.exec(text)) !== null) {
        // Add text before inline match
        if (inlineMatch.index > lastIdx) {
          parts.push({
            type: 'text',
            content: text.substring(lastIdx, inlineMatch.index),
          })
        }
        
        // Add inline LaTeX
        parts.push({
          type: 'inline-latex',
          content: inlineMatch[1],
        })
        
        lastIdx = inlineMatch.index + inlineMatch[0].length
      }
      
      // Add remaining text
      if (lastIdx < text.length) {
        parts.push({
          type: 'text',
          content: text.substring(lastIdx),
        })
      }
    }
    
    // Render the parts
    return (
      <div className={className}>
        {parts.map((part, index) => {
          if (part.type === 'block-latex') {
            try {
              return (
                <div key={index} className="my-4">
                  <BlockMath math={part.content} />
                </div>
              )
            } catch (error) {
              console.error('Error rendering block LaTeX:', error)
              return (
                <div key={index} className="text-red-500 my-2">
                  LaTeX Error: {part.content}
                </div>
              )
            }
          } else if (part.type === 'inline-latex') {
            try {
              return <InlineMath key={index} math={part.content} />
            } catch (error) {
              console.error('Error rendering inline LaTeX:', error)
              return (
                <span key={index} className="text-red-500">
                  LaTeX Error: {part.content}
                </span>
              )
            }
          } else {
            // Render HTML text
            return (
              <span
                key={index}
                dangerouslySetInnerHTML={{ __html: part.content }}
              />
            )
          }
        })}
      </div>
    )
  } catch (error) {
    console.error('Error parsing HTML with LaTeX:', error)
    // Fallback: render as plain HTML
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
}
