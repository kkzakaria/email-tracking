import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Send } from "lucide-react"
import { EmailEditor } from "@/components/email-form/email-editor"

export default function SendPage() {
  return (
    <main className="min-h-screen bg-background">
      <EmailEditor />
    </main>
  )
}