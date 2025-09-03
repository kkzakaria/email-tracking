import { Client } from "@microsoft/microsoft-graph-client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";

/**
 * Creates an authenticated Microsoft Graph client
 */
export async function createGraphClient(): Promise<Client | null> {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    console.error("No access token available in session");
    return null;
  }

  try {
    const client = Client.init({
      authProvider: (done) => {
        done(null, session.accessToken!);
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