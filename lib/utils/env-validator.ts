/**
 * Utilitaire pour valider les variables d'environnement critiques
 */

export interface EnvValidationResult {
  isValid: boolean
  missing: string[]
  warnings: string[]
  info: {
    environment: 'development' | 'production'
    platform: 'vercel' | 'other' | 'local'
    webhookUrl: string | null
  }
}

/**
 * Valide toutes les variables d'environnement critiques pour les webhooks
 */
export function validateWebhookEnvironment(): EnvValidationResult {
  const missing: string[] = []
  const warnings: string[] = []
  
  // Détection de l'environnement
  const isProduction = process.env.NODE_ENV === 'production'
  const isVercel = process.env.VERCEL === '1'
  const platform = isVercel ? 'vercel' : (isProduction ? 'other' : 'local')
  
  // Variables critiques
  const webhookEnabled = process.env.WEBHOOK_ENABLED
  const webhookUrl = process.env.WEBHOOK_ENDPOINT_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const clientState = process.env.WEBHOOK_CLIENT_STATE
  
  // Validation WEBHOOK_ENABLED
  if (!webhookEnabled) {
    missing.push('WEBHOOK_ENABLED')
  } else if (webhookEnabled !== 'true') {
    warnings.push(`WEBHOOK_ENABLED="${webhookEnabled}" (devrait être "true")`)
  }
  
  // Validation WEBHOOK_ENDPOINT_URL
  if (!webhookUrl) {
    missing.push('WEBHOOK_ENDPOINT_URL')
  } else {
    if (!webhookUrl.startsWith('https://')) {
      warnings.push('WEBHOOK_ENDPOINT_URL devrait utiliser HTTPS')
    }
    if (!webhookUrl.includes('/api/webhooks/outlook')) {
      warnings.push('WEBHOOK_ENDPOINT_URL devrait pointer vers /api/webhooks/outlook')
    }
  }
  
  // Validation SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY')
  } else if (serviceRoleKey.length < 100) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY semble trop courte')
  }
  
  // Validation WEBHOOK_CLIENT_STATE  
  if (!clientState) {
    warnings.push('WEBHOOK_CLIENT_STATE non défini (sera généré automatiquement)')
  }
  
  // Validation spécifique à Vercel
  if (isVercel) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      warnings.push('NEXT_PUBLIC_APP_URL non défini')
    }
    
    // Vérifier la cohérence entre APP_URL et WEBHOOK_ENDPOINT_URL
    if (appUrl && webhookUrl && !webhookUrl.startsWith(appUrl)) {
      warnings.push('WEBHOOK_ENDPOINT_URL ne correspond pas à NEXT_PUBLIC_APP_URL')
    }
  }
  
  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    info: {
      environment: isProduction ? 'production' : 'development',
      platform,
      webhookUrl
    }
  }
}

/**
 * Log le résultat de la validation avec des couleurs
 */
export function logValidationResult(result: EnvValidationResult) {
  console.log('🔍 Validation des variables d\'environnement webhook')
  console.log(`📍 Environnement: ${result.info.environment} (${result.info.platform})`)
  console.log(`🔗 Webhook URL: ${result.info.webhookUrl || 'Non définie'}`)
  
  if (result.isValid) {
    console.log('✅ Configuration valide')
  } else {
    console.log('❌ Configuration incomplète')
  }
  
  if (result.missing.length > 0) {
    console.log('🚨 Variables manquantes:')
    result.missing.forEach(variable => {
      console.log(`   • ${variable}`)
    })
  }
  
  if (result.warnings.length > 0) {
    console.log('⚠️ Avertissements:')
    result.warnings.forEach(warning => {
      console.log(`   • ${warning}`)
    })
  }
}

/**
 * Recommandations pour corriger les problèmes détectés
 */
export function getFixRecommendations(result: EnvValidationResult): string[] {
  const recommendations: string[] = []
  
  if (result.missing.includes('WEBHOOK_ENABLED')) {
    recommendations.push('Ajouter WEBHOOK_ENABLED=true dans les variables d\'environnement Vercel')
  }
  
  if (result.missing.includes('WEBHOOK_ENDPOINT_URL')) {
    recommendations.push('Définir WEBHOOK_ENDPOINT_URL=https://votre-domaine.vercel.app/api/webhooks/outlook')
  }
  
  if (result.missing.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    recommendations.push('Ajouter la clé de service Supabase dans les variables d\'environnement')
  }
  
  if (result.warnings.some(w => w.includes('HTTPS'))) {
    recommendations.push('Utiliser HTTPS pour l\'URL webhook (requis par Microsoft Graph)')
  }
  
  if (!result.isValid) {
    recommendations.push('Redémarrer le déploiement après avoir ajouté les variables manquantes')
  }
  
  return recommendations
}