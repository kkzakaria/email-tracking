'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

interface TrackedEmail {
  id: string
  subject: string
  recipient_email: string
  sent_at: string
  status: string
  days_elapsed?: number
}

interface ReminderAction {
  action: 'check' | 'send' | 'status' | 'test_working_hours' | 'schedule_test'
  test_email_ids?: string[]
  dry_run?: boolean
}

export function ReminderTestInterface() {
  const [emails, setEmails] = useState<TrackedEmail[]>([])
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [dryRun, setDryRun] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [workingHours, setWorkingHours] = useState<any>(null)

  const supabase = createClient()

  // Charger les emails PENDING pour test
  useEffect(() => {
    loadPendingEmails()
  }, [])

  const loadPendingEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('status', 'PENDING')
        .order('sent_at', { ascending: false })
        .limit(10)

      if (error) throw error

      // Calculer days_elapsed côté client
      const emailsWithDays = data?.map(email => ({
        ...email,
        days_elapsed: Math.floor((Date.now() - new Date(email.sent_at).getTime()) / (1000 * 60 * 60 * 24))
      })) || []

      setEmails(emailsWithDays)
    } catch (error) {
      console.error('Erreur chargement emails:', error)
      toast.error('Erreur lors du chargement des emails')
    }
  }

  const executeReminderAction = async (action: ReminderAction) => {
    setLoading(true)
    setResult(null)

    try {
      console.log('🧪 Exécution action reminder:', action)

      const { data, error } = await supabase.functions.invoke('reminder-manager', {
        body: {
          action: action.action,
          test_email_ids: action.test_email_ids || [],
          dry_run: action.dry_run ?? dryRun,
          timestamp: new Date().toISOString()
        }
      })

      if (error) {
        throw new Error(`Erreur Edge Function: ${error.message}`)
      }

      console.log('✅ Résultat:', data)
      setResult(data)
      
      toast.success(`Action ${action.action} exécutée avec succès`)

      // Recharger les emails après certaines actions
      if (action.action === 'check' || action.action === 'schedule_test') {
        await loadPendingEmails()
      }

    } catch (error) {
      console.error('❌ Erreur action reminder:', error)
      toast.error(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
      setResult({ 
        error: true, 
        message: error instanceof Error ? error.message : 'Erreur inconnue' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSelection = (emailId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmails([...selectedEmails, emailId])
    } else {
      setSelectedEmails(selectedEmails.filter(id => id !== emailId))
    }
  }

  const selectAll = () => {
    setSelectedEmails(emails.map(e => e.id))
  }

  const clearSelection = () => {
    setSelectedEmails([])
  }

  const testWorkingHours = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('reminder-manager', {
        body: { action: 'test_working_hours' }
      })

      if (error) throw error

      setWorkingHours(data)
      toast.success('Test des heures de travail réussi')
    } catch (error) {
      console.error('❌ Erreur test heures:', error)
      toast.error('Erreur test des heures de travail')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Configuration globale */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mode d'exécution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
              />
              <Label htmlFor="dry-run" className="text-sm">
                Mode simulation {dryRun ? '(Dry Run)' : '(Envoi réel)'}
              </Label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {dryRun 
                ? 'Aucun email ne sera envoyé, simulation uniquement' 
                : '⚠️ Les emails seront réellement envoyés !'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Heures de travail</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={testWorkingHours}
              disabled={loading}
              size="sm"
              variant="outline"
              className="w-full"
            >
              🕐 Tester maintenant
            </Button>
            {workingHours && (
              <div className="mt-2 text-xs">
                <Badge variant={workingHours.working_hours ? "default" : "secondary"}>
                  {workingHours.working_hours ? '✅ En heures de travail' : '🚫 Hors heures de travail'}
                </Badge>
                <p className="text-gray-500 mt-1">
                  {workingHours.current_time} - {workingHours.current_day}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sélection d'emails */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Emails pour test ({emails.length} disponibles)</CardTitle>
            <div className="space-x-2">
              <Button onClick={selectAll} size="sm" variant="outline">
                Tout sélectionner
              </Button>
              <Button onClick={clearSelection} size="sm" variant="outline">
                Désélectionner
              </Button>
              <Button onClick={loadPendingEmails} size="sm" variant="outline">
                🔄 Actualiser
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            {selectedEmails.length} email(s) sélectionné(s)
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {emails.map((email) => (
              <div 
                key={email.id} 
                className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
              >
                <Checkbox
                  checked={selectedEmails.includes(email.id)}
                  onCheckedChange={(checked) => handleEmailSelection(email.id, checked as boolean)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {email.subject}
                  </p>
                  <p className="text-xs text-gray-500">
                    📧 {email.recipient_email}
                  </p>
                  <p className="text-xs text-gray-400">
                    📅 Envoyé il y a {email.days_elapsed} jour(s) • {new Date(email.sent_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {email.status}
                </Badge>
              </div>
            ))}

            {emails.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>Aucun email en attente de réponse</p>
                <Button onClick={loadPendingEmails} size="sm" variant="outline" className="mt-2">
                  🔄 Actualiser
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions de test */}
      <Card>
        <CardHeader>
          <CardTitle>Actions de test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={() => executeReminderAction({ action: 'status' })}
              disabled={loading}
              variant="outline"
              className="justify-start"
            >
              📊 Statut général
            </Button>

            <Button
              onClick={() => executeReminderAction({ 
                action: 'check',
                test_email_ids: selectedEmails.length > 0 ? selectedEmails : undefined
              })}
              disabled={loading || (selectedEmails.length === 0 && emails.length > 0)}
              className="justify-start"
            >
              🔍 Vérifier relances
            </Button>

            <Button
              onClick={() => executeReminderAction({ 
                action: 'schedule_test',
                test_email_ids: selectedEmails
              })}
              disabled={loading || selectedEmails.length === 0}
              className="justify-start"
            >
              📅 Programmer test
            </Button>

            <Button
              onClick={() => executeReminderAction({ 
                action: 'send',
                test_email_ids: selectedEmails.length > 0 ? selectedEmails : undefined
              })}
              disabled={loading}
              variant={dryRun ? "default" : "destructive"}
              className="justify-start"
            >
              📤 Envoyer relances
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            💡 Sélectionnez des emails pour tester sur des emails spécifiques, 
            ou laissez vide pour traiter tous les emails candidats.
          </p>
        </CardContent>
      </Card>

      {/* Résultats */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>📋</span>
              <span>Résultats</span>
              {result.test_mode && (
                <Badge variant="outline" className="bg-yellow-50">Mode Test</Badge>
              )}
              {result.dry_run && (
                <Badge variant="outline" className="bg-blue-50">Dry Run</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Résumé */}
              {result.message && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium">{result.message}</p>
                  {result.candidates !== undefined && (
                    <p className="text-xs text-gray-600 mt-1">
                      {result.candidates} candidat(s) • {result.scheduled || 0} programmé(s) • {result.sent || 0} envoyé(s)
                    </p>
                  )}
                </div>
              )}

              {/* Détails */}
              {result.details && result.details.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Détails par email</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.details.map((detail: any, index: number) => (
                      <div key={index} className="p-2 border rounded text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{detail.subject}</p>
                            <p className="text-gray-500">{detail.recipient}</p>
                          </div>
                          <Badge 
                            variant={detail.status === 'scheduled' ? 'default' : 
                                   detail.status === 'sent' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {detail.status}
                          </Badge>
                        </div>
                        {detail.days_elapsed && (
                          <p className="text-gray-400 mt-1">
                            📅 {detail.days_elapsed} jour(s) • {detail.reminder_count || 0} relance(s)
                          </p>
                        )}
                        {detail.error && (
                          <p className="text-red-500 mt-1">{detail.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Erreur */}
              {result.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium">Erreur</p>
                  <p className="text-xs text-red-600 mt-1">{result.message}</p>
                </div>
              )}

              {/* JSON brut pour debugging */}
              <details className="mt-4">
                <summary className="text-xs text-gray-500 cursor-pointer">
                  Voir la réponse complète (debug)
                </summary>
                <Textarea
                  value={JSON.stringify(result, null, 2)}
                  readOnly
                  className="mt-2 text-xs font-mono"
                  rows={10}
                />
              </details>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}