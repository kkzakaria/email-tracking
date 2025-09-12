'use client'

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/utils/supabase/client"

export default function ReminderTestSimplePage() {
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testReminderManager = async () => {
    setLoading(true)
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase.functions.invoke('reminder-manager', {
        body: { action: 'status' }
      })
      
      if (error) {
        setResponse({ error: error.message })
      } else {
        setResponse(data)
      }
    } catch (err) {
      setResponse({ error: err instanceof Error ? err.message : 'Erreur inconnue' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Test du système de relances</h1>
        <Badge variant="outline" className="mt-2">Mode Test Simplifié</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test de l'Edge Function reminder-manager</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={testReminderManager}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Test en cours...' : 'Tester reminder-manager'}
            </Button>

            {response && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Réponse</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>Instructions :</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Cliquez sur le bouton pour tester l'Edge Function</li>
                <li>Vérifiez que la réponse contient les informations attendues</li>
                <li>En cas d'erreur d'authentification, connectez-vous d'abord</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}