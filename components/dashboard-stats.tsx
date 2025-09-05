"use client"

import { Mail, Clock, CheckCircle, StopCircle } from "lucide-react"
import { AdvancedStatsCard } from "@/components/advanced-stats-card"
import { StatsGrid } from "@/components/stats-card"

interface EmailStats {
  PENDING: number
  REPLIED: number
  STOPPED: number
  EXPIRED: number
}

interface DashboardStatsProps {
  emailStats: EmailStats
  totalEmails: number
}

export function DashboardStats({ emailStats, totalEmails }: DashboardStatsProps) {
  return (
    <StatsGrid>
      <AdvancedStatsCard
        title="Emails suivis"
        value={totalEmails}
        icon={Mail}
        iconColor="text-blue-600 dark:text-blue-400"
      />
      
      <AdvancedStatsCard
        title="En attente"
        value={emailStats.PENDING}
        icon={Clock}
        iconColor="text-orange-600 dark:text-orange-400"
      />
      
      <AdvancedStatsCard
        title="Répondus"
        value={emailStats.REPLIED}
        icon={CheckCircle}
        iconColor="text-green-600 dark:text-green-400"
      />
      
      <AdvancedStatsCard
        title="Arrêtés"
        value={emailStats.STOPPED}
        icon={StopCircle}
        iconColor="text-red-600 dark:text-red-400"
      />
    </StatsGrid>
  )
}