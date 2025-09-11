"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
                <h1 className="text-2xl font-bold text-foreground">{"Compose Email"}</h1>
                <Button className="bg-secondary hover:bg-secondary/90">
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>

              <Separator />

              {/* Recipient Fields */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted" />
                  <Input placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCc(!showCc)}
                    className="text-muted hover:text-foreground"
                  >
                    Cc
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBcc(!showBcc)}
                    className="text-muted hover:text-foreground"
                  >
                    Bcc
                  </Button>
                </div>

                {showCc && (
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-muted" />
                    <Input placeholder="Cc" value={cc} onChange={(e) => setCc(e.target.value)} className="flex-1" />
                  </div>
                )}

                {showBcc && (
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-muted" />
                    <Input placeholder="Bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} className="flex-1" />
                  </div>
                )}

                <Input
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="text-lg font-medium"
                />
              </div>

              <Separator />

              {/* Formatting Toolbar */}
              <Card className="p-3 bg-card">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => formatText("bold")}
                    className="hover:bg-secondary/20"
                  >
                    <Bold className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => formatText("italic")}
                    className="hover:bg-secondary/20"
                  >
                    <Italic className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => formatText("underline")}
                    className="hover:bg-secondary/20"
                  >
                    <Underline className="w-4 h-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => formatText("insertUnorderedList")}
                    className="hover:bg-secondary/20"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => formatText("insertOrderedList")}
                    className="hover:bg-secondary/20"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <Button variant="ghost" size="sm" className="hover:bg-secondary/20">
                    <Link className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="hover:bg-secondary/20">
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="hover:bg-secondary/20">
                    <Paperclip className="w-4 h-4" />
                  </Button>
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
