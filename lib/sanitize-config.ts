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
   * 
   * Note: 'style' attribute is allowed but will be sanitized by DOMPurify
   * to prevent CSS injection attacks while preserving formatting from rich text editors
   */
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'src', 'alt', 'title', 'style'
  ],
  
  /**
   * Data attributes are not allowed for security
   */
  ALLOW_DATA_ATTR: false,
} as const

/**
 * Helper to ensure HTML is from a trusted source
 * Use this to validate HTML before rendering in SSR context
 * 
 * IMPORTANT: This is a basic check, not comprehensive sanitization.
 * It only catches obvious attack patterns. Full sanitization happens client-side with DOMPurify.
 * 
 * NOTE: This function is provided for optional use cases where you want to validate
 * HTML before rendering. The TeacherInstructions component uses a different approach
 * (safe loading state during SSR) but this function is available for other use cases.
 */
export function isTrustedHtmlSource(html: string): boolean {
  // Check for dangerous patterns that indicate potential XSS
  // More comprehensive than basic checks, but still not a replacement for DOMPurify
  const dangerousPatterns = [
    /<script[\s>]/i,                    // Script tags (with space or >)
    /<script\s+/i,                      // Script tags with attributes
    /javascript\s*:/i,                  // javascript: protocol
    /on\w+\s*=/i,                       // Event handlers (onclick=, onload=, etc.)
    /data:text\/html/i,                 // Data URIs with HTML
    /<iframe[\s>]/i,                    // Iframe tags
    /<object[\s>]/i,                    // Object tags
    /<embed[\s>]/i,                     // Embed tags
    /<frame[\s>]/i,                     // Frame tags
    /<base[\s>]/i,                      // Base tags (can be used for attacks)
    /<link[\s>]/i,                      // Link tags (can load external resources)
    /<meta[\s>]/i,                      // Meta tags (can refresh/redirect)
    /vbscript\s*:/i,                    // VBScript protocol
    /<form[\s>]/i,                      // Form tags (phishing risk)
    /expression\s*\(/i,                 // CSS expression() (IE)
    /import\s+['"].*['"]/i,             // ES6 imports
    /eval\s*\(/i,                       // eval() calls
    /Function\s*\(/i,                   // Function constructor
  ]
  
  return !dangerousPatterns.some(pattern => pattern.test(html))
}
