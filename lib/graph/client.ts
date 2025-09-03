import { Client } from "@microsoft/microsoft-graph-client";
import { createClient } from "@/utils/supabase/server";

/**
 * Creates an authenticated Microsoft Graph client using Supabase stored tokens
 */
export async function createGraphClient(): Promise<Client | null> {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("No authenticated user available");
    return null;
  }

  // Get Microsoft Graph access token from user metadata or separate table
  // This would need to be stored during the OAuth flow
  const microsoftToken = user.user_metadata?.microsoft_access_token;
  
  if (!microsoftToken) {
    console.error("No Microsoft Graph access token available for user");
    return null;
  }

  try {
    const client = Client.init({
      authProvider: (done) => {
        done(null, microsoftToken);
      },
    });

    return client;
  } catch (error) {
    console.error("Error creating Graph client:", error);
    return null;
  }
}

/**
 * Creates a Graph client with a provided access token (for API routes)
 */
export function createGraphClientWithToken(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}