"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  ImageIcon,
  Send,
  Paperclip,
  Users,
  Mail,
} from "lucide-react"

export function EmailEditor() {
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)

  const formatText = (command: string) => {
    document.execCommand(command, false, undefined)
  }

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
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer">
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
                  <Separator orientation="vertical" className="h-6" />
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer">
                        <Link className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insérer un lien</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-foreground hover:bg-accent hover:text-accent-foreground border-0 cursor-pointer">
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
                  contentEditable
                  className="w-full min-h-[400px] p-4 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground leading-relaxed"
                  style={{ whiteSpace: "pre-wrap" }}
                  onInput={(e) => setContent(e.currentTarget.textContent || "")}
                  suppressContentEditableWarning={true}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
