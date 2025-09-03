'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Mail, CheckCircle, XCircle, Loader2, RefreshCw, Unlink } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

interface MicrosoftProfile {
  email: string
  display_name: string
  job_title?: string
  office_location?: string
}

export function MicrosoftConnectCard() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<MicrosoftProfile | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    checkMicrosoftConnection()
    
    // Check for callback parameters
    const microsoft = searchParams.get('microsoft')
    const error = searchParams.get('error')
    
    if (microsoft === 'connected') {
      // Refresh user session after OAuth
      const refreshSession = async () => {
        await supabase.auth.refreshSession()
        await checkMicrosoftConnection()
        // Clean URL
        router.replace('/dashboard')
      }
      refreshSession()
    }
    
    if (error) {
      console.error('Microsoft auth error:', error)
      setIsConnecting(false)
      // Clean URL
      router.replace('/dashboard')
    }
  }, [searchParams])

  const checkMicrosoftConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata?.microsoft_tokens) {
        setIsConnected(true)
        setProfile(user.user_metadata.microsoft_profile || null)
        
        // Check if token is expired
        const expiresAt = user.user_metadata.microsoft_tokens.expires_at
        if (expiresAt && Date.now() > expiresAt) {
          // Token expired, needs refresh (implement refresh logic)
          console.log('Microsoft token expired, needs refresh')
        }
      }
    } catch (error) {
      console.error('Error checking Microsoft connection:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const connectMicrosoft = () => {
    setIsConnecting(true)
    // Redirect to OAuth endpoint
    window.location.href = '/api/auth/microsoft'
  }

  const disconnectMicrosoft = async () => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.updateUser({
        data: {
          microsoft_tokens: null,
          microsoft_profile: null,
          microsoft_connected_at: null
        }
      })
      
      if (error) throw error
      
      setIsConnected(false)
      setProfile(null)
    } catch (error) {
      console.error('Error disconnecting Microsoft:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Microsoft 365 / Outlook
        </h3>
        {isConnected && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            Connecté
          </span>
        )}
      </div>

      {!isConnected ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Connectez votre compte Microsoft pour tracker vos emails professionnels
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800 font-medium mb-2">Permissions requises :</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Lecture de vos emails</li>
              <li>• Envoi d'emails en votre nom</li>
              <li>• Accès à votre profil</li>
            </ul>
          </div>

          <button
            onClick={connectMicrosoft}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connexion en cours...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 23 23" fill="none">
                  <path d="M11 0H0V11H11V0Z" fill="#F25022"/>
                  <path d="M23 0H12V11H23V0Z" fill="#7FBA00"/>
                  <path d="M11 12H0V23H11V12Z" fill="#00A4EF"/>
                  <path d="M23 12H12V23H23V12Z" fill="#FFB900"/>
                </svg>
                Connecter Microsoft
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {profile && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">
                    {profile.display_name?.charAt(0) || profile.email?.charAt(0) || 'M'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{profile.display_name}</p>
                  <p className="text-xs text-gray-600">{profile.email}</p>
                </div>
              </div>
              {(profile.job_title || profile.office_location) && (
                <div className="text-xs text-gray-500 pl-12">
                  {profile.job_title && <p>{profile.job_title}</p>}
                  {profile.office_location && <p>{profile.office_location}</p>}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => window.location.href = '/api/auth/microsoft'}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Reconnecter
            </button>
            
            <button
              onClick={disconnectMicrosoft}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm"
            >
              <Unlink className="w-4 h-4" />
              Déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}