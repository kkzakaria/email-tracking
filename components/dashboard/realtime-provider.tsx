"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { createClient } from "@/utils/supabase/client"
import type { Database } from "@/types/database.types"

type TrackedEmail = Database["public"]["Tables"]["tracked_emails"]["Row"]

interface RealtimeContextType {
  emails: TrackedEmail[]
  setEmails: (emails: TrackedEmail[]) => void
  isConnected: boolean
  isLoading: boolean
  error: string | null
  refreshData: () => Promise<void>
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error("useRealtime must be used within a RealtimeProvider")
  }
  return context
}

interface RealtimeProviderProps {
  children: ReactNode
  initialEmails?: TrackedEmail[]
}

export function RealtimeProvider({ children, initialEmails = [] }: RealtimeProviderProps) {
  const [emails, setEmails] = useState<TrackedEmail[]>(initialEmails)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshData = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(1000)

      if (error) throw error

      setEmails(data || [])
    } catch (err) {
      console.error('Erreur lors du refresh des données:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    
    // Configuration du channel Realtime
    const channel = supabase
      .channel('tracked_emails_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tracked_emails'
        },
        (payload) => {
          console.log('Realtime change received:', payload)
          
          switch (payload.eventType) {
            case 'INSERT':
              const newEmail = payload.new as TrackedEmail
              setEmails(current => [newEmail, ...current])
              break
              
            case 'UPDATE':
              const updatedEmail = payload.new as TrackedEmail
              setEmails(current => 
                current.map(email => 
                  email.id === updatedEmail.id ? updatedEmail : email
                )
              )
              break
              
            case 'DELETE':
              const deletedEmail = payload.old as TrackedEmail
              setEmails(current => 
                current.filter(email => email.id !== deletedEmail.id)
              )
              break
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status)
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          setError(null)
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false)
          setError('Erreur de connexion Realtime')
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false)
          setError('Timeout de connexion Realtime')
        }
        
        setIsLoading(false)
      })

    // Cleanup function
    return () => {
      console.log('Cleaning up Realtime subscription')
      channel.unsubscribe()
    }
  }, [])

  // Initial data load si pas de données initiales
  useEffect(() => {
    if (initialEmails.length === 0) {
      refreshData()
    } else {
      setIsLoading(false)
    }
  }, [initialEmails.length])

  const value: RealtimeContextType = {
    emails,
    setEmails,
    isConnected,
    isLoading,
    error,
    refreshData
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}