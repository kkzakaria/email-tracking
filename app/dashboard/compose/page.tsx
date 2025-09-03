'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Send, Loader2, ArrowLeft, Eye, Link } from 'lucide-react'

interface EmailFormData {
  to: string
  subject: string
  htmlBody: string
  textBody: string
  expiresAt: string
}

export default function ComposePage() {
  const router = useRouter()
  const [formData, setFormData] = useState<EmailFormData>({
    to: '',
    subject: '',
    htmlBody: '',
    textBody: '',
    expiresAt: ''
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ trackingId: string; messageId: string } | null>(null)
  const [isPreview, setIsPreview] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Validation côté client
      if (!formData.to || !formData.subject) {
        throw new Error('Destinataire et sujet requis')
      }

      if (!formData.htmlBody && !formData.textBody) {
        throw new Error('Contenu HTML ou texte requis')
      }

      // Préparer les données à envoyer
      const payload: Record<string, string> = {
        to: formData.to,
        subject: formData.subject
      }

      if (formData.htmlBody.trim()) {
        payload.htmlBody = formData.htmlBody
      }

      if (formData.textBody.trim()) {
        payload.textBody = formData.textBody
      }

      if (formData.expiresAt) {
        payload.expiresAt = formData.expiresAt
      }

      console.log('📤 Envoi de l\'email:', payload)

      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'envoi')
      }

      console.log('✅ Email envoyé avec succès:', result)

      setSuccess({
        trackingId: result.trackingId,
        messageId: result.messageId
      })

      // Réinitialiser le formulaire après succès
      setFormData({
        to: '',
        subject: '',
        htmlBody: '',
        textBody: '',
        expiresAt: ''
      })

    } catch (err) {
      console.error('❌ Erreur envoi email:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof EmailFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (error) setError(null)
  }

  const generatePreview = () => {
    if (!formData.htmlBody) return formData.textBody

    // Simuler l'ajout du pixel de tracking pour l'aperçu
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const dummyTrackingId = 'preview-tracking-id'
    const trackingPixel = `<img src="${baseUrl}/api/emails/pixel/${dummyTrackingId}" width="1" height="1" alt="" style="display: none;" />`
    
    return formData.htmlBody + trackingPixel
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au dashboard
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Mail className="w-8 h-8" />
            Composer un email tracké
          </h1>
          <p className="text-gray-600 mt-2">
            Créez et envoyez des emails avec tracking automatique des ouvertures et clics
          </p>
        </div>

        {/* Messages d'état */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">❌ Erreur</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">✅ Email envoyé avec succès !</p>
            <div className="text-green-700 text-sm mt-2 space-y-1">
              <p><strong>ID de tracking:</strong> {success.trackingId}</p>
              <p><strong>ID du message:</strong> {success.messageId}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-green-600 underline hover:text-green-800"
              >
                Voir dans le dashboard
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulaire */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">Détails de l'email</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Destinataire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destinataire *
                </label>
                <input
                  type="email"
                  value={formData.to}
                  onChange={(e) => handleInputChange('to', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="exemple@domain.com"
                  required
                />
              </div>

              {/* Sujet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sujet *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Sujet de votre email"
                  required
                />
              </div>

              {/* Contenu HTML */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenu HTML *
                </label>
                <textarea
                  value={formData.htmlBody}
                  onChange={(e) => handleInputChange('htmlBody', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={10}
                  placeholder="<h1>Bonjour !</h1><p>Votre message ici avec des <a href='https://example.com'>liens</a>...</p>"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Les liens seront automatiquement trackés. Un pixel de tracking sera ajouté.
                </p>
              </div>

              {/* Contenu texte */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenu texte (fallback)
                </label>
                <textarea
                  value={formData.textBody}
                  onChange={(e) => handleInputChange('textBody', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={6}
                  placeholder="Version texte de votre email pour les clients qui ne supportent pas HTML"
                />
              </div>

              {/* Date d'expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration du tracking (optionnel)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => handleInputChange('expiresAt', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsPreview(!isPreview)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={!formData.htmlBody && !formData.textBody}
                >
                  <Eye className="w-4 h-4" />
                  {isPreview ? 'Masquer' : 'Aperçu'}
                </button>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Envoyer l'email tracké
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Aperçu */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Aperçu
            </h2>
            
            {isPreview && (formData.htmlBody || formData.textBody) ? (
              <div className="space-y-4">
                {/* En-têtes simulés */}
                <div className="border-b pb-4 space-y-2 text-sm">
                  <div><strong>De:</strong> Votre compte Microsoft</div>
                  <div><strong>À:</strong> {formData.to || 'destinataire@example.com'}</div>
                  <div><strong>Sujet:</strong> {formData.subject || 'Sujet de l\'email'}</div>
                </div>
                
                {/* Contenu */}
                <div className="border rounded p-4 bg-gray-50">
                  {formData.htmlBody ? (
                    <div 
                      dangerouslySetInnerHTML={{ __html: generatePreview() }}
                      className="prose prose-sm max-w-none"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm">
                      {formData.textBody}
                    </pre>
                  )}
                </div>
                
                {/* Info tracking */}
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="font-medium text-blue-800 flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    Éléments de tracking ajoutés:
                  </p>
                  <ul className="text-blue-700 mt-1 text-xs space-y-1">
                    <li>• Pixel de tracking 1x1 invisible</li>
                    {formData.htmlBody.includes('<a ') && <li>• Liens modifiés pour tracking des clics</li>}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-12">
                <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Ajoutez du contenu et cliquez sur "Aperçu" pour voir le rendu</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}