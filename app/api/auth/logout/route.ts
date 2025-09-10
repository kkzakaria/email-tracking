import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  // Déconnecter l'utilisateur
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error("Erreur lors de la déconnexion:", error)
  }
  
  // Rediriger vers la page de connexion
  redirect("/login")
}

export async function GET() {
  // Pour éviter les erreurs si quelqu'un essaie d'accéder directement
  redirect("/dashboard")
}