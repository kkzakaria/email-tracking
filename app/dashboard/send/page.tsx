import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Send } from "lucide-react"

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
            Fonctionnalité de soumission d'emails avec tracking - Bientôt disponible
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Send className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Page en construction</p>
            <p className="text-sm mt-2">L'interface de soumission d'emails sera bientôt disponible.</p>
            <p className="text-sm mt-1">Pour l'instant, utilisez Outlook pour envoyer vos emails.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}