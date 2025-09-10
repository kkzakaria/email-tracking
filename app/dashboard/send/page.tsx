import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { NavigationBar } from "@/components/navigation-bar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Send } from "lucide-react"

export default async function SendPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  const userInfo = user ? {
    email: user.email || undefined,
    name: user.user_metadata?.name || undefined,
    image: user.user_metadata?.avatar_url || undefined
  } : undefined

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar user={userInfo} />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Envoyer un Email
            </CardTitle>
            <CardDescription>
              Fonctionnalité d'envoi d'emails avec tracking - Bientôt disponible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Send className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Page en construction</p>
              <p className="text-sm mt-2">L'interface d'envoi d'emails sera bientôt disponible.</p>
              <p className="text-sm mt-1">Pour l'instant, utilisez Outlook pour envoyer vos emails.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}