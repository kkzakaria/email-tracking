// supabase/functions/_shared/cors.ts

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // En production, remplacez par votre domaine
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

/**
 * Types pour le body de la réponse
 */
type ResponseBody = string | object | number | boolean | null

/**
 * Helper pour gérer les requêtes OPTIONS (preflight CORS)
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

/**
 * Helper pour créer une réponse avec les headers CORS
 */
export function createCorsResponse(
  body: ResponseBody,
  init?: ResponseInit
): Response {
  const response = new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      ...init,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    }
  )
  return response
}