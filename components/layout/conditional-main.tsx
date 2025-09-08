"use client"

import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

interface ConditionalMainProps {
  children: ReactNode
}

export function ConditionalMain({ children }: ConditionalMainProps) {
  const pathname = usePathname()
  
  // Pages où la navigation ne s'affiche pas
  const hiddenNavRoutes = ['/login', '/error']
  const shouldHideNav = hiddenNavRoutes.includes(pathname)
  
  return (
    <main className={shouldHideNav ? '' : 'pt-12'}>
      {children}
    </main>
  )
}