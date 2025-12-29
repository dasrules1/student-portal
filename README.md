# Student Portal

A comprehensive student management portal with rich curriculum management features.

## Recent Features

### Rich Text Editor for Teacher Instructions

Admins can now use a WYSIWYG rich text editor to create formatted teacher instructions. These instructions are stored as HTML in Firestore and rendered safely in the teacher portal using DOMPurify for sanitization.

**Key Features:**
- Rich text editing with headers, bold, italic, lists, links, and more
- HTML sanitization using DOMPurify to prevent XSS attacks
- LaTeX math expression support ($...$ and $$...$$)
- Migration script to convert existing plaintext to HTML

**Components:**
- `components/admin/rich-text-editor.tsx` - WYSIWYG editor for admins
- `components/teacher/sanitized-html.tsx` - Safe HTML renderer for teachers
- `components/HtmlWithLatex.tsx` - Enhanced with DOMPurify sanitization

**Overflow Fix (Latest Update):**
The `SanitizedHtml` component has been improved to prevent teacher instructions from overflowing their containers. The component now includes:
- Automatic word wrapping and text breaking to prevent horizontal overflow
- Configurable maximum height with vertical scrolling when content exceeds the limit
- Responsive image sizing to ensure images fit within their containers
- Default max-height of 64 units (approximately 16rem), customizable via the `maxHeight` prop

**Usage Example:**
```tsx
import SanitizedHtml from '@/components/teacher/sanitized-html'

// Basic usage with default max-height (max-h-64)
<SanitizedHtml html={teacherInstructions} />

// Custom max-height and additional styling
<SanitizedHtml 
  html={teacherInstructions}
  maxHeight="max-h-96"
  className="border rounded-lg p-4"
/>

// No height restriction (allows full content display)
<SanitizedHtml 
  html={teacherInstructions}
  maxHeight=""
/>
```

When implementing in teacher pages, replace any existing HTML renderers with the `SanitizedHtml` component to ensure consistent overflow handling and security.

**Migration:**
```bash
# Preview changes (dry run)
node scripts/migrate-instructions.js --dry-run

# Apply changes to Firestore
node scripts/migrate-instructions.js
```

For detailed documentation, see [docs/RICH_TEXT_EDITOR.md](docs/RICH_TEXT_EDITOR.md).

## Development

### Install Dependencies
```bash
npm install --legacy-peer-deps
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Run Linter
```bash
npm run lint
```

## Project Structure

```
.
├── app/                    # Next.js app directory
│   ├── admin/             # Admin portal pages
│   ├── teacher/           # Teacher portal pages
│   └── student/           # Student portal pages
├── components/            # Reusable React components
│   ├── admin/            # Admin-specific components
│   ├── teacher/          # Teacher-specific components
│   └── ui/               # Shared UI components
├── lib/                   # Utility libraries and helpers
│   ├── firebase.ts       # Firebase configuration
│   ├── firestore.ts      # Firestore helpers
│   └── storage.ts        # Storage helpers
├── scripts/               # Utility scripts
│   └── migrate-instructions.js  # Migration script for HTML conversion
└── docs/                  # Documentation
    └── RICH_TEXT_EDITOR.md      # Rich text editor documentation
```

## Security

All HTML content is sanitized using DOMPurify before rendering to prevent XSS attacks. Only safe HTML tags and attributes are allowed, and scripts/event handlers are automatically stripped.

## Technologies

- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **Styling:** Tailwind CSS
- **Database:** Firebase Firestore
- **Rich Text:** react-quill
- **HTML Sanitization:** DOMPurify
- **Math Rendering:** KaTeX (react-katex)

## License

Private project for educational use.
