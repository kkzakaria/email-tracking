"use client"

import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

interface QuillEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
}

interface QuillToolbar {
  addHandler: (format: string, handler: () => void) => void
}

const QuillEditor = forwardRef<Quill | null, QuillEditorProps>(({ 
  value, 
  onChange,
  placeholder = "Composez votre message...",
  className = "",
  readOnly = false
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const quillInstanceRef = useRef<Quill | null>(null)
  const onChangeRef = useRef(onChange)
  const isInternalUpdate = useRef(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Keep onChange ref updated
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  })

  // Initialize Quill
  useEffect(() => {
    // Prevent double initialization
    if (!editorRef.current || isInitialized || quillInstanceRef.current) {
      return
    }

    // Clean any existing Quill elements that might be there
    const existingToolbar = editorRef.current.parentElement?.querySelector('.ql-toolbar')
    const existingContainer = editorRef.current.querySelector('.ql-container')
    
    if (existingToolbar) {
      existingToolbar.remove()
    }
    if (existingContainer) {
      existingContainer.remove()
    }

    // Clear the editor content
    editorRef.current.innerHTML = ''

    // Initialize new Quill instance
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          [{ 'indent': '-1' }, { 'indent': '+1' }],
          [{ 'align': [] }],
          ['link', 'image'],
          ['clean']
        ]
      }
    })

    // Set initial content
    if (value && value !== '<p><br></p>') {
      isInternalUpdate.current = true
      quill.root.innerHTML = value
      isInternalUpdate.current = false
    }

    // Listen for text changes
    const textChangeHandler = () => {
      if (!isInternalUpdate.current) {
        const html = quill.root.innerHTML
        onChangeRef.current(html === '<p><br></p>' ? '' : html)
      }
    }
    
    quill.on('text-change', textChangeHandler)

    // Handle image uploads
    const toolbar = quill.getModule('toolbar') as QuillToolbar | null
    if (toolbar && 'addHandler' in toolbar) {
      toolbar.addHandler('image', () => {
        const input = document.createElement('input')
        input.setAttribute('type', 'file')
        input.setAttribute('accept', 'image/*')
        input.style.display = 'none'

        input.onchange = async () => {
          const file = input.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
              const range = quill.getSelection(true)
              if (range) {
                quill.insertEmbed(range.index, 'image', e.target?.result as string)
                quill.setSelection(range.index + 1, 0)
              }
            }
            reader.readAsDataURL(file)
          }
        }

        document.body.appendChild(input)
        input.click()
        document.body.removeChild(input)
      })
    }

    quillInstanceRef.current = quill
    setIsInitialized(true)

    // Expose quill instance via ref
    if (ref) {
      if (typeof ref === 'function') {
        ref(quill)
      } else {
        ref.current = quill
      }
    }

    // Cleanup function
    return () => {
      // Remove event listeners
      quill.off('text-change', textChangeHandler)
      
      // Clear ref
      if (ref) {
        if (typeof ref === 'function') {
          ref(null)
        } else {
          ref.current = null
        }
      }
      
      // Clear the quill instance reference
      quillInstanceRef.current = null
      setIsInitialized(false)
      
      // Clean up DOM elements
      const toolbar = editorRef.current?.parentElement?.querySelector('.ql-toolbar')
      if (toolbar) {
        toolbar.remove()
      }
    }
  }, []) // Only run once on mount

  // Update content when value changes externally
  useEffect(() => {
    if (quillInstanceRef.current && value !== undefined && !isInternalUpdate.current) {
      const currentHtml = quillInstanceRef.current.root.innerHTML
      
      // Only update if content actually changed
      if (currentHtml !== value) {
        isInternalUpdate.current = true
        
        // Handle empty state properly
        if (value === '' || value === '<p><br></p>') {
          quillInstanceRef.current.setText('')
        } else {
          quillInstanceRef.current.root.innerHTML = value
        }
        
        isInternalUpdate.current = false
      }
    }
  }, [value])

  // Handle readOnly state
  useEffect(() => {
    if (quillInstanceRef.current) {
      quillInstanceRef.current.enable(!readOnly)
    }
  }, [readOnly])

  return (
    <div className={`quill-editor-wrapper ${className}`}>
      <div ref={editorRef} className="quill-editor-container" />
      <style jsx global>{`
        .quill-editor-wrapper {
          position: relative;
          border: 1px solid hsl(var(--border));
          border-radius: calc(var(--radius) - 2px);
          background-color: hsl(var(--background));
        }
        .quill-editor-container .ql-container {
          font-size: 14px;
          font-family: inherit;
          border: none !important;
          background-color: transparent;
        }
        .quill-editor-container .ql-editor {
          min-height: 250px;
          line-height: 1.6;
          padding: 12px 15px;
          background-color: transparent;
          color: hsl(var(--foreground));
        }
        .quill-editor-container .ql-editor.ql-blank::before {
          font-style: italic;
          color: hsl(var(--muted-foreground));
          opacity: 0.7;
        }
        .quill-editor-container .ql-toolbar.ql-snow {
          border: none !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
          border-radius: calc(var(--radius) - 2px) calc(var(--radius) - 2px) 0 0;
          padding: 8px 12px;
          background-color: hsl(var(--background));
        }
        .quill-editor-container .ql-container.ql-snow {
          border: none !important;
          border-radius: 0 0 calc(var(--radius) - 2px) calc(var(--radius) - 2px);
          background-color: transparent;
        }
        .quill-editor-container .ql-toolbar .ql-formats {
          margin-right: 15px;
        }
        .quill-editor-container .ql-toolbar button {
          padding: 3px 5px;
          margin: 0 1px;
          border-radius: calc(var(--radius) - 4px);
          color: hsl(var(--foreground));
        }
        .quill-editor-container .ql-toolbar button:hover {
          background-color: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
        }
        .quill-editor-container .ql-toolbar button.ql-active {
          background-color: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
        }
        .quill-editor-container .ql-toolbar .ql-picker-label {
          color: hsl(var(--foreground));
        }
        .quill-editor-container .ql-toolbar .ql-picker-options {
          background-color: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius);
        }
      `}</style>
    </div>
  )
})

QuillEditor.displayName = 'QuillEditor'

export default QuillEditor