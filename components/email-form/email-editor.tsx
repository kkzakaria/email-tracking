"use client"

import { useState, useRef, useEffect } from "react"
import "@/styles/editor.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  ChevronDown,
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

  const handleHeading = (value: string) => {
    if (value === "normal") {
      formatText("formatBlock", "<p>")
    } else {
      formatText("formatBlock", value)
    }
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
                  
                  {/* Headings Dropdown */}
                  <Select onValueChange={handleHeading} defaultValue="normal">
                    <SelectTrigger className="w-[140px] h-8 text-sm">
                      <SelectValue placeholder="Style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">
                        <div className="flex items-center gap-2">
                          <Type className="w-4 h-4" />
                          <span>Normal</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="<h1>">
                        <div className="flex items-center gap-2">
                          <Heading1 className="w-4 h-4" />
                          <span className="font-bold text-lg">Titre 1</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="<h2>">
                        <div className="flex items-center gap-2">
                          <Heading2 className="w-4 h-4" />
                          <span className="font-semibold text-base">Titre 2</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="<h3>">
                        <div className="flex items-center gap-2">
                          <Heading3 className="w-4 h-4" />
                          <span className="font-medium text-sm">Titre 3</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                  
                  {/* Text Color Dropdown */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer gap-1"
                          >
                            <Palette className="w-4 h-4" />
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Couleur du texte</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="p-2">
                      <div className="grid grid-cols-5 gap-1">
                        <button
                          onClick={() => handleColorChange("#000000")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#000000" }}
                          title="Noir"
                        />
                        <button
                          onClick={() => handleColorChange("#EF4444")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#EF4444" }}
                          title="Rouge"
                        />
                        <button
                          onClick={() => handleColorChange("#F59E0B")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#F59E0B" }}
                          title="Orange"
                        />
                        <button
                          onClick={() => handleColorChange("#10B981")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#10B981" }}
                          title="Vert"
                        />
                        <button
                          onClick={() => handleColorChange("#3B82F6")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#3B82F6" }}
                          title="Bleu"
                        />
                        <button
                          onClick={() => handleColorChange("#8B5CF6")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#8B5CF6" }}
                          title="Violet"
                        />
                        <button
                          onClick={() => handleColorChange("#EC4899")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#EC4899" }}
                          title="Rose"
                        />
                        <button
                          onClick={() => handleColorChange("#6B7280")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#6B7280" }}
                          title="Gris"
                        />
                        <button
                          onClick={() => handleColorChange("#A78BFA")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#A78BFA" }}
                          title="Lavande"
                        />
                        <button
                          onClick={() => handleColorChange("#059669")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#059669" }}
                          title="Vert foncé"
                        />
                      </div>
                      <Separator className="my-2" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Personnalisé:</span>
                        <input
                          type="color"
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-border"
                        />
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Highlight Color Dropdown */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer gap-1"
                          >
                            <Highlighter className="w-4 h-4" />
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Surligner</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="p-2">
                      <div className="grid grid-cols-5 gap-1">
                        <button
                          onClick={() => handleBackgroundColor("transparent")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform bg-white relative"
                          title="Aucun"
                        >
                          <span className="absolute inset-0 flex items-center justify-center text-xs">✕</span>
                        </button>
                        <button
                          onClick={() => handleBackgroundColor("#FEF3C7")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#FEF3C7" }}
                          title="Jaune"
                        />
                        <button
                          onClick={() => handleBackgroundColor("#DBEAFE")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#DBEAFE" }}
                          title="Bleu clair"
                        />
                        <button
                          onClick={() => handleBackgroundColor("#D1FAE5")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#D1FAE5" }}
                          title="Vert clair"
                        />
                        <button
                          onClick={() => handleBackgroundColor("#FCE7F3")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#FCE7F3" }}
                          title="Rose clair"
                        />
                        <button
                          onClick={() => handleBackgroundColor("#FED7AA")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#FED7AA" }}
                          title="Orange clair"
                        />
                        <button
                          onClick={() => handleBackgroundColor("#E9D5FF")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#E9D5FF" }}
                          title="Lavande clair"
                        />
                        <button
                          onClick={() => handleBackgroundColor("#FEE2E2")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#FEE2E2" }}
                          title="Rouge clair"
                        />
                        <button
                          onClick={() => handleBackgroundColor("#F3F4F6")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#F3F4F6" }}
                          title="Gris clair"
                        />
                        <button
                          onClick={() => handleBackgroundColor("#CFFAFE")}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: "#CFFAFE" }}
                          title="Cyan clair"
                        />
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Separator orientation="vertical" className="h-6" />
                  
                  {/* Alignment Dropdown */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer gap-1"
                          >
                            <AlignLeft className="w-4 h-4" />
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Alignement</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => formatText("justifyLeft")}>
                        <AlignLeft className="w-4 h-4 mr-2" />
                        Aligner à gauche
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => formatText("justifyCenter")}>
                        <AlignCenter className="w-4 h-4 mr-2" />
                        Centrer
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => formatText("justifyRight")}>
                        <AlignRight className="w-4 h-4 mr-2" />
                        Aligner à droite
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => formatText("justifyFull")}>
                        <AlignJustify className="w-4 h-4 mr-2" />
                        Justifier
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
