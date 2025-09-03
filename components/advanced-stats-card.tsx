"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AdvancedStatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  change?: {
    value: number
    period: string
    isPositive?: boolean
  }
  description?: string
  className?: string
  showMiniChart?: boolean
  chartData?: number[]
}

export function AdvancedStatsCard({
  title,
  value,
  icon: Icon,
  change,
  description,
  className,
  showMiniChart = false,
  chartData = []
}: AdvancedStatsCardProps) {
  // Créer une mini barre de progression simple
  const renderMiniChart = () => {
    if (!showMiniChart || !chartData.length) return null
    
    const max = Math.max(...chartData)
    const normalized = chartData.map(val => (val / max) * 100)
    
    return (
      <div className="flex items-end space-x-0.5 h-6 mt-2">
        {normalized.map((height, index) => (
          <div
            key={index}
            className="bg-gradient-to-t from-blue-500/80 to-blue-400/60 dark:from-blue-600/80 dark:to-blue-500/60 rounded-sm flex-1 transition-all duration-500"
            style={{ 
              height: `${Math.max(height, 8)}%`,
              minHeight: '2px'
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <Card className={cn(
      "group transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1 border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50",
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            {title}
          </CardTitle>
          {description && (
            <p className="text-xs text-muted-foreground/80">
              {description}
            </p>
          )}
        </div>
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 group-hover:from-blue-100 group-hover:to-indigo-100 dark:group-hover:from-blue-900/50 dark:group-hover:to-indigo-900/50 transition-all duration-300">
          <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </span>
          
          {change && (
            <div className={cn(
              "flex items-center space-x-1 text-sm font-medium px-2 py-1 rounded-full",
              change.isPositive 
                ? "text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-950/50" 
                : "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/50"
            )}>
              {change.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span className="text-xs">
                {change.isPositive ? "+" : ""}{change.value}%
              </span>
            </div>
          )}
        </div>
        
        {change && (
          <p className="text-xs text-muted-foreground">
            {change.period}
          </p>
        )}
        
        {renderMiniChart()}
      </CardContent>
    </Card>
  )
}