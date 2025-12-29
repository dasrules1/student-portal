# Rich Text Editor for Admin Instructions

This document describes the rich text editor feature for teacher instructions in the student portal.

## Overview

Admins can now use a WYSIWYG (What You See Is What You Get) rich text editor to create formatted teacher instructions. These instructions are stored as HTML in Firestore and rendered safely in the teacher portal using DOMPurify for sanitization.

## Features

### Admin Interface
- **Rich Text Editor**: Powered by react-quill with the following toolbar options:
  - Headers (H1, H2, H3)
  - Text formatting (bold, italic, underline, strikethrough)
  - Lists (ordered and unordered)
  - Blockquotes
  - Code blocks
  - Links
  - Clean formatting button

### Teacher Interface
- **Sanitized HTML Rendering**: HTML content is sanitized using DOMPurify before display
- **LaTeX Support**: The HtmlWithLatex component supports LaTeX math expressions within HTML
- **Fallback Support**: If `teachersInstructions` field is missing, graceful fallback is provided

## Security

All HTML content is sanitized using DOMPurify with strict settings:
- Only safe HTML tags are allowed (p, strong, em, headers, lists, links, etc.)
- Script tags, event handlers, and potentially dangerous attributes are stripped
- Sanitization happens on both admin save and teacher render for defense-in-depth

## Components

### RichTextEditor (Admin)
Location: `/components/admin/rich-text-editor.tsx`

```tsx
import RichTextEditor from '@/components/admin/rich-text-editor'

<RichTextEditor
  value={instructions}
  onChange={setInstructions}
  placeholder="Enter teacher instructions..."
  className="my-4"
/>
```

### SanitizedHtml (Teacher)
Location: `/components/teacher/sanitized-html.tsx`

```tsx
import { SanitizedHtml } from '@/components/teacher/sanitized-html'

<SanitizedHtml
  html={instructions}
  className="prose max-w-none"
/>
```

### HtmlWithLatex (Enhanced)
Location: `/components/HtmlWithLatex.tsx`

Now includes DOMPurify sanitization and supports both HTML and LaTeX:

```tsx
import { HtmlWithLatex } from '@/components/HtmlWithLatex'

<HtmlWithLatex
  html={instructionsWithLatex}
  className="prose max-w-none"
/>
```

## Data Structure

### Firestore Field
Teacher instructions are stored in the `teachersInstructions` field as HTML:

```javascript
{
  id: "content_123",
  title: "Algebra Practice",
  type: "homework",
  teachersInstructions: "<p>This homework focuses on <strong>linear equations</strong>.</p><ul><li>Review concepts from class</li><li>Complete all problems</li></ul>",
  problems: [...]
}
```

## Migration

### Running the Migration Script

A migration script is provided to convert any existing plaintext instructions to HTML format.

**Dry Run (Preview Only):**
```bash
node scripts/migrate-instructions.js --dry-run
```

**Apply Changes:**
```bash
node scripts/migrate-instructions.js
```

### Prerequisites
1. Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to your Firebase service account key:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
   ```

2. Or place `service-account-key.json` in the project root

### What the Migration Does
1. Reads all curriculum documents from the `curricula` collection
2. Finds content items with `teachersInstructions` field
3. Checks if content is already HTML (skips if it is)
4. Converts plaintext to HTML:
   - Double newlines → `<p>` tags (paragraphs)
   - Single newlines → `<br>` tags (line breaks)
5. Updates Firestore with converted HTML (unless --dry-run)

### Migration Output Example
```
🚀 Starting teacher instructions migration...
Mode: 🔍 DRY RUN (no changes will be made)

📊 Found 3 curriculum document(s)

📚 Processing curriculum: algebra-101
   📝 Found teachersInstructions in Lesson "Introduction", Content "Practice Problems"
      ✏️  Converting plaintext (145 chars) to HTML
      Original: Review the examples from class.
Focus on problems 1-10...
      Converted: <p>Review the examples from class.</p>
<p>Focus on problems 1-10...</p>
   🔍 [DRY RUN] Would update 1 content item(s)

============================================================
📈 Migration Summary
============================================================
Total curricula processed: 3
Total content items that would be updated: 2

💡 Run without --dry-run flag to apply changes
```

## Installation

The required dependencies are already installed:

```bash
npm install dompurify @types/dompurify --legacy-peer-deps
```

Dependencies:
- `dompurify`: ^3.2.2 - HTML sanitization library
- `@types/dompurify`: TypeScript type definitions
- `react-quill`: ^2.0.0 - WYSIWYG editor (already installed)

## Usage in Code

### Admin: Creating/Editing Instructions

The admin curriculum editor (`/app/admin/curriculum/[classId]/page.tsx`) already uses the rich text editor for the `teachersInstructions` field. No changes needed for existing implementation.

### Teacher: Viewing Instructions

The teacher curriculum page (`/app/teacher/curriculum/[classId]/page.tsx`) already uses `HtmlWithLatex` component to render instructions with sanitization.

## Testing

### Manual Testing Steps

1. **As Admin:**
   - Navigate to `/admin/curriculum/[classId]`
   - Add or edit a lesson content item
   - Use the rich text editor to format teacher instructions
   - Include bold, italics, lists, and headings
   - Save the curriculum

2. **As Teacher:**
   - Navigate to `/teacher/curriculum/[classId]`
   - Select the lesson and content
   - Click "Teacher's Instructions" tab
   - Verify instructions render correctly with formatting
   - Check that no scripts or unsafe HTML are rendered

3. **Security Testing:**
   - Try adding `<script>alert('xss')</script>` in the editor
   - Save and view as teacher
   - Verify script is stripped and doesn't execute

### Automated Testing

No automated tests are included as the repository doesn't have an existing test infrastructure.

## Best Practices

1. **Always use the rich text editor** in admin interfaces rather than textarea
2. **Always render with HtmlWithLatex or SanitizedHtml** components for safe display
3. **Don't use dangerouslySetInnerHTML directly** - use the provided components
4. **Run migration script** before deploying to production to convert existing data
5. **Back up Firestore** before running migration in production

## Troubleshooting

### Editor Not Loading
- Check browser console for errors
- Ensure react-quill is installed: `npm list react-quill`
- Clear browser cache and reload

### Content Not Rendering
- Verify `teachersInstructions` field exists in Firestore
- Check browser console for sanitization warnings
- Ensure component is used client-side (not in SSR)

### Migration Errors
- Ensure Firebase credentials are properly configured
- Check that `curricula` collection exists in Firestore
- Verify service account has read/write permissions

## Future Enhancements

Potential improvements for future versions:
1. Add image upload support to the rich text editor
2. Support for tables in the editor
3. Version history for instruction edits
4. Admin preview of how instructions will appear to teachers
5. Audit log of who edited instructions and when

## Support

For issues or questions:
1. Check the browser console for errors
2. Review Firestore security rules for permission issues
3. Verify Firebase configuration in `/lib/firebase.ts`
4. Contact the development team for assistance
