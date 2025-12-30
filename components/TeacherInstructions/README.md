# TeacherInstructions Component

## Purpose

The `TeacherInstructions` component is specifically designed to render teacher instructions in the Teacher Portal, addressing three critical issues:

1. **Formatting Preservation**: Rich HTML content created in the Admin portal (bold, italics, lists, headers, etc.) is preserved and rendered correctly
2. **Single Render**: Content is rendered exactly once, preventing duplication issues
3. **Text Wrapping**: Proper overflow and word-breaking ensures long text/URLs don't break the layout

## Usage

```tsx
import TeacherInstructions from '@/components/TeacherInstructions/TeacherInstructions'

<TeacherInstructions
  html={activeContent.teachersInstructions}
  className="max-h-96"
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `html` | `string` | Yes | The HTML string containing teacher instructions from the Admin portal |
| `className` | `string` | No | Optional CSS classes to apply to the container |

## Security

The component uses **DOMPurify** to sanitize all HTML content before rendering, preventing XSS attacks while preserving safe formatting tags like:

- Text formatting: `<strong>`, `<em>`, `<u>`, `<del>`
- Structure: `<p>`, `<br>`, `<h1-h6>`, `<div>`, `<span>`
- Lists: `<ul>`, `<ol>`, `<li>`
- Links: `<a>` (with safe attributes only)
- Code: `<code>`, `<pre>`, `<blockquote>`
- Images: `<img>` (with safe attributes only)

Dangerous elements like `<script>`, event handlers, and data attributes are automatically stripped.

## Styling

The component applies several CSS classes by default:

- `prose`: Applies Tailwind's typography styles
- `max-w-none`: Removes max-width restrictions
- `whitespace-normal`: Ensures proper whitespace handling
- `break-words`: Breaks long words to prevent overflow
- `overflow-auto`: Adds scrollbars if content exceeds container
- `teacher-instructions`: Custom class for additional styling

Inline styles provide defense-in-depth:
- `overflowWrap: 'anywhere'`: Breaks words at any point if needed
- `wordBreak: 'break-word'`: Legacy word-breaking support

## Performance

The component uses `useMemo` to cache the sanitized HTML, ensuring DOMPurify only runs when the `html` prop changes, not on every render.

## Server-Side Rendering

The component uses a maximally defensive SSR strategy:

**Server (SSR):**
- Renders a safe loading placeholder: "Loading instructions..."
- Does NOT render any HTML content server-side
- Prevents any potential SSR vulnerabilities
- Minimal hydration mismatch (brief loading state)

**Client:**
- Fully sanitizes HTML using DOMPurify (primary security layer)
- Replaces loading placeholder with sanitized content
- Comprehensive XSS prevention
- Preserves all safe formatting

**Why This Approach:**
- Ensures 100% of HTML goes through DOMPurify
- No risk of SSR vulnerabilities
- Defense-in-depth: even if validation fails, no unsafe content rendered server-side
- Brief loading state is acceptable tradeoff for maximum security

**Important:** HTML content MUST originate from the Admin portal (trusted source). This component is designed for admin-created content only, not user-submitted HTML.

## Example

In the Teacher Portal curriculum page:

```tsx
<TabsContent value="teachers-instructions">
  <div className="p-4 border rounded-lg">
    {activeContent.teachersInstructions ? (
      <TeacherInstructions
        html={activeContent.teachersInstructions}
        className="max-h-96"
      />
    ) : (
      <p className="text-muted-foreground">
        No teacher instructions provided for this content.
      </p>
    )}
  </div>
</TabsContent>
```

## Related Components

- `HtmlWithLatex`: For rendering HTML with LaTeX math expressions (not used for teacher instructions)
- `SanitizedHtml`: Generic sanitized HTML renderer (teacher-specific component is preferred for teacher instructions)

## Migration Notes

Previous implementation used `HtmlWithLatex` component which:
- May have caused duplication issues
- Included LaTeX parsing (unnecessary for teacher instructions)
- Used different prop structure

The new `TeacherInstructions` component is:
- Purpose-built for teacher instructions
- Simpler and more focused
- Renders content exactly once
- Better text wrapping/overflow handling
