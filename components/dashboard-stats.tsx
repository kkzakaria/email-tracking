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
        description="Total des emails trackés"
        showMiniChart={true}
        chartData={[12, 19, 15, 27, 32, 25, 28]}
        change={{
          value: 8.2,
          period: "vs mois dernier",
          isPositive: true
        }}
      />
      
      <AdvancedStatsCard
        title="En attente"
        value={emailStats.PENDING}
        icon={Clock}
        description="Emails en attente de réponse"
        showMiniChart={true}
        chartData={[8, 12, 6, 15, 18, 12, 14]}
        change={{
          value: 2.4,
          period: "vs semaine dernière",
          isPositive: false
        }}
      />
      
      <AdvancedStatsCard
        title="Répondus"
        value={emailStats.REPLIED}
        icon={CheckCircle}
        description="Emails avec réponse reçue"
        showMiniChart={true}
        chartData={[3, 8, 12, 16, 20, 18, 22]}
        change={{
          value: 15.3,
          period: "vs mois dernier",
          isPositive: true
        }}
      />
      
      <AdvancedStatsCard
        title="Arrêtés"
        value={emailStats.STOPPED}
        icon={StopCircle}
        description="Trackings arrêtés manuellement"
        showMiniChart={true}
        chartData={[2, 1, 3, 2, 1, 4, 2]}
        change={{
          value: 5.1,
          period: "vs mois dernier",
          isPositive: false
        }}
      />
    </StatsGrid>
  )
}