"use client"

import DOMPurify from 'dompurify'

interface SanitizedHtmlProps {
  html?: string | null
  className?: string
}

/**
 * Client component that safely renders sanitized HTML content.
 * 
 * Uses DOMPurify to sanitize HTML and prevent XSS attacks.
 * This component is ideal for rendering user-generated or stored HTML
 * without LaTeX processing.
 * 
 * @param html - The HTML string to sanitize and render
 * @param className - Optional CSS class name for styling
 */
export function SanitizedHtml({ html, className = '' }: SanitizedHtmlProps) {
  // Handle empty/null content
  if (!html) {
    return (
      <div className={`text-muted-foreground ${className}`}>
        No content provided.
      </div>
    )
  }

  // SSR fallback - render plain HTML on server
  if (typeof window === 'undefined') {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  // Sanitize HTML content to prevent XSS attacks
  // Allow safe tags and attributes while preserving formatting
  const sanitizedHtml = DOMPurify.sanitize(html, {
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

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
