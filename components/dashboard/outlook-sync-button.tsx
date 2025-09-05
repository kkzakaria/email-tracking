'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export function OutlookSyncButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleSync = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      console.log('🔄 Démarrage de la synchronisation Outlook...')

      const response = await fetch('/api/emails/sync', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur de synchronisation')
      }

      console.log('✅ Synchronisation réussie:', result)

      const newCount = result.data?.newTrackedEmails || 0
      const updatedCount = result.data?.updatedTrackedEmails || 0
      const skippedCount = result.data?.skippedRepliedEmails || 0
      
      let messageText = ''
      if (newCount > 0 && updatedCount > 0) {
        messageText = `${newCount} nouveaux emails trackés, ${updatedCount} mis à jour !`
      } else if (newCount > 0) {
        messageText = `${newCount} nouveaux emails trackés !`
      } else if (updatedCount > 0) {
        messageText = `${updatedCount} emails mis à jour (ont reçu des réponses) !`
      } else {
        messageText = 'Aucun changement à synchroniser'
      }
      
      if (skippedCount > 0) {
        messageText += ` (${skippedCount} emails avec réponses ignorés)`
      }
      
      setMessage({
        type: 'success',
        text: messageText
      })

      // Rafraîchir la page après 2 secondes pour voir les changements
      if (newCount > 0 || updatedCount > 0) {
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }

    } catch (error) {
      console.error('❌ Erreur de synchronisation:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erreur de synchronisation'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleSync}
            disabled={isLoading}
            variant="default"
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-600/20 text-white"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Synchronisation...' : 'Sync Outlook'}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-center">
            Synchronise automatiquement vos emails Outlook
            <br />
            <span className="text-xs opacity-90">
              Seuls les emails sans réponse sont trackés
            </span>
          </p>
        </TooltipContent>
      </Tooltip>

      {message && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message.text}
        </div>
      )}

    </div>
  )
}