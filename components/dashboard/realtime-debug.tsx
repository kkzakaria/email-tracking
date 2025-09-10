"use client"

import { useRealtime } from "./realtime-provider"
import { Badge } from "@/components/ui/badge"
import { WifiIcon, WifiOffIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

export function RealtimeDebug() {
  const { isConnected, error, refreshData, emails } = useRealtime()
  const [lastUpdate, setLastUpdate] = useState<string>("")

  // Mettre à jour l'heure uniquement côté client pour éviter l'erreur d'hydratation
  useEffect(() => {
    setLastUpdate(new Date().toLocaleTimeString())
  }, [emails]) // Se met à jour quand les emails changent

  return (
    <div className="flex items-center gap-4 p-2 bg-muted/50 rounded-lg text-sm">
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <WifiIcon className="h-4 w-4 text-green-500" />
            <Badge variant="outline" className="text-green-600">
              Realtime connecté
            </Badge>
          </>
        ) : (
          <>
            <WifiOffIcon className="h-4 w-4 text-red-500" />
            <Badge variant="outline" className="text-red-600">
              Realtime déconnecté
            </Badge>
          </>
        )}
      </div>
      
      {error && (
        <Badge variant="destructive" className="text-xs">
          {error}
        </Badge>
      )}
      
      <div className="text-muted-foreground">
        {emails.length} emails chargés
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={refreshData}
        className="ml-auto"
      >
        <RefreshCwIcon className="h-3 w-3 mr-1" />
        Actualiser
      </Button>
      
      {lastUpdate && (
        <div className="text-xs text-muted-foreground">
          Dernière mise à jour: {lastUpdate}
        </div>
      )}
    </div>
  )
}