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
            'lists', 'link', 'image', 'table', 'code', 'wordcount', 'autoresize'
          ],
          toolbar: 'undo redo | blocks | bold italic underline strikethrough | ' +
                   'alignleft aligncenter alignright alignjustify | ' +
                   'bullist numlist | outdent indent | ' +
                   'table | link | image | code | removeformat',
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
          toolbar_mode: 'sliding',
          toolbar_sticky: false,
          image_upload_handler: function (blobInfo: any, success: (url: string) => void, failure: (err: string) => void) {
            // Convertir l'image en base64 pour l'intégrer directement
            const reader = new FileReader();
            reader.onload = function(e) {
              success(e.target?.result as string);
            };
            reader.onerror = function() {
              failure('Erreur lors du chargement de l\'image');
            };
            reader.readAsDataURL(blobInfo.blob());
          },
          images_upload_base_path: '',
          automatic_uploads: true,
          file_picker_types: 'image',
          image_advtab: false,
          image_title: true,
          image_description: false,
          setup: function (editor: any) {
            editor.ui.registry.addButton('image', {
              icon: 'image',
              tooltip: 'Insérer une image',
              onAction: function () {
                const input = document.createElement('input');
                input.setAttribute('type', 'file');
                input.setAttribute('accept', 'image/*');
                input.style.display = 'none';
                
                input.onchange = function (e: any) {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                      const img = `<img src="${e.target?.result}" alt="${file.name}" style="max-width: 100%;" />`;
                      editor.insertContent(img);
                    };
                    reader.readAsDataURL(file);
                  }
                };
                
                document.body.appendChild(input);
                input.click();
                document.body.removeChild(input);
              }
            });
          },
          file_picker_callback: function (callback: (url: string, meta?: any) => void, _value: string, meta: any) {
            if (meta.filetype === 'image') {
              const input = document.createElement('input');
              input.setAttribute('type', 'file');
              input.setAttribute('accept', 'image/*');
              input.style.display = 'none';
              
              input.onchange = function (e: any) {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = function (e) {
                    callback(e.target?.result as string, {
                      alt: file.name,
                      title: file.name
                    });
                  };
                  reader.readAsDataURL(file);
                }
              };
              
              document.body.appendChild(input);
              input.click();
              document.body.removeChild(input);
            }
          },
        }}
      />
    </div>
  )
}

export default TinyMCEEditor