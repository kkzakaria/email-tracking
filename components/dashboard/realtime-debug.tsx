"use client"

import { useRealtime } from "./realtime-provider"
import { Badge } from "@/components/ui/badge"
import { WifiIcon, WifiOffIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function RealtimeDebug() {
  const { isConnected, error, refreshData, emails } = useRealtime()

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
      
      <div className="text-xs text-muted-foreground">
        Dernière mise à jour: {new Date().toLocaleTimeString()}
      </div>
    </div>
  )
}