import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { NavigationBar } from "@/components/navigation-bar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default async function ProfilePage() {
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

  const getInitials = (email?: string, name?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return "U"
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar user={userInfo} />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profil Utilisateur
            </CardTitle>
            <CardDescription>
              Informations de votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4 py-8">
              <Avatar className="h-24 w-24">
                <AvatarImage 
                  src={userInfo?.image} 
                  alt={userInfo?.name || userInfo?.email} 
                />
                <AvatarFallback className="text-2xl bg-primary/10">
                  {getInitials(userInfo?.email, userInfo?.name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="text-center space-y-1">
                {userInfo?.name && (
                  <h2 className="text-2xl font-bold">{userInfo.name}</h2>
                )}
                <p className="text-muted-foreground">{userInfo?.email}</p>
              </div>

              <div className="grid gap-4 mt-8 w-full max-w-sm">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">ID Utilisateur</p>
                  <p className="font-mono text-xs mt-1">{user.id}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Créé le</p>
                  <p className="text-sm mt-1">
                    {new Date(user.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Dernière connexion</p>
                  <p className="text-sm mt-1">
                    {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}