"use client"

import { useState, useRef, useEffect } from "react"
import "@/styles/editor.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
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
  Plus,
  Eraser,
} from "lucide-react"

export function EmailEditor() {
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [currentTextColor, setCurrentTextColor] = useState("#000000")
  const [currentHighlightColor, setCurrentHighlightColor] = useState("transparent")
  const [currentAlignment, setCurrentAlignment] = useState("left")
  const [currentStyle, setCurrentStyle] = useState("normal")
  const editorRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setCurrentTextColor(color)
    formatText("foreColor", color)
  }

  const handleBackgroundColor = (color: string) => {
    setCurrentHighlightColor(color)
    if (color === "transparent") {
      formatText("hiliteColor", "transparent")
    } else {
      formatText("hiliteColor", color)
    }
  }

  const handleHeading = (value: string) => {
    setCurrentStyle(value)
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
    if (!imageInputRef.current) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.style.display = 'none'
      document.body.appendChild(input)
      imageInputRef.current = input
    }
    
    imageInputRef.current.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // Vérifier la taille du fichier (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert("L'image est trop volumineuse. Taille maximale : 5MB")
          return
        }
        
        // Vérifier le type de fichier
        if (!file.type.startsWith('image/')) {
          alert("Veuillez sélectionner un fichier image valide")
          return
        }
        
        const reader = new FileReader()
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string
          if (imageUrl) {
            formatText('insertImage', imageUrl)
          }
        }
        reader.onerror = () => {
          alert("Erreur lors du chargement de l'image")
        }
        reader.readAsDataURL(file)
      }
      // Reset input value pour permettre de sélectionner le même fichier
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }
    }
    
    imageInputRef.current.click()
  }

  const insertFile = () => {
    if (!fileInputRef.current) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '*/*'
      input.style.display = 'none'
      document.body.appendChild(input)
      fileInputRef.current = input
    }
    
    fileInputRef.current.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // Vérifier la taille du fichier (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert("Le fichier est trop volumineux. Taille maximale : 10MB")
          return
        }
        
        try {
          // Créer un lien vers le fichier
          const fileUrl = URL.createObjectURL(file)
          const fileName = file.name
          const fileSize = file.size < 1024 * 1024 
            ? (file.size / 1024).toFixed(1) + ' KB'
            : (file.size / 1024 / 1024).toFixed(1) + ' MB'
          
          // Insérer un lien avec le nom du fichier
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const link = document.createElement('a')
            link.href = fileUrl
            link.download = fileName
            link.textContent = `📎 ${fileName} (${fileSize})`
            link.style.textDecoration = 'underline'
            link.style.color = 'hsl(var(--primary))'
            link.style.marginRight = '8px'
            link.title = `Télécharger ${fileName}`
            range.insertNode(link)
            
            // Ajouter un espace après le lien
            const space = document.createTextNode(' ')
            range.insertNode(space)
            range.setStartAfter(space)
            range.collapse(true)
          }
        } catch (error) {
          alert("Erreur lors de l'ajout du fichier")
        }
      }
      // Reset input value
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    
    fileInputRef.current.click()
  }

  // Fonction pour détecter le formatage actuel
  const updateCurrentFormat = () => {
    if (typeof document.queryCommandSupported === 'function') {
      try {
        // Détecter l'alignement
        if (document.queryCommandState('justifyCenter')) {
          setCurrentAlignment('center')
        } else if (document.queryCommandState('justifyRight')) {
          setCurrentAlignment('right')
        } else if (document.queryCommandState('justifyFull')) {
          setCurrentAlignment('justify')
        } else {
          setCurrentAlignment('left')
        }
      } catch (error) {
        // Ignore les erreurs de queryCommandState
      }
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

    const handleSelectionChange = () => {
      updateCurrentFormat()
    }

    const editor = editorRef.current
    if (editor) {
      editor.addEventListener('keydown', handleKeyDown)
      editor.addEventListener('mouseup', handleSelectionChange)
      editor.addEventListener('keyup', handleSelectionChange)
      document.addEventListener('selectionchange', handleSelectionChange)
      
      return () => {
        editor.removeEventListener('keydown', handleKeyDown)
        editor.removeEventListener('mouseup', handleSelectionChange)
        editor.removeEventListener('keyup', handleSelectionChange)
        document.removeEventListener('selectionchange', handleSelectionChange)
      }
    }
  }, [])

  // Nettoyage des inputs cachés
  useEffect(() => {
    return () => {
      if (imageInputRef.current) {
        document.body.removeChild(imageInputRef.current)
      }
      if (fileInputRef.current) {
        document.body.removeChild(fileInputRef.current)
      }
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
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-[50px] h-8 text-foreground hover:bg-accent hover:text-accent-foreground border border-border cursor-pointer gap-1 px-2"
                          >
                            <div className="flex items-center justify-center">
                              {currentStyle === "normal" && <Type className="w-4 h-4" />}
                              {currentStyle === "<h1>" && <Heading1 className="w-4 h-4" />}
                              {currentStyle === "<h2>" && <Heading2 className="w-4 h-4" />}
                              {currentStyle === "<h3>" && <Heading3 className="w-4 h-4" />}
                            </div>
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        {currentStyle === "normal" && "Paragraphe normal"}
                        {currentStyle === "<h1>" && "Titre 1"}
                        {currentStyle === "<h2>" && "Titre 2"}
                        {currentStyle === "<h3>" && "Titre 3"}
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleHeading("normal")}>
                        <div className="flex items-center gap-2">
                          <Type className="w-4 h-4" />
                          <span>Normal</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleHeading("<h1>")}>
                        <div className="flex items-center gap-2">
                          <Heading1 className="w-4 h-4" />
                          <span className="font-bold text-lg">Titre 1</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleHeading("<h2>")}>
                        <div className="flex items-center gap-2">
                          <Heading2 className="w-4 h-4" />
                          <span className="font-semibold text-base">Titre 2</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleHeading("<h3>")}>
                        <div className="flex items-center gap-2">
                          <Heading3 className="w-4 h-4" />
                          <span className="font-medium text-sm">Titre 3</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                            className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer gap-1 relative"
                          >
                            <div className="relative">
                              <Palette className="w-4 h-4" />
                              <div 
                                className="absolute -bottom-0.5 left-0 right-0 h-1 rounded-sm border border-border"
                                style={{ backgroundColor: currentTextColor }}
                              />
                            </div>
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
                          value={currentTextColor}
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
                            className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer gap-1 relative"
                          >
                            <div className="relative">
                              <Highlighter className="w-4 h-4" />
                              <div 
                                className="absolute -bottom-0.5 left-0 right-0 h-1 rounded-sm border border-border"
                                style={{ 
                                  backgroundColor: currentHighlightColor === "transparent" ? "#ffffff" : currentHighlightColor,
                                  opacity: currentHighlightColor === "transparent" ? 0.3 : 1
                                }}
                              />
                            </div>
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
                            {currentAlignment === "left" && <AlignLeft className="w-4 h-4" />}
                            {currentAlignment === "center" && <AlignCenter className="w-4 h-4" />}
                            {currentAlignment === "right" && <AlignRight className="w-4 h-4" />}
                            {currentAlignment === "justify" && <AlignJustify className="w-4 h-4" />}
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Alignement</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => { setCurrentAlignment("left"); formatText("justifyLeft"); }}>
                        <AlignLeft className="w-4 h-4 mr-2" />
                        Aligner à gauche
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setCurrentAlignment("center"); formatText("justifyCenter"); }}>
                        <AlignCenter className="w-4 h-4 mr-2" />
                        Centrer
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setCurrentAlignment("right"); formatText("justifyRight"); }}>
                        <AlignRight className="w-4 h-4 mr-2" />
                        Aligner à droite
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setCurrentAlignment("justify"); formatText("justifyFull"); }}>
                        <AlignJustify className="w-4 h-4 mr-2" />
                        Justifier
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Separator orientation="vertical" className="h-6" />
                  
                  {/* Lists Dropdown */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer gap-1"
                          >
                            <List className="w-4 h-4" />
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Listes</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => formatText("insertUnorderedList")}>
                        <List className="w-4 h-4 mr-2" />
                        Liste à puces
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => formatText("insertOrderedList")}>
                        <ListOrdered className="w-4 h-4 mr-2" />
                        Liste numérotée
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Separator orientation="vertical" className="h-6" />
                  
                  {/* Insert Dropdown */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer gap-1"
                          >
                            <Plus className="w-4 h-4" />
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Insérer</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={insertLink}>
                        <Link className="w-4 h-4 mr-2" />
                        Insérer un lien
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={insertImage}>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Insérer une image
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={insertFile}>
                        <Paperclip className="w-4 h-4 mr-2" />
                        Joindre un fichier
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {/* Clear Formatting */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => formatText("removeFormat")}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer ml-auto"
                      >
                        <Eraser className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Effacer le formatage</TooltipContent>
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
