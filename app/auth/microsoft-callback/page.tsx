'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function MicrosoftCallbackPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<string>('Traitement...')

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    if (error) {
      console.error('❌ Erreur OAuth:', error, searchParams.get('error_description'))
      setStatus(`Erreur: ${error}`)
      
      // Envoyer l'erreur à la fenêtre parent
      if (window.opener) {
        window.opener.postMessage({
          type: 'MICROSOFT_OAUTH_ERROR',
          error: error,
          message: searchParams.get('error_description') || error
        }, window.location.origin)
        window.close()
      }
      return
    }

    if (!code) {
      setStatus('Code d\'autorisation manquant')
      if (window.opener) {
        window.opener.postMessage({
          type: 'MICROSOFT_OAUTH_ERROR',
          message: 'Code d\'autorisation manquant'
        }, window.location.origin)
        window.close()
      }
      return
    }

    setStatus('Autorisation réussie, fermeture...')
    
    // Envoyer le code à la fenêtre parent
    if (window.opener) {
      window.opener.postMessage({
        type: 'MICROSOFT_OAUTH_SUCCESS',
        code: code,
        state: state
      }, window.location.origin)
      window.close()
    } else {
      setStatus('Impossible de communiquer avec la fenêtre parent')
    }

  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Authentification Microsoft
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {status}
          </p>
          {status.includes('Erreur') && (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Vous pouvez fermer cette fenêtre et réessayer.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}