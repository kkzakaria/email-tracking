'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { emailServiceClient } from '@/lib/supabase/email-service-client'
import type { EmailTracking } from '@/lib/supabase/email-service'

// Clés de requêtes pour React Query
export const emailTrackingKeys = {
  all: ['email-tracking'] as const,
  lists: () => [...emailTrackingKeys.all, 'list'] as const,
  list: (userId?: string) => [...emailTrackingKeys.lists(), userId] as const,
  stats: (userId?: string) => [...emailTrackingKeys.all, 'stats', userId] as const,
  detail: (id: string) => [...emailTrackingKeys.all, 'detail', id] as const,
}

/**
 * Hook pour récupérer la liste des emails trackés avec temps réel
 */
export function useEmailTrackings(initialData?: EmailTracking[]) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const channelRef = useRef<any>(null)

  // Query pour récupérer les emails
  const query = useQuery({
    queryKey: emailTrackingKeys.lists(),
    queryFn: () => emailServiceClient.getEmailTrackings(),
    initialData,
    staleTime: 30 * 1000, // 30 secondes (plus court car on a le temps réel)
    retry: 2,
  })

  // Effet pour configurer la souscription temps réel
  useEffect(() => {
    let mounted = true

    const setupRealtimeSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !mounted) return

        // Si déjà abonné, nettoyer d'abord
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current)
        }

        // Créer nouvelle souscription
        channelRef.current = emailServiceClient.subscribeToEmailChanges(
          user.id,
          (payload) => {
            console.log('📧 Changement temps réel détecté:', payload.eventType, payload.new?.id)
            
            // Invalider et refetch les données
            queryClient.invalidateQueries({
              queryKey: emailTrackingKeys.lists()
            })
            queryClient.invalidateQueries({
              queryKey: emailTrackingKeys.stats()
            })

            // Optimistic update selon le type d'événement
            if (payload.eventType === 'UPDATE' && payload.new) {
              queryClient.setQueryData<EmailTracking[]>(
                emailTrackingKeys.lists(),
                (oldData) => {
                  if (!oldData) return oldData
                  return oldData.map(email => 
                    email.id === payload.new.id ? payload.new : email
                  )
                }
              )
            }
          },
          (error) => {
            console.error('❌ Erreur souscription temps réel:', error)
          }
        )
      } catch (error) {
        console.error('❌ Erreur configuration temps réel:', error)
      }
    }

    setupRealtimeSubscription()

    return () => {
      mounted = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [queryClient, supabase])

  return query
}

/**
 * Hook pour récupérer les statistiques des emails avec temps réel
 */
export function useEmailStats(initialData?: Record<string, number>) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: emailTrackingKeys.stats(),
    queryFn: () => emailServiceClient.getEmailStats(),
    initialData,
    staleTime: 30 * 1000, // 30 secondes
    retry: 2,
    // Recalculer quand les données d'emails changent
    enabled: true,
  })
}

/**
 * Hook pour supprimer des emails trackés
 */
export function useDeleteEmailTrackings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => emailServiceClient.deleteEmailTrackings(ids),
    onMutate: async (ids) => {
      // Annuler les requêtes en cours
      await queryClient.cancelQueries({ queryKey: emailTrackingKeys.lists() })

      // Optimistic update
      const previousEmails = queryClient.getQueryData<EmailTracking[]>(
        emailTrackingKeys.lists()
      )

      queryClient.setQueryData<EmailTracking[]>(
        emailTrackingKeys.lists(),
        (oldData) => oldData?.filter(email => !ids.includes(email.id)) || []
      )

      return { previousEmails }
    },
    onError: (err, variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousEmails) {
        queryClient.setQueryData(emailTrackingKeys.lists(), context.previousEmails)
      }
    },
    onSettled: () => {
      // Refetch pour synchroniser
      queryClient.invalidateQueries({ queryKey: emailTrackingKeys.lists() })
      queryClient.invalidateQueries({ queryKey: emailTrackingKeys.stats() })
    },
  })
}

/**
 * Hook pour arrêter le suivi d'emails
 */
export function useStopEmailTrackings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => emailServiceClient.stopEmailTrackings(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: emailTrackingKeys.lists() })

      const previousEmails = queryClient.getQueryData<EmailTracking[]>(
        emailTrackingKeys.lists()
      )

      // Optimistic update - marquer comme STOPPED
      queryClient.setQueryData<EmailTracking[]>(
        emailTrackingKeys.lists(),
        (oldData) => 
          oldData?.map(email => 
            ids.includes(email.id) 
              ? { ...email, status: 'STOPPED' as const, stopped_at: new Date().toISOString() }
              : email
          ) || []
      )

      return { previousEmails }
    },
    onError: (err, variables, context) => {
      if (context?.previousEmails) {
        queryClient.setQueryData(emailTrackingKeys.lists(), context.previousEmails)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: emailTrackingKeys.lists() })
      queryClient.invalidateQueries({ queryKey: emailTrackingKeys.stats() })
    },
  })
}

/**
 * Hook pour récupérer un email par ID
 */
export function useEmailTracking(id: string) {
  return useQuery({
    queryKey: emailTrackingKeys.detail(id),
    queryFn: () => emailServiceClient.getEmailTrackingById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  })
}

/**
 * Hook utilitaire pour invalider toutes les requêtes email
 */
export function useInvalidateEmailQueries() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: emailTrackingKeys.all })
  }
}