// ====================================================================================================
// USER MANAGEMENT EDGE FUNCTION
// ====================================================================================================
// Description: Gestion complète des utilisateurs sans système d'invitation
// Routes: GET, POST, PUT, DELETE pour la gestion des utilisateurs
// ====================================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface UserProfile {
  id?: string
  auth_user_id?: string
  full_name: string
  email: string
  role: 'admin' | 'user' | 'viewer'
  status?: 'active' | 'inactive'
  emails_sent?: number
  emails_replied?: number
  response_rate?: number
  last_login_at?: string
  created_at?: string
}

interface CreateUserRequest {
  full_name: string
  email: string
  password: string
  role: 'admin' | 'user' | 'viewer'
}

interface UpdateUserRequest {
  full_name?: string
  role?: 'admin' | 'user' | 'viewer'
  status?: 'active' | 'inactive'
}

interface ApiResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
}

// Fonction utilitaire pour les réponses
function jsonResponse(data: ApiResponse, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    }
  )
}

serve(async (req: Request) => {
  // Gestion des requêtes OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return jsonResponse({ success: true })
  }

  try {
    // Initialisation du client Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérification de l'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse(
        { success: false, error: 'Token d\'authentification requis' },
        401
      )
    }

    // Vérifier le token utilisateur
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return jsonResponse(
        { success: false, error: 'Token invalide' },
        401
      )
    }

    // Récupérer le profil de l'utilisateur authentifié
    const { data: currentUserProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, status')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !currentUserProfile) {
      return jsonResponse(
        { success: false, error: 'Profil utilisateur non trouvé' },
        403
      )
    }

    // Vérifier si l'utilisateur est actif
    if (currentUserProfile.status !== 'active') {
      return jsonResponse(
        { success: false, error: 'Compte utilisateur inactif' },
        403
      )
    }

    const url = new URL(req.url)
    const method = req.method
    const pathParts = url.pathname.split('/').filter(Boolean)
    const userId = pathParts[pathParts.length - 1]

    // ====================================================================================================
    // GET: Récupérer la liste des utilisateurs
    // ====================================================================================================
    if (method === 'GET' && !userId.match(/^[0-9a-f-]{36}$/)) {
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '10')
      const role = url.searchParams.get('role') || null
      const status = url.searchParams.get('status') || null
      const search = url.searchParams.get('search') || null

      const offset = (page - 1) * limit

      let query = supabase
        .from('user_profiles')
        .select(`
          id,
          auth_user_id,
          full_name,
          email,
          role,
          status,
          emails_sent,
          emails_replied,
          response_rate,
          last_login_at,
          created_at
        `)

      // Filtres
      if (role) {
        query = query.eq('role', role)
      }
      if (status) {
        query = query.eq('status', status)
      }
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
      }

      // Pagination
      query = query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false })

      const { data: users, error, count } = await query

      if (error) {
        return jsonResponse(
          { success: false, error: 'Erreur lors de la récupération des utilisateurs' },
          500
        )
      }

      return jsonResponse({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total: count || users?.length || 0,
            totalPages: Math.ceil((count || 0) / limit)
          }
        }
      })
    }

    // ====================================================================================================
    // GET: Récupérer un utilisateur spécifique
    // ====================================================================================================
    if (method === 'GET' && userId.match(/^[0-9a-f-]{36}$/)) {
      const { data: userProfile, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          auth_user_id,
          full_name,
          email,
          role,
          status,
          emails_sent,
          emails_replied,
          response_rate,
          last_login_at,
          created_at
        `)
        .eq('id', userId)
        .single()

      if (error) {
        return jsonResponse(
          { success: false, error: 'Utilisateur non trouvé' },
          404
        )
      }

      return jsonResponse({
        success: true,
        data: userProfile
      })
    }

    // ====================================================================================================
    // POST: Créer un nouvel utilisateur
    // ====================================================================================================
    if (method === 'POST') {
      // Vérifier que l'utilisateur est admin
      if (currentUserProfile.role !== 'admin') {
        return jsonResponse(
          { success: false, error: 'Accès refusé - droits administrateur requis' },
          403
        )
      }

      const requestData: CreateUserRequest = await req.json()
      const { full_name, email, password, role } = requestData

      // Validation
      if (!full_name || !email || !password || !role) {
        return jsonResponse(
          { success: false, error: 'Tous les champs sont requis' },
          400
        )
      }

      if (!['admin', 'user', 'viewer'].includes(role)) {
        return jsonResponse(
          { success: false, error: 'Rôle invalide' },
          400
        )
      }

      if (password.length < 8) {
        return jsonResponse(
          { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' },
          400
        )
      }

      // Créer l'utilisateur dans auth.users
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: {
          full_name,
          role
        },
        email_confirm: true // Confirmer automatiquement l'email
      })

      if (authError || !authUser.user) {
        return jsonResponse(
          { success: false, error: `Erreur lors de la création: ${authError?.message}` },
          400
        )
      }

      // Le profil sera créé automatiquement par le trigger
      // Attendre un moment pour s'assurer que le trigger s'exécute
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Récupérer le profil créé
      const { data: newProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', authUser.user.id)
        .single()

      if (profileError) {
        console.error('Erreur profil:', profileError)
        // Le profil devrait être créé par le trigger, mais créons-le manuellement si nécessaire
        const { data: manualProfile, error: manualError } = await supabase
          .from('user_profiles')
          .insert({
            auth_user_id: authUser.user.id,
            full_name,
            email,
            role,
            status: 'active',
            created_by: user.id
          })
          .select()
          .single()

        if (manualError) {
          return jsonResponse(
            { success: false, error: 'Erreur lors de la création du profil' },
            500
          )
        }

        return jsonResponse({
          success: true,
          data: manualProfile,
          message: 'Utilisateur créé avec succès'
        })
      }

      return jsonResponse({
        success: true,
        data: newProfile,
        message: 'Utilisateur créé avec succès'
      })
    }

    // ====================================================================================================
    // PUT: Modifier un utilisateur
    // ====================================================================================================
    if (method === 'PUT' && userId.match(/^[0-9a-f-]{36}$/)) {
      const requestData: UpdateUserRequest = await req.json()
      const { full_name, role, status } = requestData

      // Vérifier les permissions
      const isAdmin = currentUserProfile.role === 'admin'
      const isOwnProfile = user.id === userId

      if (!isAdmin && !isOwnProfile) {
        return jsonResponse(
          { success: false, error: 'Accès refusé' },
          403
        )
      }

      // Les utilisateurs non-admin ne peuvent modifier que leur nom
      if (!isAdmin && (role || status)) {
        return jsonResponse(
          { success: false, error: 'Seuls les admins peuvent modifier le rôle et le statut' },
          403
        )
      }

      // Récupérer le profil existant
      const { data: existingProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (fetchError || !existingProfile) {
        return jsonResponse(
          { success: false, error: 'Utilisateur non trouvé' },
          404
        )
      }

      // Un admin ne peut pas désactiver son propre compte
      if (existingProfile.auth_user_id === user.id && status === 'inactive') {
        return jsonResponse(
          { success: false, error: 'Vous ne pouvez pas désactiver votre propre compte' },
          400
        )
      }

      // Préparer les données de mise à jour
      const updateData: Partial<UserProfile> = {}
      if (full_name) updateData.full_name = full_name
      if (role && isAdmin) updateData.role = role
      if (status && isAdmin) updateData.status = status

      // Mettre à jour le profil
      const { data: updatedProfile, error: updateError } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        return jsonResponse(
          { success: false, error: 'Erreur lors de la mise à jour' },
          500
        )
      }

      return jsonResponse({
        success: true,
        data: updatedProfile,
        message: 'Utilisateur mis à jour avec succès'
      })
    }

    // ====================================================================================================
    // DELETE: Supprimer un utilisateur
    // ====================================================================================================
    if (method === 'DELETE' && userId.match(/^[0-9a-f-]{36}$/)) {
      // Vérifier que l'utilisateur est admin
      if (currentUserProfile.role !== 'admin') {
        return jsonResponse(
          { success: false, error: 'Accès refusé - droits administrateur requis' },
          403
        )
      }

      // Récupérer le profil à supprimer
      const { data: profileToDelete, error: fetchError } = await supabase
        .from('user_profiles')
        .select('auth_user_id')
        .eq('id', userId)
        .single()

      if (fetchError || !profileToDelete) {
        return jsonResponse(
          { success: false, error: 'Utilisateur non trouvé' },
          404
        )
      }

      // Un admin ne peut pas supprimer son propre compte
      if (profileToDelete.auth_user_id === user.id) {
        return jsonResponse(
          { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' },
          400
        )
      }

      // Supprimer l'utilisateur (cascade delete pour le profil)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        profileToDelete.auth_user_id
      )

      if (deleteError) {
        return jsonResponse(
          { success: false, error: 'Erreur lors de la suppression' },
          500
        )
      }

      return jsonResponse({
        success: true,
        message: 'Utilisateur supprimé avec succès'
      })
    }

    // Route non trouvée
    return jsonResponse(
      { success: false, error: 'Route non trouvée' },
      404
    )

  } catch (error) {
    console.error('Erreur Edge Function:', error)
    return jsonResponse(
      { success: false, error: 'Erreur interne du serveur' },
      500
    )
  }
})