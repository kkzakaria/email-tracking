"use client"

import { Plus, Webhook } from "lucide-react"
import { ActionButton } from "@/components/action-button"

export function DashboardActionButtons() {
  return (
    <div className="flex items-center gap-3">
      <ActionButton
        href="/dashboard/webhooks"
        icon={Webhook}
        label="Webhooks"
        description="Configurez les notifications automatiques et recevez des alertes en temps réel"
        variant="success"
      />
      
      <ActionButton
        href="/dashboard/compose"
        icon={Plus}
        label="Composer"
        description="Créez et envoyez un email tracké pour suivre automatiquement les réponses"
        variant="primary"
      />
    </div>
  )
}