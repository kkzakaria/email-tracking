"use client"

import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import QuillBetterTable from 'quill-better-table'
import 'quill-better-table/dist/quill-better-table.css'

// Enregistrer le module de tableau
Quill.register('modules/better-table', QuillBetterTable)

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
        toolbar: {
          container: [
            [{ 'header': [1, 2, 3, false] }],
            [{ 'font': [] }],
            [{ 'size': ['small', false, 'large', 'huge'] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            ['blockquote', 'code-block'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'indent': '-1' }, { 'indent': '+1' }],
            [{ 'align': [] }],
            ['link', 'image'],
            [{ 'table': 'TD' }],
            ['clean']
          ],
          handlers: {
            table: function(this: any) {
              const tableModule = this.quill.getModule('better-table')
              tableModule.insertTable(3, 3)
            }
          }
        },
        'better-table': {
          operationMenu: {
            items: {
              unmergeCells: {
                text: 'Séparer les cellules'
              },
              insertColumnRight: {
                text: 'Insérer colonne à droite'  
              },
              insertColumnLeft: {
                text: 'Insérer colonne à gauche'
              },
              insertRowUp: {
                text: 'Insérer ligne au-dessus'
              },
              insertRowDown: {
                text: 'Insérer ligne en-dessous'
              },
              mergeCells: {
                text: 'Fusionner les cellules'
              },
              deleteColumn: {
                text: 'Supprimer colonne'
              },
              deleteRow: {
                text: 'Supprimer ligne'
              },
              deleteTable: {
                text: 'Supprimer tableau'
              }
            }
          }
        },
        keyboard: {
          bindings: QuillBetterTable.keyboardBindings
        }
      }
    })

    // Configure French tooltips and labels after initialization
    setTimeout(() => {
      const toolbar = quill.container.previousSibling as HTMLElement
      if (toolbar && toolbar.classList.contains('ql-toolbar')) {
        // Configure header picker
        const headerPicker = toolbar.querySelector('.ql-header .ql-picker-label')
        if (headerPicker) {
          headerPicker.setAttribute('title', 'Format de titre')
        }

        // Configure format buttons with French tooltips
        const buttons = [
          { selector: '.ql-bold', title: 'Gras (Ctrl+B)' },
          { selector: '.ql-italic', title: 'Italique (Ctrl+I)' },
          { selector: '.ql-underline', title: 'Souligné (Ctrl+U)' },
          { selector: '.ql-strike', title: 'Barré' },
          { selector: '.ql-font', title: 'Police de caractères' },
          { selector: '.ql-size', title: 'Taille du texte' },
          { selector: '.ql-color', title: 'Couleur du texte' },
          { selector: '.ql-background', title: 'Couleur de fond' },
          { selector: '.ql-blockquote', title: 'Citation' },
          { selector: '.ql-code-block', title: 'Bloc de code' },
          { selector: '.ql-list[value="ordered"]', title: 'Liste numérotée' },
          { selector: '.ql-list[value="bullet"]', title: 'Liste à puces' },
          { selector: '.ql-indent[value="-1"]', title: 'Diminuer le retrait' },
          { selector: '.ql-indent[value="+1"]', title: 'Augmenter le retrait' },
          { selector: '.ql-align', title: 'Alignement du texte' },
          { selector: '.ql-link', title: 'Insérer un lien' },
          { selector: '.ql-image', title: 'Insérer une image' },
          { selector: '.ql-table', title: 'Insérer un tableau' },
          { selector: '.ql-clean', title: 'Supprimer la mise en forme' }
        ]

        buttons.forEach(({ selector, title }) => {
          const element = toolbar.querySelector(selector)
          if (element) {
            element.setAttribute('title', title)
          }
        })

        // Configure align picker options
        const alignPicker = toolbar.querySelector('.ql-align')
        if (alignPicker) {
          alignPicker.setAttribute('title', 'Alignement du texte')
          const alignOptions = alignPicker.querySelectorAll('.ql-picker-item')
          const alignTitles = ['Aligner à gauche', 'Centrer', 'Aligner à droite', 'Justifier']
          alignOptions.forEach((option, index) => {
            if (alignTitles[index]) {
              option.setAttribute('title', alignTitles[index])
            }
          })
        }

        // Configure header picker options
        const headerPickerItems = toolbar.querySelectorAll('.ql-header .ql-picker-item')
        const headerTitles = ['Titre 1', 'Titre 2', 'Titre 3', 'Paragraphe normal']
        headerPickerItems.forEach((item, index) => {
          if (headerTitles[index]) {
            item.setAttribute('title', headerTitles[index])
          }
        })
      }
    }, 100)

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
        /* Localisation française des tooltips et labels */
        .quill-editor-container .ql-tooltip[data-mode=link]::before {
          content: "Entrer le lien:" !important;
        }
        .quill-editor-container .ql-tooltip[data-mode=video]::before {
          content: "Entrer la vidéo:" !important;
        }
        .quill-editor-container .ql-tooltip.ql-editing a.ql-action::after {
          content: "Modifier" !important;
        }
        .quill-editor-container .ql-tooltip a.ql-action::after {
          content: "Modifier" !important;
        }
        .quill-editor-container .ql-tooltip a.ql-remove::before {
          content: "Supprimer" !important;
        }
        .quill-editor-container .ql-snow .ql-tooltip[data-mode=link] input[type=text] {
          font-size: 13px;
        }
        .quill-editor-container .ql-picker.ql-header .ql-picker-label::before,
        .quill-editor-container .ql-picker.ql-header .ql-picker-item::before {
          content: "Paragraphe" !important;
        }
        .quill-editor-container .ql-picker.ql-header .ql-picker-label[data-value="1"]::before,
        .quill-editor-container .ql-picker.ql-header .ql-picker-item[data-value="1"]::before {
          content: "Titre 1" !important;
        }
        .quill-editor-container .ql-picker.ql-header .ql-picker-label[data-value="2"]::before,
        .quill-editor-container .ql-picker.ql-header .ql-picker-item[data-value="2"]::before {
          content: "Titre 2" !important;
        }
        .quill-editor-container .ql-picker.ql-header .ql-picker-label[data-value="3"]::before,
        .quill-editor-container .ql-picker.ql-header .ql-picker-item[data-value="3"]::before {
          content: "Titre 3" !important;
        }
        /* Labels français pour la taille */
        .quill-editor-container .ql-picker.ql-size .ql-picker-label::before,
        .quill-editor-container .ql-picker.ql-size .ql-picker-item::before {
          content: "Normal" !important;
        }
        .quill-editor-container .ql-picker.ql-size .ql-picker-label[data-value="small"]::before,
        .quill-editor-container .ql-picker.ql-size .ql-picker-item[data-value="small"]::before {
          content: "Petit" !important;
        }
        .quill-editor-container .ql-picker.ql-size .ql-picker-label[data-value="large"]::before,
        .quill-editor-container .ql-picker.ql-size .ql-picker-item[data-value="large"]::before {
          content: "Grand" !important;
        }
        .quill-editor-container .ql-picker.ql-size .ql-picker-label[data-value="huge"]::before,
        .quill-editor-container .ql-picker.ql-size .ql-picker-item[data-value="huge"]::before {
          content: "Très grand" !important;
        }
        /* Labels français pour la police */
        .quill-editor-container .ql-picker.ql-font .ql-picker-label::before,
        .quill-editor-container .ql-picker.ql-font .ql-picker-item::before {
          content: "Police par défaut" !important;
        }
        /* Styles pour les tableaux */
        .quill-editor-container .qlbt-col-tool,
        .quill-editor-container .qlbt-row-tool {
          background-color: hsl(var(--background));
          border: 1px solid hsl(var(--border));
        }
        .quill-editor-container .qlbt-operation-menu {
          background-color: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: var(--radius);
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .quill-editor-container .qlbt-operation-menu-item {
          color: hsl(var(--foreground));
          padding: 8px 12px;
          border-radius: calc(var(--radius) - 2px);
        }
        .quill-editor-container .qlbt-operation-menu-item:hover {
          background-color: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
        }
        /* Styles ultra-spécifiques pour les tableaux - forcer l'affichage des bordures */
        .quill-editor-container .ql-editor table,
        .quill-editor-wrapper .ql-editor table {
          border-collapse: collapse !important;
          width: 100% !important;
          margin: 16px 0 !important;
          border: 2px solid #d1d5db !important;
          background-color: white !important;
        }
        .quill-editor-container .ql-editor table td,
        .quill-editor-container .ql-editor table th,
        .quill-editor-wrapper .ql-editor table td,
        .quill-editor-wrapper .ql-editor table th {
          border: 1px solid #d1d5db !important;
          padding: 8px 12px !important;
          text-align: left !important;
          min-width: 80px !important;
          min-height: 40px !important;
          background-color: white !important;
          box-sizing: border-box !important;
        }
        .quill-editor-container .ql-editor table th {
          background-color: #f3f4f6 !important;
          font-weight: 600 !important;
        }
        .quill-editor-container .ql-editor table tr:nth-child(even) td {
          background-color: #f9fafb !important;
        }
        /* Styles spécifiques pour quill-better-table */
        .quill-editor-container .ql-editor .qlbt-table,
        .quill-editor-container .ql-editor table[data-table-id],
        .ql-editor .qlbt-table,
        .ql-editor table[data-table-id] {
          border: 2px solid #d1d5db !important;
          border-collapse: collapse !important;
        }
        .quill-editor-container .ql-editor .qlbt-table td,
        .quill-editor-container .ql-editor table[data-table-id] td,
        .ql-editor .qlbt-table td,
        .ql-editor table[data-table-id] td {
          border: 1px solid #d1d5db !important;
          border-right: 1px solid #d1d5db !important;
          border-bottom: 1px solid #d1d5db !important;
          border-left: 1px solid #d1d5db !important;
          border-top: 1px solid #d1d5db !important;
        }
        /* Force l'affichage même si le CSS de quill-better-table interfère */
        div[contenteditable] table {
          border: 2px solid #d1d5db !important;
        }
        div[contenteditable] table td {
          border: 1px solid #d1d5db !important;
        }
      `}</style>
    </div>
  )
})

QuillEditor.displayName = 'QuillEditor'

export default QuillEditor