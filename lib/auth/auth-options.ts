import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    {
      id: "microsoft-entra-id",
      name: "Microsoft",
      type: "oauth",
      authorization: {
        url: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize`,
        params: {
          scope: "openid profile email offline_access User.Read Mail.Read Mail.Send Mail.ReadWrite",
          response_type: "code",
        },
      },
      token: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
      userinfo: "https://graph.microsoft.com/v1.0/me",
      profile(profile) {
        return {
          id: profile.id,
          name: profile.displayName || profile.userPrincipalName,
          email: profile.mail || profile.userPrincipalName,
          image: null,
        };
      },
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
    },
  ],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, user }) {
      if (session?.user) {
        session.user.id = user.id;
      }
      
      // Get the Microsoft token from the account
      const account = await prisma.account.findFirst({
        where: {
          userId: user.id,
          provider: "microsoft-entra-id",
        },
      });

      if (account) {
        // Check if token is expired and refresh if needed
        const now = Math.floor(Date.now() / 1000);
        if (account.expires_at && account.expires_at < now && account.refresh_token) {
          try {
            const refreshedTokens = await refreshAccessToken(account.refresh_token);
            
            // Update the account with new tokens
            await prisma.account.update({
              where: { id: account.id },
              data: {
                access_token: refreshedTokens.access_token,
                expires_at: refreshedTokens.expires_at,
                refresh_token: refreshedTokens.refresh_token || account.refresh_token,
              },
            });

            // Add the fresh token to session
            session.accessToken = refreshedTokens.access_token;
          } catch (error) {
            console.error("Error refreshing access token", error);
            // Token refresh failed, user will need to re-authenticate
            session.error = "RefreshAccessTokenError";
          }
        } else {
          session.accessToken = account.access_token;
        }
      }

      return session;
    },
    async signIn({ account, profile }) {
      if (!profile?.email) {
        return false;
      }
      return true;
    },
  },
  pages: {
    signIn: "/login",
    signOut: "/logout",
    error: "/auth/error",
  },
  debug: process.env.NODE_ENV === "development",
};

async function refreshAccessToken(refreshToken: string) {
  try {
    const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID!,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "openid profile email offline_access User.Read Mail.Read Mail.Send Mail.ReadWrite",
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      access_token: refreshedTokens.access_token,
      expires_at: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
      refresh_token: refreshedTokens.refresh_token,
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    throw new Error("RefreshAccessTokenError");
  }
}