'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { CheckCircle, Loader2, RefreshCw, Unlink, User } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useWebhookStatus } from '@/contexts/webhook-status-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MicrosoftProfile {
  email: string
  display_name: string
  job_title?: string
  office_location?: string
}

// Logo Microsoft - gris si déconnecté, coloré si connecté
const MicrosoftIcon = ({ isConnected }: { isConnected: boolean }) => (
  <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none">
    {isConnected ? (
      <>
        <path d="M11 0H0V11H11V0Z" fill="#F25022"/>
        <path d="M23 0H12V11H23V0Z" fill="#7FBA00"/>
        <path d="M11 12H0V23H11V12Z" fill="#00A4EF"/>
        <path d="M23 12H12V23H23V12Z" fill="#FFB900"/>
      </>
    ) : (
      <>
        <path d="M11 0H0V11H11V0Z" fill="#9CA3AF"/>
        <path d="M23 0H12V11H23V0Z" fill="#9CA3AF"/>
        <path d="M11 12H0V23H11V12Z" fill="#9CA3AF"/>
        <path d="M23 12H12V23H23V12Z" fill="#9CA3AF"/>
      </>
    )}
  </svg>
)

export function MicrosoftConnectButton() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<MicrosoftProfile | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { refreshStatus } = useWebhookStatus()

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
        
        // Rafraîchir le statut webhook pour déclencher la souscription automatique
        setTimeout(() => {
          console.log('🔄 Rafraîchissement du statut après connexion Microsoft...')
          refreshStatus()
        }, 1000)
        
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
      <Button variant="outline" size="icon" disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className={`relative ${isConnected ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-gray-300'}`}
        >
          <MicrosoftIcon isConnected={isConnected} />
          {isConnected && (
            <CheckCircle className="absolute -top-1 -right-1 w-3 h-3 text-green-600 bg-white dark:bg-gray-800 rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64">
        {!isConnected ? (
          <>
            <DropdownMenuItem asChild>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <MicrosoftIcon isConnected={false} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Microsoft 365</span>
                  <span className="text-xs text-gray-500">Non connecté</span>
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={connectMicrosoft} disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <MicrosoftIcon isConnected={true} />
                  <span className="ml-2">Connecter Microsoft</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <div className="px-2 py-1.5">
                <p className="text-xs text-gray-600 leading-tight">
                  Connectez votre compte Microsoft pour tracker vos emails professionnels
                </p>
              </div>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    {profile?.display_name ? (
                      <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                        {profile.display_name.charAt(0)}
                      </span>
                    ) : (
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {profile?.display_name || 'Microsoft 365'}
                    </span>
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Connecté
                    </span>
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
            
            {profile?.email && (
              <DropdownMenuItem asChild>
                <div className="px-2 py-1.5">
                  <span className="text-xs text-gray-600">{profile.email}</span>
                </div>
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={() => window.location.href = '/api/auth/microsoft'}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reconnecter
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={disconnectMicrosoft}
              className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300"
            >
              <Unlink className="w-4 h-4 mr-2" />
              Déconnecter
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}