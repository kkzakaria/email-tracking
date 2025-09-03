import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { syncOutlookSentEmails } from '@/lib/microsoft/sync-service'
import { isMicrosoftConnected } from '@/lib/microsoft/graph-helper'

// GET /api/emails/sync - Synchroniser les emails Outlook
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification utilisateur
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Vous devez être connecté pour synchroniser' },
        { status: 401 }
      )
    }
    
    // Vérifier la connexion Microsoft
    const microsoftConnected = await isMicrosoftConnected()
    if (!microsoftConnected) {
      return NextResponse.json(
        { error: 'Vous devez connecter votre compte Microsoft pour synchroniser' },
        { status: 400 }
      )
    }

    console.log('🔄 Démarrage de la synchronisation Outlook pour:', user.email)

    // Lancer la synchronisation (par défaut: emails sans réponse uniquement)
    const result = await syncOutlookSentEmails()

    if (!result.success) {
      console.error('❌ Échec de la synchronisation:', result.error)
      return NextResponse.json(
        { error: result.error || 'Échec de la synchronisation' },
        { status: 500 }
      )
    }

    console.log('✅ Synchronisation réussie:', {
      newTrackedEmails: result.newTrackedEmails,
      updatedTrackedEmails: result.updatedTrackedEmails,
      skippedRepliedEmails: result.skippedRepliedEmails,
      userId: user.id
    })

    // Réponse de succès
    return NextResponse.json({
      success: true,
      message: 'Synchronisation terminée avec succès',
      data: {
        newTrackedEmails: result.newTrackedEmails,
        updatedTrackedEmails: result.updatedTrackedEmails,
        skippedRepliedEmails: result.skippedRepliedEmails,
        timestamp: new Date().toISOString()
      }
    }, { status: 200 })
    
  } catch (error) {
    console.error('❌ Erreur serveur lors de la synchronisation:', error)
    
    return NextResponse.json(
      { 
        error: 'Erreur serveur interne',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    )
  }
}

// POST /api/emails/sync - Synchronisation manuelle avec paramètres
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parser les paramètres optionnels
    let requestData: { days?: number; forceSync?: boolean } = {}
    try {
      requestData = await request.json()
    } catch (e) {
      // Paramètres par défaut si pas de body JSON
      requestData = {}
    }

    const { days = 7, forceSync = false } = requestData

    console.log('🔄 Synchronisation manuelle avec paramètres:', {
      days,
      forceSync,
      userId: user.id
    })

    // Lancer la synchronisation avec paramètres
    const result = await syncOutlookSentEmails({
      includeRepliedEmails: forceSync, // Si forceSync = true, inclure les emails avec réponses
      days: days
    })

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `Synchronisation réussie: ${result.newTrackedEmails} nouveaux emails trackés, ${result.updatedTrackedEmails} mis à jour, ${result.skippedRepliedEmails} emails avec réponses ignorés`
        : 'Échec de la synchronisation',
      data: {
        newTrackedEmails: result.newTrackedEmails,
        updatedTrackedEmails: result.updatedTrackedEmails,
        skippedRepliedEmails: result.skippedRepliedEmails,
        error: result.error,
        parameters: { days, forceSync },
        timestamp: new Date().toISOString()
      }
    }, { 
      status: result.success ? 200 : 500 
    })
    
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation manuelle:', error)
    
    return NextResponse.json(
      { 
        error: 'Erreur serveur',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    )
  }
}