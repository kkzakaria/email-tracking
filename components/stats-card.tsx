"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  description?: string
  className?: string
  iconClassName?: string
  valueClassName?: string
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  className,
  iconClassName,
  valueClassName
}: StatsCardProps) {
  return (
    <Card className={cn("transition-all duration-200 hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon 
          className={cn(
            "h-5 w-5 text-muted-foreground",
            iconClassName
          )} 
        />
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className={cn(
            "text-3xl font-bold tracking-tight",
            valueClassName
          )}>
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </div>
          
          {trend && (
            <div className="flex items-center space-x-1 text-sm">
              <span className={cn(
                "flex items-center text-xs font-medium",
                trend.isPositive 
                  ? "text-green-600 dark:text-green-400" 
                  : "text-red-600 dark:text-red-400"
              )}>
                {trend.isPositive ? "+" : ""}{trend.value}%
              </span>
              <span className="text-muted-foreground text-xs">
                {trend.label}
              </span>
            </div>
          )}
          
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface StatsGridProps {
  children: React.ReactNode
  className?: string
}

export function StatsGrid({ children, className }: StatsGridProps) {
  return (
    <div className={cn(
      "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
      className
    )}>
      {children}
    </div>
  )
}