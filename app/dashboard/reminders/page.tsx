'use client'

import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ReminderTestInterface } from "@/components/dashboard/reminder-test-interface"
import { ReminderStats } from "@/components/dashboard/reminder-stats"
import { ReminderQueue } from "@/components/dashboard/reminder-queue"

export default function RemindersTestPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header avec warning mode test */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Système de relances
            </h1>
            <p className="text-gray-600 mt-1">
              Test et configuration des relances automatiques
            </p>
          </div>
          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
            🧪 Mode Test
          </Badge>
        </div>
      </div>

      {/* Warning Card */}
      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                Mode test activé - Aucun impact sur la production
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Tables séparées avec préfixe <code>test_</code></li>
                  <li>Jobs cron désactivés par défaut</li>
                  <li>Mode <code>dry_run</code> disponible pour simulation</li>
                  <li>Emails spécifiques sélectionnables pour test</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale - Interface de test */}
        <div className="lg:col-span-2 space-y-6">
          {/* Interface de test principale */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>🧪</span>
                <span>Interface de test</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Chargement...</div>}>
                <ReminderTestInterface />
              </Suspense>
            </CardContent>
          </Card>

          {/* Queue des relances planifiées */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>📋</span>
                <span>Relances planifiées</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Chargement...</div>}>
                <ReminderQueue />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Stats et monitoring */}
        <div className="space-y-6">
          {/* Statistiques */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>📊</span>
                <span>Statistiques</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Chargement...</div>}>
                <ReminderStats />
              </Suspense>
            </CardContent>
          </Card>

          {/* Actions rapides */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>⚡</span>
                <span>Actions rapides</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => window.location.reload()}
              >
                🔄 Actualiser les données
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => {
                  // TODO: Implémenter navigation vers la config
                  alert('Configuration des templates - À implémenter')
                }}
              >
                ⚙️ Configurer templates
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => {
                  // TODO: Implémenter navigation vers les logs
                  alert('Logs détaillés - À implémenter')
                }}
              >
                📝 Voir les logs détaillés
              </Button>
            </CardContent>
          </Card>

          {/* Informations système */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>🔧</span>
                <span>Système</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-gray-600 space-y-2">
                <div className="flex justify-between">
                  <span>Edge Function:</span>
                  <Badge variant="outline" className="text-xs">reminder-manager</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Jobs cron:</span>
                  <Badge variant="secondary" className="text-xs">Désactivés</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Mode:</span>
                  <Badge variant="outline" className="text-xs bg-yellow-50">Test</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}