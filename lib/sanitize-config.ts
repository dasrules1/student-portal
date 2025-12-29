/**
 * Shared DOMPurify configuration for sanitizing HTML content
 * Used across multiple components to ensure consistent security policy
 */

export const SANITIZE_CONFIG = {
  /**
   * HTML tags that are allowed in sanitized content
   * These tags are considered safe and won't be stripped by DOMPurify
   */
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'strike', 'del',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'blockquote', 'code', 'pre',
    'span', 'div', 'img'
  ],
  
  /**
   * HTML attributes that are allowed on elements
   * Only safe attributes that don't allow script execution
   */
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'style', 'src', 'alt', 'title'
  ],
  
  /**
   * Data attributes are not allowed for security
   */
  ALLOW_DATA_ATTR: false,
} as const

/**
 * Helper to ensure HTML is from a trusted source
 * Use this to validate HTML before rendering in SSR context
 */
export function isTrustedHtmlSource(html: string): boolean {
  // Basic check - you may want to add more validation
  // This is a simple example that checks for obvious script tags
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i, // Event handlers like onclick=
    /data:text\/html/i,
  ]
  
  return !dangerousPatterns.some(pattern => pattern.test(html))
}
