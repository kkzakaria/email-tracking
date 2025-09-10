'use client'

// ====================================================================================================
// COMPOSANT: Microsoft OAuth Integration
// ====================================================================================================
// Description: Interface utilisateur pour l'authentification OAuth2 Microsoft Graph
// Features: Connexion, déconnexion, statut temps réel, chiffrement E2E des tokens
// ====================================================================================================

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/utils/supabase/client'
import { encryptTokens, decryptTokens, areTokensExpired, shouldRefreshTokens, getTimeToExpiry, type TokenResponse, type MicrosoftTokens } from '@/lib/crypto-utils'
import { Loader2, CheckCircle, AlertCircle, ExternalLink, RefreshCw, LogOut } from 'lucide-react'
import { toast } from 'sonner'

// ====================================================================================================
// TYPES ET INTERFACES
// ====================================================================================================

interface MicrosoftAuthStatus {
  authenticated: boolean
  microsoft: boolean
  user?: {
    id: string
    email: string
  }
  tokens?: {
    expiresAt: string
    isExpired: boolean
    scope: string
    connectedAt: string
    lastRefreshed?: string
  }
  message: string
}

interface OAuthAuthResponse {
  authUrl: string
  state: string
  codeVerifier: string
  expiresIn: number
}

// TokenResponse et MicrosoftTokens sont maintenant importés depuis crypto-utils.ts

// ====================================================================================================
// COMPOSANT PRINCIPAL
// ====================================================================================================

export default function MicrosoftOAuth() {
  const [status, setStatus] = useState<MicrosoftAuthStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [timeToExpiry, setTimeToExpiry] = useState<number | null>(null)

  const supabase = createClient()

  // ====================================================================================================
  // RÉCUPÉRATION DU STATUT
  // ====================================================================================================

  const fetchStatus = async () => {
    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setStatus({
          authenticated: false,
          microsoft: false,
          message: 'Non authentifié Supabase'
        })
        return
      }

      const response = await supabase.functions.invoke('microsoft-auth', {
        method: 'GET'
        // Note: supabase.functions.invoke() gère automatiquement l'authentification
      })

      if (response.error) {
        throw new Error(response.error.message || 'Erreur vérification statut')
      }

      setStatus(response.data)

      // Démarrer le timer d'expiration si connecté
      if (response.data.microsoft && response.data.tokens && !response.data.tokens.isExpired) {
        setTimeToExpiry(getTimeToExpiry(response.data.tokens.expiresAt))
        
        // Note: Le refresh automatique est maintenant géré par le cron job PostgreSQL
        // Pas besoin de logique frontend pour le refresh automatique
      }

    } catch (error) {
      console.error('Erreur récupération statut:', error)
      toast.error('Erreur de connexion au service Microsoft')
      setStatus({
        authenticated: true,
        microsoft: false,
        message: 'Erreur vérification statut'
      })
    } finally {
      setLoading(false)
    }
  }

  // ====================================================================================================
  // CONNEXION OAUTH2 MICROSOFT
  // ====================================================================================================

  const handleConnect = async () => {
    try {
      setConnecting(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Vous devez être connecté à Supabase')
        return
      }

      // Étape 1: Obtenir l'URL d'autorisation
      const authResponse = await supabase.functions.invoke('microsoft-auth?action=authorize', {
        method: 'GET'
        // Note: supabase.functions.invoke() gère automatiquement l'authentification
      })

      if (authResponse.error) {
        throw new Error(authResponse.error.message || 'Erreur génération URL OAuth')
      }

      const authData: OAuthAuthResponse = authResponse.data

      // Étape 2: Ouvrir la popup OAuth Microsoft
      const popup = window.open(
        authData.authUrl,
        'microsoft-oauth',
        'width=500,height=700,scrollbars=yes,resizable=yes'
      )

      if (!popup) {
        toast.error('Impossible d\'ouvrir la popup. Vérifiez le bloqueur de popup.')
        return
      }

      // Étape 3: Écouter le callback de la popup
      const handleCallback = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data.type === 'MICROSOFT_OAUTH_SUCCESS') {
          window.removeEventListener('message', handleCallback)
          popup.close()

          try {
            // Étape 4: Échanger le code contre des tokens
            // Note: Le callback n'a pas besoin d'authentification car il échange juste le code
            const callbackResponse = await supabase.functions.invoke('microsoft-auth', {
              method: 'POST',
              body: {
                action: 'callback',
                code: event.data.code,
                codeVerifier: authData.codeVerifier
              }
            })

            if (callbackResponse.error) {
              throw new Error(callbackResponse.error.message || 'Erreur échange tokens')
            }

            console.log('Callback response complète:', callbackResponse)
            console.log('Callback response.data:', callbackResponse.data)
            
            const tokenData = callbackResponse.data as TokenResponse
            
            // Vérifier la structure de la réponse
            if (!tokenData || !tokenData.tokens) {
              console.error('Structure invalide. tokenData:', tokenData)
              throw new Error('Structure de réponse invalide: tokens manquants')
            }

            console.log('✅ Tokens reçus avec succès:', {
              hasAccessToken: !!tokenData.tokens.accessToken,
              hasRefreshToken: !!tokenData.tokens.refreshToken,
              expiresAt: tokenData.tokens.expiresAt,
              scope: tokenData.tokens.scope
            })

            // Étape 5: Chiffrer les tokens côté client
            console.log('🔐 Chiffrement des tokens côté client...')
            
            // Récupérer l'utilisateur actuel pour le chiffrement
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
              throw new Error('Utilisateur non authentifié pour le chiffrement')
            }
            
            // Générer un salt déterministe basé sur l'ID utilisateur (compatible avec les Edge Functions)
            const serverSalt = `${user.id}-encryption-salt-2024`
            
            const encryptionResult = await encryptTokens({
              accessToken: tokenData.tokens.accessToken,
              refreshToken: tokenData.tokens.refreshToken,
              expiresAt: tokenData.tokens.expiresAt,
              scope: tokenData.tokens.scope
            }, user.id, serverSalt)
            
            console.log('✅ Tokens chiffrés avec succès')
            
            const tokensToStore = {
              accessTokenEncrypted: encryptionResult.accessTokenEncrypted,
              refreshTokenEncrypted: encryptionResult.refreshTokenEncrypted,
              nonce: encryptionResult.nonce,
              expiresAt: tokenData.tokens.expiresAt,
              scope: tokenData.tokens.scope
            }

            // Étape 6: Stocker les tokens chiffrés
            console.log('📤 Envoi des tokens chiffrés pour stockage...')
            console.log('Tokens to send (chiffrés):', {
              hasAccessToken: !!tokensToStore.accessTokenEncrypted,
              hasRefreshToken: !!tokensToStore.refreshTokenEncrypted,
              nonce: tokensToStore.nonce.substring(0, 10) + '...',
              expiresAt: tokensToStore.expiresAt
            })
            
            // Utiliser supabase.functions.invoke() pour une authentification cohérente
            const storeResponse = await supabase.functions.invoke('microsoft-auth', {
              method: 'POST',
              body: {
                action: 'store',
                ...tokensToStore
              }
            })
            
            const storeData = storeResponse.data
            console.log('Store raw response:', storeData)
            
            const storeResult = {
              data: storeData,
              error: storeResponse.error
            }

            console.log('Store response:', storeResult)

            if (storeResult.error) {
              console.error('Erreur stockage:', storeResult.error)
              throw new Error(storeResult.error.message || 'Erreur stockage tokens')
            }

            console.log('✅ Tokens stockés avec succès')

            // Étape 7: La subscription est créée automatiquement par microsoft-auth
            if (storeResult.data?.subscriptionCreated) {
              console.log('✅ Subscription Microsoft Graph créée automatiquement')
              toast.info('Subscription Microsoft Graph activée pour recevoir les emails')
            } else {
              console.log('⚠️ Subscription non créée automatiquement - vérifiez les logs')
              toast.warning('Connexion réussie - vérifiez le statut de la subscription dans les paramètres')
            }

            toast.success('Connexion Microsoft réussie !')
            await fetchStatus()

          } catch (error) {
            console.error('Erreur traitement callback:', error)
            toast.error('Erreur lors de la connexion Microsoft')
          }
        } else if (event.data.type === 'MICROSOFT_OAUTH_ERROR') {
          window.removeEventListener('message', handleCallback)
          popup.close()
          toast.error(event.data.message || 'Erreur OAuth Microsoft')
        }
      }

      window.addEventListener('message', handleCallback)

      // Vérifier si la popup a été fermée manuellement
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleCallback)
          setConnecting(false)
        }
      }, 1000)

    } catch (error) {
      console.error('Erreur connexion Microsoft:', error)
      toast.error('Erreur lors de la connexion Microsoft')
    } finally {
      setConnecting(false)
    }
  }

  // ====================================================================================================
  // RENOUVELLEMENT DES TOKENS
  // ====================================================================================================

  const handleRefresh = async () => {
    try {
      setRefreshing(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Session Supabase expirée')
        return
      }

      // Appeler l'Edge Function microsoft-auth avec action refresh
      toast.info('Renouvellement des tokens en cours...')
      
      const { data, error } = await supabase.functions.invoke('microsoft-auth', {
        body: { action: 'refresh' }
        // Note: supabase.functions.invoke() gère automatiquement l'authentification
        // avec le token de session actuel
      })
      
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erreur de renouvellement')
      }
      
      // Recharger le statut pour voir les nouveaux tokens
      await fetchStatus()
      toast.success('Tokens renouvelés avec succès')

    } catch (error) {
      console.error('Erreur renouvellement:', error)
      toast.error('Erreur lors du renouvellement')
    } finally {
      setRefreshing(false)
    }
  }

  // ====================================================================================================
  // DÉCONNEXION
  // ====================================================================================================

  const handleDisconnect = async () => {
    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Session Supabase expirée')
        return
      }

      const response = await supabase.functions.invoke('microsoft-auth', {
        method: 'POST',
        body: {
          action: 'revoke'
        }
        // Note: supabase.functions.invoke() gère automatiquement l'authentification
      })

      if (response.error) {
        throw new Error(response.error.message || 'Erreur déconnexion')
      }

      toast.success('Déconnexion Microsoft réussie')
      await fetchStatus()

    } catch (error) {
      console.error('Erreur déconnexion:', error)
      toast.error('Erreur lors de la déconnexion')
    } finally {
      setLoading(false)
    }
  }

  // ====================================================================================================
  // EFFECTS ET LIFECYCLE
  // ====================================================================================================

  // Charger le statut au montage
  useEffect(() => {
    fetchStatus()
  }, [])

  // Timer pour l'expiration des tokens
  useEffect(() => {
    if (timeToExpiry && timeToExpiry > 0) {
      const timer = setInterval(() => {
        setTimeToExpiry(prev => {
          if (!prev || prev <= 0) {
            clearInterval(timer)
            fetchStatus() // Recharger le statut quand expiré
            return null
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [timeToExpiry])

  // ====================================================================================================
  // UTILITAIRES D'AFFICHAGE
  // ====================================================================================================

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const getStatusBadge = () => {
    if (loading) return <Badge variant="secondary">Vérification...</Badge>
    if (!status?.authenticated) return <Badge variant="destructive">Non connecté</Badge>
    if (!status.microsoft) return <Badge variant="secondary">Microsoft déconnecté</Badge>
    if (status.tokens?.isExpired) return <Badge variant="destructive">Tokens expirés</Badge>
    return <Badge variant="default" className="bg-green-500">Connecté Microsoft</Badge>
  }

  // ====================================================================================================
  // RENDER
  // ====================================================================================================

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Vérification du statut Microsoft...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Connexion Microsoft Graph
            </CardTitle>
            <CardDescription>
              Authentifiez-vous avec Microsoft pour créer des subscriptions d'emails
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informations utilisateur */}
        {status?.user && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Connecté en tant que {status.user.email}
          </div>
        )}

        {/* Informations des tokens Microsoft */}
        {status?.microsoft && status.tokens && (
          <div className="space-y-2 text-sm">
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Permissions:</span>
                <p className="text-muted-foreground">{status.tokens.scope}</p>
              </div>
              <div>
                <span className="font-medium">Connecté le:</span>
                <p className="text-muted-foreground">
                  {new Date(status.tokens.connectedAt).toLocaleString('fr-FR')}
                </p>
              </div>
            </div>

            {/* Timer d'expiration */}
            {timeToExpiry && timeToExpiry > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className={`h-4 w-4 ${shouldRefreshTokens(status.tokens.expiresAt) ? 'text-orange-500' : 'text-blue-500'}`} />
                <span className="text-sm">
                  Expire dans {formatTime(timeToExpiry)}
                  {shouldRefreshTokens(status.tokens.expiresAt) && 
                    <span className="text-orange-500 ml-1">(renouvellement recommandé)</span>
                  }
                </span>
              </div>
            )}
          </div>
        )}

        {/* Information sur le refresh automatique */}
        {status?.microsoft && status.tokens && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Refresh automatique activé
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Les tokens sont automatiquement renouvelés toutes les 30 minutes par le serveur. 
                  Utilisez le bouton "Actualiser" uniquement si vous souhaitez forcer une mise à jour immédiate.
                </p>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {!status?.microsoft ? (
            <Button 
              onClick={handleConnect} 
              disabled={connecting || !status?.authenticated}
              className="w-full"
            >
              {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter à Microsoft
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex-1"
              >
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Actualiser
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={loading}
                className="flex-1"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </Button>
            </div>
          )}

          {!status?.authenticated && (
            <p className="text-sm text-muted-foreground text-center">
              Vous devez être connecté à Supabase pour utiliser Microsoft Graph
            </p>
          )}
        </div>

        {/* Message de statut */}
        {status?.message && (
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
            {status.message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}