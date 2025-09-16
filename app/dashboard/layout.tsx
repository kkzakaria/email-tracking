import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { NavigationBar } from "@/components/navigation-bar"
import { RealtimeProvider } from "@/components/dashboard/realtime-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  // Récupérer les informations utilisateur pour la navigation
  const userInfo = user ? {
    email: user.email || undefined,
    name: user.user_metadata?.name || undefined,
    image: user.user_metadata?.avatar_url || undefined
  } : undefined

  // Récupérer les emails pour initialiser le Realtime
  let emails: any[] = []
  try {
    const { data: emailData } = await supabase
      .from('tracked_emails')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(1000)
      
    if (emailData) {
      emails = emailData
      console.log('📧 Layout SSR: Récupéré', emailData.length, 'emails côté serveur')
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error)
  }

  return (
    <TooltipProvider>
      <RealtimeProvider initialEmails={emails}>
        <div className="min-h-screen bg-background">
          {/* Navigation fixe */}
          <div className="sticky top-0 z-50">
            <NavigationBar user={userInfo} />
          </div>
          
          {/* Contenu des pages */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </RealtimeProvider>
    </TooltipProvider>
  )
}