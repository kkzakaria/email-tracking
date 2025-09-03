# Configuration MFA Supabase

## Avertissement de sécurité
Votre projet Supabase indique : "Your project has too few MFA options enabled, which may weaken account security."

## Configuration recommandée

### 1. Accéder aux paramètres Auth dans Supabase Dashboard

1. Connectez-vous à [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **Authentication** → **Providers**

### 2. Activer les options MFA

#### Option A : TOTP (Time-based One-Time Password) - RECOMMANDÉ
```sql
-- Migration pour activer TOTP MFA
-- Cette migration est optionnelle, la configuration se fait principalement dans le dashboard

-- Créer une table pour stocker les facteurs MFA si elle n'existe pas
CREATE TABLE IF NOT EXISTS auth.mfa_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    factor_type TEXT NOT NULL,
    secret TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Créer une table pour les challenges MFA
CREATE TABLE IF NOT EXISTS auth.mfa_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factor_id UUID NOT NULL REFERENCES auth.mfa_factors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    ip_address INET
);
```

#### Option B : SMS (Configuration dans le Dashboard)
1. Dans **Authentication** → **Settings**
2. Activer "Enable phone authentication"
3. Configurer un provider SMS (Twilio, MessageBird, etc.)

### 3. Configuration côté application

#### Ajouter le support MFA dans l'authentification

```typescript
// lib/supabase/mfa-config.ts
import { createClient } from '@supabase/supabase-js'

export interface MFAConfig {
  enabled: boolean
  methods: ('totp' | 'sms')[]
  required: boolean
}

export const MFA_CONFIG: MFAConfig = {
  enabled: true,
  methods: ['totp', 'sms'],
  required: false // Set to true to enforce MFA for all users
}

// Fonction pour enroller un utilisateur dans MFA
export async function enrollMFA(supabase: any, method: 'totp' | 'sms') {
  if (method === 'totp') {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp'
    })
    
    if (error) throw error
    
    // data.totp.qr_code contient le QR code à afficher
    // data.totp.secret contient le secret à sauvegarder
    return data
  }
  
  if (method === 'sms') {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'sms',
      phone: '+33612345678' // Numéro de téléphone de l'utilisateur
    })
    
    if (error) throw error
    return data
  }
}

// Fonction pour vérifier un code MFA
export async function verifyMFA(supabase: any, factorId: string, code: string) {
  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    code
  })
  
  if (error) throw error
  return data
}

// Fonction pour lister les facteurs MFA d'un utilisateur
export async function listMFAFactors(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('No user logged in')
  
  const { data, error } = await supabase.auth.mfa.listFactors()
  
  if (error) throw error
  return data
}
```

### 4. Variables d'environnement nécessaires

Ajoutez dans `.env.local` :

```env
# MFA Configuration
NEXT_PUBLIC_MFA_ENABLED=true
NEXT_PUBLIC_MFA_REQUIRED=false
NEXT_PUBLIC_MFA_METHODS=totp,sms

# SMS Provider (si SMS activé)
SUPABASE_SMS_PROVIDER=twilio
SUPABASE_SMS_TWILIO_ACCOUNT_SID=your_twilio_account_sid
SUPABASE_SMS_TWILIO_AUTH_TOKEN=your_twilio_auth_token
SUPABASE_SMS_TWILIO_MESSAGE_SERVICE_SID=your_message_service_sid
```

### 5. Étapes de configuration dans Supabase Dashboard

1. **Activer MFA globalement**
   - Authentication → Settings → Security
   - Activer "Enable Multi-Factor Authentication (MFA)"

2. **Configurer TOTP**
   - Aucune configuration supplémentaire requise
   - Fonctionne avec Google Authenticator, Authy, etc.

3. **Configurer SMS (optionnel)**
   - Authentication → Settings → Phone Auth
   - Sélectionner un provider (Twilio recommandé)
   - Entrer les credentials du provider

4. **Configurer les politiques MFA**
   - Décider si MFA est obligatoire ou optionnel
   - Configurer les rôles exemptés si nécessaire

### 6. Test de la configuration

```typescript
// Test du MFA dans votre application
async function testMFASetup() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  // 1. S'authentifier
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password'
  })
  
  // 2. Enroller dans MFA
  const { data: enrollData } = await supabase.auth.mfa.enroll({
    factorType: 'totp'
  })
  
  console.log('QR Code:', enrollData?.totp?.qr_code)
  
  // 3. L'utilisateur scanne le QR code avec son app authenticator
  // 4. Vérifier avec le code généré
  const verificationCode = '123456' // Code de l'app
  const { data: verifyData } = await supabase.auth.mfa.verify({
    factorId: enrollData?.id,
    code: verificationCode
  })
  
  console.log('MFA Setup Complete:', verifyData)
}
```

## Résolution de l'avertissement

Une fois que vous avez :
1. ✅ Activé MFA dans le dashboard Supabase
2. ✅ Configuré au moins 2 méthodes MFA (TOTP + SMS)
3. ✅ Appliqué la migration SQL si nécessaire
4. ✅ Implémenté le support MFA dans votre application

L'avertissement "Insufficient MFA Options" devrait disparaître.

## Notes importantes

- **TOTP** est plus sécurisé et ne nécessite pas de coûts supplémentaires
- **SMS** a des coûts associés (provider SMS) mais est plus facile pour les utilisateurs
- Commencez avec MFA optionnel, puis passez à obligatoire progressivement
- Prévoyez un processus de récupération en cas de perte du dispositif MFA