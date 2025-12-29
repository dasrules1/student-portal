"use client"

import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'

interface SanitizedHtmlProps {
  html?: string | null
  className?: string
  maxHeight?: string
}

/**
 * Client component that safely renders sanitized HTML content with overflow control.
 * 
 * Uses DOMPurify to sanitize HTML and prevent XSS attacks by stripping dangerous
 * tags, scripts, and event handlers while preserving safe formatting.
 * 
 * This component includes built-in overflow handling, word wrapping, and scrolling
 * to prevent content from breaking container layouts.
 * 
 * @param html - The HTML string to sanitize and render
 * @param className - Optional additional CSS classes for styling
 * @param maxHeight - Tailwind max-height utility class (default: "max-h-72")
 */
export default function SanitizedHtml({ 
  html, 
  className = '', 
  maxHeight = 'max-h-72' 
}: SanitizedHtmlProps) {
  // Handle empty/null content
  if (!html) {
    return (
      <div className={`text-muted-foreground ${className}`}>
        No content provided.
      </div>
    )
  }

  // Memoize sanitized HTML to avoid re-sanitizing on every render
  const sanitizedHtml = useMemo(() => {
    // SSR fallback - skip sanitization on server
    if (typeof window === 'undefined') {
      return html
    }

    // Sanitize HTML content to prevent XSS attacks
    // Allow safe tags and attributes while preserving formatting
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'strike', 'del',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'a', 'blockquote', 'code', 'pre',
        'span', 'div', 'img'
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'src', 'alt', 'title'],
      ALLOW_DATA_ATTR: false,
    })
  }, [html])

  return (
    <div
      className={cn(
        'prose max-w-none whitespace-normal break-words overflow-auto sanitized-html',
        maxHeight,
        className
      )}
      style={{
        overflowWrap: 'anywhere',
        wordBreak: 'break-word'
      }}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
