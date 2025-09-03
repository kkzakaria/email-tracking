import { Client } from "@microsoft/microsoft-graph-client";
import { getMicrosoftToken } from "@/lib/microsoft/graph-helper";

/**
 * Creates an authenticated Microsoft Graph client using Supabase stored tokens
 */
export async function createGraphClient(): Promise<Client | null> {
  // Get the access token (will auto-refresh if needed)
  const accessToken = await getMicrosoftToken();
  
  if (!accessToken) {
    console.error("No Microsoft Graph access token available for user");
    return null;
  }

  try {
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
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