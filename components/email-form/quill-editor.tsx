"use client"

import React, { useEffect, useRef, useState } from 'react'
import 'quill/dist/quill.snow.css'

interface QuillEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const QuillEditor: React.FC<QuillEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = "Composez votre message...", 
  className = "" 
}) => {
  const quillRef = useRef<any>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (editorRef.current && !quillRef.current) {
      // Dynamic import of Quill
      import('quill').then(({ default: Quill }) => {
        // First, clear any existing toolbar
        const existingToolbar = editorRef.current!.querySelector('.ql-toolbar')
        if (existingToolbar) {
          existingToolbar.remove()
        }

        // Create Quill instance with explicit toolbar configuration
        const quill = new Quill(editorRef.current!, {
          theme: 'snow',
          placeholder,
          modules: {
            toolbar: {
              container: [
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'header': 1 }, { 'header': 2 }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'align': [] }],
                ['link', 'image'],
                ['clean']
              ]
            }
          },
        })

        // Remove any duplicate toolbars after initialization
        setTimeout(() => {
          const toolbars = document.querySelectorAll('.quill-single-editor .ql-toolbar')
          if (toolbars.length > 1) {
            // Keep only the last one (the functional one)
            for (let i = 0; i < toolbars.length - 1; i++) {
              toolbars[i].remove()
            }
          }
        }, 100)

        // Set initial value if provided
        if (value) {
          quill.clipboard.dangerouslyPasteHTML(value)
        }

        // Listen for text changes
        quill.on('text-change', () => {
          const html = quill.root.innerHTML
          const isEmpty = quill.getText().trim().length === 0
          onChange(isEmpty ? '' : html)
        })

        // Enable editing
        quill.enable(true)
        
        quillRef.current = quill
        setIsLoaded(true)
      })
    }

    return () => {
      if (quillRef.current) {
        quillRef.current = null
      }
    }
  }, [placeholder])

  // Update content when value prop changes
  useEffect(() => {
    if (quillRef.current && isLoaded) {
      const currentContent = quillRef.current.root.innerHTML
      if (currentContent !== value && value !== undefined) {
        quillRef.current.clipboard.dangerouslyPasteHTML(value)
      }
    }
  }, [value, isLoaded])

  return (
    <div className={`quill-single-editor ${className}`}>
      <div ref={editorRef} style={{ minHeight: '300px' }} />
      <style jsx>{`
        .quill-single-editor .ql-editor {
          min-height: 280px;
          font-size: 14px;
          line-height: 1.6;
        }
        .quill-single-editor .ql-toolbar {
          border: 1px solid #ccc;
          border-bottom: none;
        }
        .quill-single-editor .ql-container {
          border: 1px solid #ccc;
          border-top: none;
        }
        /* Hide any duplicate toolbars */
        .quill-single-editor .ql-toolbar + .ql-toolbar {
          display: none !important;
        }
      `}</style>
    </div>
  )
}

export default QuillEditor