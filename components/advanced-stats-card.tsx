"use client"

import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface AdvancedStatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  iconColor?: string
  className?: string
}

export function AdvancedStatsCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-muted-foreground",
  className
}: AdvancedStatsCardProps) {

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md border-muted/40",
      className
    )}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Icon className={cn("h-5 w-5 flex-shrink-0", iconColor)} />
          <span className="text-sm font-medium text-muted-foreground flex-1">
            {title}
          </span>
          <span className="text-xl font-bold">
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}