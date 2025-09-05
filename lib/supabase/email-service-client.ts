'use client'

import { createClient } from '@/utils/supabase/client'
import type { EmailTracking } from './email-service'

/**
 * Service client-side pour les opérations email avec Supabase
 * Utilisable dans les Client Components et hooks React Query
 */
export class EmailServiceClient {
  private supabase = createClient()

  /**
   * Récupérer la liste des emails trackés de l'utilisateur connecté
   */
  async getEmailTrackings(): Promise<EmailTracking[]> {
    const { data: { user }, error: authError } = await this.supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await this.supabase
      .from('email_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch email trackings: ${error.message}`)
    }

    return data || []
  }

  /**
   * Récupérer les statistiques des emails
   */
  async getEmailStats(): Promise<Record<string, number>> {
    const { data: { user }, error: authError } = await this.supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await this.supabase
      .from('email_tracking')
      .select('status')
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Failed to fetch email stats: ${error.message}`)
    }

    const stats = {
      PENDING: 0,
      REPLIED: 0,
      STOPPED: 0,
      EXPIRED: 0
    }

    data?.forEach((email) => {
      stats[email.status as keyof typeof stats]++
    })

    return stats
  }

  /**
   * Supprimer un ou plusieurs emails trackés
   */
  async deleteEmailTrackings(ids: string[]): Promise<void> {
    const { data: { user }, error: authError } = await this.supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const { error } = await this.supabase
      .from('email_tracking')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Failed to delete email trackings: ${error.message}`)
    }
  }

  /**
   * Arrêter le suivi d'un ou plusieurs emails
   */
  async stopEmailTrackings(ids: string[]): Promise<void> {
    const { data: { user }, error: authError } = await this.supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const { error } = await this.supabase
      .from('email_tracking')
      .update({
        status: 'STOPPED',
        stopped_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', ids)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Failed to stop email trackings: ${error.message}`)
    }
  }

  /**
   * Obtenir un email tracké par ID
   */
  async getEmailTrackingById(id: string): Promise<EmailTracking | null> {
    const { data: { user }, error: authError } = await this.supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await this.supabase
      .from('email_tracking')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch email tracking: ${error.message}`)
    }

    return data
  }

  /**
   * S'abonner aux changements en temps réel sur les emails trackés
   */
  subscribeToEmailChanges(
    userId: string,
    onUpdate: (payload: any) => void,
    onError?: (error: any) => void
  ) {
    const channel = this.supabase
      .channel('email-tracking-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_tracking',
          filter: `user_id=eq.${userId}`,
        },
        onUpdate
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Souscription temps réel active pour email_tracking')
        } else if (status === 'CHANNEL_ERROR' && onError) {
          onError(new Error('Erreur de souscription Realtime'))
        }
      })

    return channel
  }

  /**
   * Se désabonner des changements temps réel
   */
  unsubscribeFromEmailChanges(channel: any) {
    return this.supabase.removeChannel(channel)
  }
}

// Instance singleton pour utilisation dans les hooks
export const emailServiceClient = new EmailServiceClient()