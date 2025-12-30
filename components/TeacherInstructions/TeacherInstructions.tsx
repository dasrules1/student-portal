"use client"

import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'
import { SANITIZE_CONFIG } from '@/lib/sanitize-config'

// Inline styles for defense-in-depth text wrapping
const WRAP_STYLES = {
  overflowWrap: 'anywhere',
  wordBreak: 'break-word'
} as const

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
 * SECURITY NOTE: HTML must come from trusted sources (Admin portal).
 * The component sanitizes on client-side and uses safe loading state on server-side.
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
    // SSR context: Show safe loading state
    // Full sanitization happens on client-side with DOMPurify
    if (typeof window === 'undefined') {
      // SECURITY: During SSR, we don't render HTML content to avoid potential vulnerabilities
      // Instead, we show a safe loading state that will be hydrated client-side
      // This ensures all HTML goes through DOMPurify sanitization
      // Note: Using 'class' not 'className' since this is HTML string, not JSX
      return '<div class="text-muted-foreground">Loading instructions...</div>'
    }

    // Client-side: Full DOMPurify sanitization
    // This is the primary security layer that comprehensively prevents XSS
    return DOMPurify.sanitize(html, SANITIZE_CONFIG)
  }, [html])

  // Render sanitized HTML once with proper wrapping and overflow handling
  return (
    <div
      className={cn(
        'prose max-w-none whitespace-normal break-words overflow-auto',
        'teacher-instructions',
        className
      )}
      style={WRAP_STYLES}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
