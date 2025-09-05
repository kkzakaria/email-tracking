'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, ReactNode } from 'react'

/**
 * Configuration optimisée pour React Query avec Supabase
 */
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Temps de cache: 5 minutes
        staleTime: 5 * 60 * 1000,
        // Réessai automatique en cas d'erreur
        retry: 2,
        // Refetch automatique quand la fenêtre reprend le focus
        refetchOnWindowFocus: true,
        // Pas de refetch automatique au reconnect (Supabase Realtime gère cela)
        refetchOnReconnect: false,
      },
      mutations: {
        // Retry des mutations échouées
        retry: 1,
      },
    },
  })
}

interface QueryProviderProps {
  children: ReactNode
}

/**
 * Provider React Query avec configuration optimisée pour temps réel
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Singleton QueryClient pour éviter les recreations
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Dev tools uniquement en développement */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
          position="bottom-right"
        />
      )}
    </QueryClientProvider>
  )
}