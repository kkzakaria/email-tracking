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
  className,
  iconClassName,
  valueClassName
}: StatsCardProps) {
  return (
    <Card className={cn("transition-all duration-200 hover:shadow-md", className)}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Icon 
            className={cn(
              "h-5 w-5 text-muted-foreground flex-shrink-0",
              iconClassName
            )} 
          />
          <span className="text-sm font-medium text-muted-foreground flex-1">
            {title}
          </span>
          <span className={cn(
            "text-xl font-bold",
            valueClassName
          )}>
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </span>
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