'use server'

import { createClient } from '@/utils/supabase/server'

export interface EmailTracking {
  id: string
  user_id: string
  recipient_email: string
  subject: string
  message_id: string
  status: 'PENDING' | 'REPLIED' | 'STOPPED' | 'EXPIRED'
  sent_at: string
  reply_received_at?: string
  stopped_at?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface EmailTrackingInsert {
  recipient_email: string
  subject: string
  message_id: string
  expires_at?: string
}

export interface EmailTrackingUpdate {
  status?: 'PENDING' | 'REPLIED' | 'STOPPED' | 'EXPIRED'
  reply_received_at?: string
  stopped_at?: string
}

export class EmailService {
  private supabase

  constructor() {
    this.supabase = null
  }

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  async createEmailTracking(data: EmailTrackingInsert): Promise<EmailTracking> {
    const supabase = await this.getClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const { data: emailTracking, error } = await supabase
      .from('email_tracking')
      .insert({
        user_id: user.id,
        recipient_email: data.recipient_email,
        subject: data.subject,
        message_id: data.message_id,
        status: 'PENDING',
        expires_at: data.expires_at,
        sent_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create email tracking: ${error.message}`)
    }

    return emailTracking
  }

  async getEmailTrackings(): Promise<EmailTracking[]> {
    const supabase = await this.getClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch email trackings: ${error.message}`)
    }

    return data || []
  }

  async getEmailTrackingById(id: string): Promise<EmailTracking | null> {
    const supabase = await this.getClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await supabase
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

  async updateEmailTracking(id: string, data: EmailTrackingUpdate): Promise<EmailTracking> {
    const supabase = await this.getClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const updateData: any = {
      ...data,
      updated_at: new Date().toISOString()
    }

    const { data: emailTracking, error } = await supabase
      .from('email_tracking')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update email tracking: ${error.message}`)
    }

    return emailTracking
  }

  async deleteEmailTracking(id: string): Promise<void> {
    const supabase = await this.getClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const { error } = await supabase
      .from('email_tracking')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Failed to delete email tracking: ${error.message}`)
    }
  }

  async getEmailStats(): Promise<Record<string, number>> {
    const supabase = await this.getClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await supabase
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
}

export const emailService = new EmailService()