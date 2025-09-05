'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function signInWithMicrosoft() {
  const supabase = await createClient()

  // Déterminer l'URL de redirection selon l'environnement
  const getRedirectUrl = () => {
    // En production Vercel
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}/api/auth/microsoft/callback`
    }
    
    // URL configurée manuellement
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`
    }
    
    // Fallback pour développement local
    return 'http://localhost:3000/api/auth/microsoft/callback'
  }

  const redirectUrl = getRedirectUrl()
  console.log('🔗 Microsoft OAuth redirect URL:', redirectUrl)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'openid profile email https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite',
      redirectTo: redirectUrl,
    },
  })

  if (error) {
    console.error('Microsoft OAuth error:', error)
    redirect('/error?message=' + encodeURIComponent(error.message))
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    redirect('/error?message=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}