'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Download, CheckCircle, AlertCircle, Info, Clock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SyncResult {
  sentEmails: number
  receivedEmails: number
  trackedEmails: number
  repliesDetected: number
  errors: string[]
}

interface SyncResponse {
  success: boolean
  timestamp: string
  result?: SyncResult
  error?: string
}

export function EmailHistorySync() {
  const [isLoading, setIsLoading] = useState(false)
  const [lastSync, setLastSync] = useState<SyncResponse | null>(null)
  const supabase = createClient()

  const handleSync = async () => {
    setIsLoading(true)
    
    try {
      // Appel de la fonction Edge email-history-sync
      const { data, error } = await supabase.functions.invoke('email-history-sync', {
        method: 'POST'
      })

      if (error) {
        // Si erreur de réseau/authentification
        console.error('Supabase function invoke error:', error)
        throw new Error(`Erreur d'appel de fonction: ${error.message}`)
      }

      // Si la fonction répond mais avec une erreur métier
      if (data && !data.success && data.error) {
        console.error('Function business logic error:', data.error)
        setLastSync({
          success: false,
          timestamp: data.timestamp || new Date().toISOString(),
          error: data.error
        })
        return
      }

      // Succès
      setLastSync(data)
      console.log('Email history sync completed:', data)
      
    } catch (error) {
      console.error('Email sync failed:', error)
      setLastSync({
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Synchronisation Historique
        </CardTitle>
        <CardDescription>
          Récupère et traite les emails des 7 derniers jours depuis Microsoft Graph
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bouton de synchronisation */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <Button
            onClick={handleSync}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Synchronisation...' : 'Synchroniser 7 derniers jours'}
          </Button>
          
          {lastSync && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Dernière sync: {new Date(lastSync.timestamp).toLocaleString('fr-FR')}
              </span>
            </div>
          )}
        </div>

        {/* Résultats de la dernière synchronisation */}
        {lastSync && (
          <div className="space-y-3">
            {lastSync.success ? (
              <>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Synchronisation réussie ! Les données ont été mises à jour.
                  </AlertDescription>
                </Alert>
                
                {lastSync.result && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {lastSync.result.sentEmails}
                      </div>
                      <div className="text-sm text-blue-800 dark:text-blue-300">
                        Emails envoyés
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {lastSync.result.receivedEmails}
                      </div>
                      <div className="text-sm text-green-800 dark:text-green-300">
                        Emails reçus
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {lastSync.result.trackedEmails}
                      </div>
                      <div className="text-sm text-purple-800 dark:text-purple-300">
                        Emails trackés
                      </div>
                    </div>
                    
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {lastSync.result.repliesDetected}
                      </div>
                      <div className="text-sm text-orange-800 dark:text-orange-300">
                        Réponses détectées
                      </div>
                    </div>
                  </div>
                )}
                
                {lastSync.result?.errors && lastSync.result.errors.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium mb-2">Avertissements:</div>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {lastSync.result.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant={lastSync.error?.includes('access token not found') ? "default" : "destructive"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium">
                    {lastSync.error?.includes('access token not found') 
                      ? 'Configuration requise' 
                      : 'Échec de la synchronisation'}
                  </div>
                  {lastSync.error && (
                    <div className="text-sm mt-1">
                      {lastSync.error?.includes('access token not found') 
                        ? 'Pour utiliser cette fonctionnalité, configurez d\'abord l\'authentification Microsoft Graph dans la section ci-dessus.'
                        : lastSync.error}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Informations sur la fonctionnalité */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <div className="font-medium mb-2">Comment ça fonctionne :</div>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Récupère les emails envoyés et reçus des 7 derniers jours</li>
                <li>Les emails envoyés sont automatiquement ajoutés au tracking</li>
                <li>Les réponses sont détectées par conversation_id</li>
                <li>Les données sont traitées en temps réel par les triggers PostgreSQL</li>
              </ul>
              <div className="mt-3 text-xs">
                <Badge variant="secondary">
                  💡 Recommandé: Synchroniser une fois par semaine pour récupérer les emails manqués
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}