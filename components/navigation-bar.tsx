"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  MailIcon, 
  Settings, 
  BarChart3, 
  Send,
  Menu,
  X,
  LogOut,
  User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface NavigationBarProps {
  user?: {
    email?: string
    name?: string
    image?: string
  }
}

const navigationLinks = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
    description: "Vue d'ensemble des emails trackés"
  },
  {
    label: "Soumettre",
    href: "/dashboard/send",
    icon: Send,
    description: "Soumettre un nouvel email avec tracking"
  },
  {
    label: "Paramètres",
    href: "/dashboard/settings",
    icon: Settings,
    description: "Configuration et préférences"
  }
]

export function NavigationBar({ user }: NavigationBarProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Obtenir les initiales pour l'avatar
  const getInitials = (email?: string, name?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return "U"
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center justify-between gap-4">
          {/* Partie gauche - Logo et navigation */}
          <div className="flex items-center gap-6">
            {/* Menu mobile */}
            <Popover open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <PopoverTrigger asChild>
                <Button 
                  className="md:hidden" 
                  variant="ghost" 
                  size="icon"
                  aria-label="Menu"
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                align="start" 
                className="w-64 p-2 md:hidden"
                sideOffset={8}
              >
                <nav className="flex flex-col gap-1">
                  {navigationLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          isActive && "bg-blue-700 text-white font-medium"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <div className="flex flex-col">
                          <span>{link.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {link.description}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </nav>
              </PopoverContent>
            </Popover>

            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2">
              <MailIcon className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold hidden sm:inline">
                Email Tracking
              </span>
            </Link>

            {/* Navigation desktop */}
            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList>
                {navigationLinks.map((link) => {
                  const Icon = link.icon
                  const isActive = pathname === link.href
                  return (
                    <NavigationMenuItem key={link.href}>
                      <NavigationMenuLink asChild>
                        <Link 
                          href={link.href}
                          className={cn(
                            navigationMenuTriggerStyle(),
                            "gap-2 !flex !items-center !justify-center",
                            isActive && "bg-blue-700 text-white hover:bg-blue-800"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {link.label}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  )
                })}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Partie droite - Actions utilisateur */}
          <div className="flex items-center gap-2">
            <ModeToggle />
            
            {/* Menu utilisateur */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-8 w-8 rounded-full border border-border"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={user?.image} 
                      alt={user?.name || user?.email || "User"} 
                    />
                    <AvatarFallback className="bg-primary/10 text-sm">
                      {getInitials(user?.email, user?.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    {user?.name && (
                      <p className="text-sm font-medium leading-none">
                        {user.name}
                      </p>
                    )}
                    {user?.email && (
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action="/api/auth/logout" method="POST" className="w-full">
                    <button className="flex w-full items-center cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Déconnexion
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}