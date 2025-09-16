// ====================================================================================================
// USER SERVICE
// ====================================================================================================
// Description: Service client pour interagir avec l'Edge Function user-management
// ====================================================================================================

import { createClient } from '@/utils/supabase/client'

export interface UserProfile {
  id: string
  auth_user_id: string
  full_name: string
  email: string
  role: 'admin' | 'user' | 'viewer'
  status: 'active' | 'inactive'
  emails_sent: number
  emails_replied: number
  response_rate: number
  last_login_at: string | null
  created_at: string
}

export interface CreateUserData {
  full_name: string
  email: string
  password: string
  role: 'admin' | 'user' | 'viewer'
}

export interface UpdateUserData {
  full_name?: string
  role?: 'admin' | 'user' | 'viewer'
  status?: 'active' | 'inactive'
}

export interface UsersResponse {
  users: UserProfile[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class UserService {
  private supabase = createClient()

  private async getAuthToken(): Promise<string> {
    const { data: { session } } = await this.supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Non authentifié')
    }
    return session.access_token
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = await this.getAuthToken()
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const url = `${baseUrl}/functions/v1/user-management${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Erreur réseau' }))
      throw new Error(errorData.error || `Erreur HTTP: ${response.status}`)
    }

    return response.json()
  }

  // ====================================================================================================
  // GET: Récupérer la liste des utilisateurs
  // ====================================================================================================
  async getUsers(params: {
    page?: number
    limit?: number
    role?: 'admin' | 'user' | 'viewer'
    status?: 'active' | 'inactive'
    search?: string
  } = {}): Promise<UsersResponse> {
    const searchParams = new URLSearchParams()

    if (params.page) searchParams.set('page', params.page.toString())
    if (params.limit) searchParams.set('limit', params.limit.toString())
    if (params.role) searchParams.set('role', params.role)
    if (params.status) searchParams.set('status', params.status)
    if (params.search) searchParams.set('search', params.search)

    const endpoint = searchParams.toString() ? `?${searchParams}` : ''
    const response = await this.makeRequest<UsersResponse>(endpoint)

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des utilisateurs')
    }

    return response.data
  }

  // ====================================================================================================
  // GET: Récupérer un utilisateur spécifique
  // ====================================================================================================
  async getUser(userId: string): Promise<UserProfile> {
    const response = await this.makeRequest<UserProfile>(`/${userId}`)

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Utilisateur non trouvé')
    }

    return response.data
  }

  // ====================================================================================================
  // POST: Créer un nouvel utilisateur
  // ====================================================================================================
  async createUser(userData: CreateUserData): Promise<UserProfile> {
    const response = await this.makeRequest<UserProfile>('', {
      method: 'POST',
      body: JSON.stringify(userData),
    })

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la création de l\'utilisateur')
    }

    return response.data
  }

  // ====================================================================================================
  // PUT: Modifier un utilisateur
  // ====================================================================================================
  async updateUser(userId: string, userData: UpdateUserData): Promise<UserProfile> {
    const response = await this.makeRequest<UserProfile>(`/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la modification de l\'utilisateur')
    }

    return response.data
  }

  // ====================================================================================================
  // DELETE: Supprimer un utilisateur
  // ====================================================================================================
  async deleteUser(userId: string): Promise<void> {
    const response = await this.makeRequest(`/${userId}`, {
      method: 'DELETE',
    })

    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la suppression de l\'utilisateur')
    }
  }

  // ====================================================================================================
  // Utilitaires
  // ====================================================================================================

  // Changer le statut d'un utilisateur (activer/désactiver)
  async toggleUserStatus(userId: string, status: 'active' | 'inactive'): Promise<UserProfile> {
    return this.updateUser(userId, { status })
  }

  // Changer le rôle d'un utilisateur
  async changeUserRole(userId: string, role: 'admin' | 'user' | 'viewer'): Promise<UserProfile> {
    return this.updateUser(userId, { role })
  }

  // Obtenir les statistiques globales des utilisateurs
  async getUserStats(): Promise<{
    total: number
    active: number
    inactive: number
    admins: number
    users: number
    viewers: number
  }> {
    const allUsers = await this.getUsers({ limit: 1000 }) // Récupérer tous les utilisateurs
    const users = allUsers.users

    return {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      inactive: users.filter(u => u.status === 'inactive').length,
      admins: users.filter(u => u.role === 'admin').length,
      users: users.filter(u => u.role === 'user').length,
      viewers: users.filter(u => u.role === 'viewer').length,
    }
  }

  // Rechercher des utilisateurs
  async searchUsers(query: string, filters?: {
    role?: 'admin' | 'user' | 'viewer'
    status?: 'active' | 'inactive'
  }): Promise<UserProfile[]> {
    const result = await this.getUsers({
      search: query,
      role: filters?.role,
      status: filters?.status,
      limit: 50,
    })

    return result.users
  }
}

// Export d'une instance singleton
export const userService = new UserService()
export default userService