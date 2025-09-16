// ====================================================================================================
// TYPES PARTAGÉS - Edge Functions Supabase (Application Permissions Architecture v2.0)
// ====================================================================================================

import { SupabaseClient } from '@supabase/supabase-js'

// Type pour le client Supabase utilisé dans les Edge Functions
export type SupabaseClientType = SupabaseClient

// Types Microsoft Graph Application Token
export interface AppTokenData {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
  scope: string
}

export interface CachedToken extends AppTokenData {
  cached_at: number
}

// Types Database Schema
export interface TrackedEmail {
  id: string
  message_id: string
  subject: string
  recipient_email: string
  sender_email: string
  sent_at: string
  status: 'PENDING' | 'REPLIED' | 'FAILED' | 'EXPIRED'
  user_id: string | null
  graph_message_id?: string
  conversation_id?: string
  last_checked: string
  created_at: string
}

export interface EmailReminder {
  id: string
  tracked_email_id: string
  user_id: string | null
  reminder_number: number
  scheduled_for: string
  sent_at?: string
  compiled_message?: string
  status: 'SCHEDULED' | 'SENT' | 'CANCELLED' | 'FAILED'
  created_at: string
  updated_at: string
}

export interface EmailReminderWithTrackedEmail extends EmailReminder {
  tracked_emails: TrackedEmail
}

export interface ReminderSettings {
  delay_hours: number[]
  templates: {
    [key: string]: string
  }
  work_hours: {
    start: string
    end: string
  }
  work_days: string[]
  max_reminders: number
}

// Types Microsoft Graph
export interface GraphMessage {
  id: string
  internetMessageId?: string
  conversationId?: string
  subject?: string
  from?: {
    emailAddress?: {
      address?: string
      name?: string
    }
  }
  toRecipients?: Array<{
    emailAddress?: {
      address?: string
      name?: string
    }
  }>
  receivedDateTime?: string
  sentDateTime?: string
  isRead?: boolean
  isDraft?: boolean
  parentFolderId?: string
  hasAttachments?: boolean
}

export interface GraphSubscription {
  id?: string
  changeType: string
  notificationUrl: string
  resource: string
  expirationDateTime: string
  clientState: string
  latestSupportedTlsVersion?: string
}

export interface GraphSubscriptionResponse extends GraphSubscription {
  id: string
  applicationId?: string
}

export interface WebhookNotification {
  value: Array<{
    subscriptionId: string
    clientState: string
    changeType: string
    resource: string
    resourceData?: {
      id: string
      '@odata.type': string
      '@odata.etag': string
    }
    subscriptionExpirationDateTime: string
    tenantId?: string
  }>
  validationTokens?: string[]
}

// Types pour les réponses API
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface TokenManagerResponse {
  success: boolean
  data: {
    access_token: string
    token_type: string
    cached: boolean
    expires_at: number | null
    refreshed?: boolean
    valid?: boolean
  }
  error?: string
}

export interface SubscriptionResponse {
  success: boolean
  subscription?: {
    id: string
    userEmail: string
    resource: string
    expiresAt: string
  }
  renewed?: number
  errors?: number
  total?: number
  cleaned?: number
  message?: string
  error?: string
}

export interface SyncStats {
  totalMessages: number
  newTrackedEmails: number
  updatedEmails: number
  errors: number
  syncedPeriod: string
}

export interface EmailHistorySyncResponse {
  success: boolean
  stats: SyncStats
  timestamp: string
  version: string
  architecture: string
  error?: string
}

export interface ReminderProcessingResult {
  processed: number
  sent: number
  failed: number
}