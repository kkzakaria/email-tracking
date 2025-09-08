import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Database } from "@/types/database.types"

type EmailStatus = Database["public"]["Enums"]["email_status"]

interface EmailStatusBadgeProps {
  status: EmailStatus | null
}

export function EmailStatusBadge({ status }: EmailStatusBadgeProps) {
  if (!status) return null

  const getStatusConfig = (status: EmailStatus) => {
    switch (status) {
      case "PENDING":
        return {
          label: "En attente",
          className: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
        }
      case "REPLIED":
        return {
          label: "Répondu",
          className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
        }
      case "FAILED":
        return {
          label: "Échec",
          className: "bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
        }
      case "EXPIRED":
        return {
          label: "Expiré",
          className: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-600",
        }
      default:
        return {
          label: status,
          className: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200",
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium cursor-default transition-colors",
        config.className
      )}
    >
      {config.label}
    </Badge>
  )
}