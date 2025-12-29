"use client"

import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'

interface TeacherInstructionsProps {
  html: string
  className?: string
}

/**
 * Component for rendering teacher instructions with sanitized HTML.
 * 
 * This component addresses three key issues:
 * 1. Preserves rich HTML formatting from Admin portal (using DOMPurify for safe rendering)
 * 2. Renders content only once (prevents duplication)
 * 3. Handles text wrapping/overflow properly with CSS
 * 
 * @param html - The HTML string containing teacher instructions from Admin
 * @param className - Optional CSS classes to apply to the container
 */
export default function TeacherInstructions({ 
  html, 
  className = '' 
}: TeacherInstructionsProps) {
  // Memoize sanitized HTML to avoid re-sanitizing on every render
  const sanitizedHtml = useMemo(() => {
    // SSR fallback - skip sanitization on server
    if (typeof window === 'undefined') {
      return html
    }

    // Sanitize HTML content to prevent XSS attacks while preserving formatting
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

  // Render sanitized HTML once with proper wrapping and overflow handling
  return (
    <div
      className={cn(
        'prose max-w-none whitespace-normal break-words overflow-auto',
        'teacher-instructions',
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
