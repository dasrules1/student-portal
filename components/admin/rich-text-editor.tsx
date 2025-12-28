"use client"

import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'

// Dynamically import ReactQuill for client-side only rendering to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading editor...</p>
})

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * Rich text editor component using react-quill for admin interfaces.
 * 
 * Provides a WYSIWYG editor with formatting toolbar including:
 * - Headers (H1, H2, H3)
 * - Text formatting (bold, italic, underline, strike)
 * - Lists (ordered and unordered)
 * - Blockquotes
 * - Code blocks
 * - Links
 * - Clean formatting
 * 
 * @param value - Current HTML content value
 * @param onChange - Callback fired when content changes
 * @param placeholder - Placeholder text for empty editor
 * @param className - Optional CSS class name for styling
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter text...',
  className = ''
}: RichTextEditorProps) {
  // Quill toolbar configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['blockquote', 'code-block'],
      ['link'],
      ['clean']
    ]
  }

  // Quill formats configuration
  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'blockquote', 'code-block',
    'link'
  ]

  return (
    <div className={className}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
        className="bg-white dark:bg-slate-950"
      />
    </div>
  )
}
