"use client"

import { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ActionButtonProps {
  href?: string
  onClick?: () => void
  icon: LucideIcon
  label: string
  description: string
  variant?: "primary" | "secondary" | "accent" | "success" | "warning" | "danger"
  size?: "sm" | "default" | "lg"
  disabled?: boolean
  loading?: boolean
  className?: string
}

const variantStyles = {
  primary: "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-600/20",
  secondary: "bg-gray-600 hover:bg-gray-700 focus-visible:ring-gray-600/20",
  accent: "bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-600/20",
  success: "bg-green-600 hover:bg-green-700 focus-visible:ring-green-600/20",
  warning: "bg-yellow-600 hover:bg-yellow-700 focus-visible:ring-yellow-600/20",
  danger: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-600/20"
}

export function ActionButton({
  href,
  onClick,
  icon: Icon,
  label,
  description,
  variant = "primary",
  size = "sm",
  disabled = false,
  loading = false,
  className
}: ActionButtonProps) {
  const buttonContent = (
    <>
      <Icon className={cn(
        "w-4 h-4 transition-transform",
        loading ? "animate-spin" : "group-hover:scale-110"
      )} />
      {loading ? "Chargement..." : label}
    </>
  )

  const buttonClass = cn(
    "group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
    variantStyles[variant],
    className
  )

  const ButtonComponent = () => (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      variant="default"
      size={size}
      className={buttonClass}
    >
      {buttonContent}
    </Button>
  )

  const LinkButtonComponent = () => (
    <Button asChild variant="default" size={size} className={buttonClass}>
      <Link href={href!}>
        {buttonContent}
      </Link>
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? <LinkButtonComponent /> : <ButtonComponent />}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="text-center space-y-1">
          <p className="font-medium">{label}</p>
          <p className="text-xs opacity-90">{description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}