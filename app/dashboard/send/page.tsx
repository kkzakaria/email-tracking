import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Send } from "lucide-react"
import EmailForm from "@/components/email-form/email-form"

export default function SendPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Soumettre un Email
          </CardTitle>
          <CardDescription>
            Envoyez un email avec suivi automatique des réponses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailForm />
        </CardContent>
      </Card>
    </div>
  )
}