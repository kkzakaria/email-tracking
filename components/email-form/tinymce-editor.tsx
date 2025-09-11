"use client"

import React, { useRef } from 'react'
import { Editor } from '@tinymce/tinymce-react'

interface TinyMCEEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const TinyMCEEditor: React.FC<TinyMCEEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = "Composez votre message...", 
  className = "" 
}) => {
  const editorRef = useRef<any>(null)
  
  const handleEditorChange = (content: string) => {
    onChange(content)
  }

  return (
    <div className={`tinymce-editor ${className}`}>
      <Editor
        onInit={(evt, editor) => editorRef.current = editor}
        value={value}
        onEditorChange={handleEditorChange}
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        init={{
          height: 300,
          menubar: false,
          placeholder,
          language: 'fr_FR',
          plugins: [
            'lists', 'link', 'table', 'code', 'wordcount', 'autoresize'
          ],
          toolbar: 'undo redo | blocks | bold italic underline strikethrough | ' +
                   'alignleft aligncenter alignright alignjustify | ' +
                   'bullist numlist | outdent indent | ' +
                   'table | link | code | removeformat',
          table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | ' +
                        'tableinsertcolbefore tableinsertcolafter tabledeletecol',
          table_appearance_options: false,
          table_grid: false,
          table_tab_navigation: true,
          table_default_attributes: {
            border: '1'
          },
          table_default_styles: {
            width: '100%',
            'border-collapse': 'collapse'
          },
          content_style: `
            body { 
              font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
              font-size: 14px; 
              line-height: 1.6; 
              margin: 1rem; 
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
            }
            table td, table th { 
              border: 1px solid #ddd; 
              padding: 8px; 
            }
            table th { 
              background-color: #f2f2f2; 
            }
          `,
          skin: 'oxide',
          content_css: 'default',
          branding: false,
          resize: false,
          statusbar: false,
          convert_urls: false,
          relative_urls: false,
          remove_script_host: false,
          document_base_url: '/',
        }}
      />
    </div>
  )
}

export default TinyMCEEditor