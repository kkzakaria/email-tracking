import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Obtenir la session utilisateur côté serveur
 */
export async function getServerSession() {
  const cookieStore = await cookies()
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // La méthode setAll peut être appelée dans un contexte middleware
            // où les mutations ne sont pas autorisées.
          }
        },
      },
    }
  )

  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  } catch (error) {
    console.error('Erreur lors de la récupération de la session:', error)
    return null
  }
}

/**
 * Vérifier si l'utilisateur est authentifié côté serveur
 */
export async function requireAuth() {
  const session = await getServerSession()
  
  if (!session?.user) {
    throw new Error('Non authentifié')
  }
  
  return session
}

/**
 * Valider un token d'authentification système (pour les cron jobs, webhooks, etc.)
 */
export function validateSystemToken(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader) return false
  
  const token = authHeader.replace('Bearer ', '')
  return token === expectedSecret
}

/**
 * Obtenir l'utilisateur depuis les en-têtes d'authentification
 */
export async function getUserFromAuth(authHeader: string | null) {
  if (!authHeader) return null
  
  const token = authHeader.replace('Bearer ', '')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return null
    }
    
    return user
  } catch (error) {
    console.error('Erreur lors de la validation du token:', error)
    return null
  }
}