"use client"

import { useState, useRef, useEffect } from "react"
import "@/styles/editor.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link,
  ImageIcon,
  Send,
  Paperclip,
  Users,
  Mail,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Palette,
  Highlighter,
  Type,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react"

export function EmailEditor() {
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value)
  }

  const handleUndo = () => {
    document.execCommand("undo", false)
  }

  const handleRedo = () => {
    document.execCommand("redo", false)
  }

  const handleColorChange = (color: string) => {
    formatText("foreColor", color)
  }

  const handleBackgroundColor = (color: string) => {
    formatText("hiliteColor", color)
  }

  const handleHeading = (level: string) => {
    formatText("formatBlock", level)
  }

  const insertLink = () => {
    const url = prompt("Entrez l'URL du lien:")
    if (url) {
      formatText("createLink", url)
    }
  }

  const insertImage = () => {
    const url = prompt("Entrez l'URL de l'image:")
    if (url) {
      formatText("insertImage", url)
    }
  }

  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case 'b':
            e.preventDefault()
            formatText('bold')
            break
          case 'i':
            e.preventDefault()
            formatText('italic')
            break
          case 'u':
            e.preventDefault()
            formatText('underline')
            break
          case 'z':
            if (e.shiftKey) {
              e.preventDefault()
              handleRedo()
            } else {
              e.preventDefault()
              handleUndo()
            }
            break
        }
      }
    }

    const editor = editorRef.current
    if (editor) {
      editor.addEventListener('keydown', handleKeyDown)
      return () => editor.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="w-full">
        {/* Main Editor */}
        <div>
          <Card className="p-6">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">{"Composer un email"}</h1>
                <Button 
                  className="bg-blue-700 hover:bg-blue-800 text-white cursor-pointer"
                  onClick={() => {
                    console.log("Sending email with content:", content)
                    // TODO: Implémenter l'envoi réel de l'email
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer
                </Button>
              </div>

              <Separator />

              {/* Recipient Fields */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <Input placeholder="À" value={to} onChange={(e) => setTo(e.target.value)} className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCc(!showCc)}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                  >
                    Cc
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBcc(!showBcc)}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                  >
                    Cci
                  </Button>
                </div>

                {showCc && (
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Cc" value={cc} onChange={(e) => setCc(e.target.value)} className="flex-1" />
                  </div>
                )}

                {showBcc && (
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Cci" value={bcc} onChange={(e) => setBcc(e.target.value)} className="flex-1" />
                  </div>
                )}

                <Input
                  placeholder="Sujet"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="text-lg font-medium"
                />
              </div>

              <Separator />

              {/* Formatting Toolbar */}
              <Card className="p-3 bg-muted/30 border">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Undo/Redo */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUndo}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Undo2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Annuler</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRedo}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Redo2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Rétablir</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="h-6" />
                  
                  {/* Headings */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleHeading("<h1>")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Heading1 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Titre 1</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleHeading("<h2>")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Heading2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Titre 2</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleHeading("<h3>")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Heading3 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Titre 3</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleHeading("<p>")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Type className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Paragraphe</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="h-6" />
                  
                  {/* Text Formatting */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("bold")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Bold className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Gras</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("italic")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Italic className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Italique</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("underline")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Underline className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Souligné</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("strikeThrough")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Strikethrough className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Barré</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="h-6" />
                  
                  {/* Colors */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                        >
                          <Palette className="w-4 h-4" />
                        </Button>
                        <input
                          type="color"
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Couleur du texte</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                        >
                          <Highlighter className="w-4 h-4" />
                        </Button>
                        <input
                          type="color"
                          onChange={(e) => handleBackgroundColor(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          defaultValue="#FFFF00"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Surligner</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="h-6" />
                  
                  {/* Alignment */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("justifyLeft")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <AlignLeft className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Aligner à gauche</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("justifyCenter")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <AlignCenter className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Centrer</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("justifyRight")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <AlignRight className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Aligner à droite</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("justifyFull")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <AlignJustify className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Justifier</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="h-6" />
                  
                  {/* Lists */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("insertUnorderedList")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Liste à puces</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("insertOrderedList")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <ListOrdered className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Liste numérotée</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="h-6" />
                  
                  {/* Insert */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={insertLink}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <Link className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insérer un lien</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={insertImage}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insérer une image</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer">
                        <Paperclip className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Joindre un fichier</TooltipContent>
                  </Tooltip>
                </div>
              </Card>

              {/* Content Editor */}
              <div className="min-h-[400px]">
                <div
                  ref={editorRef}
                  contentEditable
                  className="w-full min-h-[400px] p-4 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground leading-relaxed"
                  style={{ whiteSpace: "pre-wrap" }}
                  onInput={(e) => setContent(e.currentTarget.innerHTML || "")}
                  suppressContentEditableWarning={true}
                  data-placeholder="Composez votre message..."
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
