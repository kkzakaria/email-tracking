import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { User, RefreshCw, FileText, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscriptionManager } from "@/components/dashboard/subscription-manager";
import MicrosoftOAuth from "@/components/dashboard/microsoft-oauth";
import { EmailHistorySync } from "@/components/dashboard/email-history-sync";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs for different settings categories */}
        <Tabs defaultValue="system" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="users" disabled className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="reminders" disabled className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Relances
            </TabsTrigger>
            <TabsTrigger value="templates" disabled className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Système
            </TabsTrigger>
          </TabsList>

          {/* Users Tab Content */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des utilisateurs</CardTitle>
                <CardDescription>
                  Cette section sera bientôt disponible
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 dark:text-gray-400">
                  Gérez les utilisateurs, leurs permissions et leurs accès.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reminders Tab Content */}
          <TabsContent value="reminders">
            <Card>
              <CardHeader>
                <CardTitle>Configuration des relances</CardTitle>
                <CardDescription>
                  Cette section sera bientôt disponible
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 dark:text-gray-400">
                  Configurez les règles de relance automatique et les délais.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab Content */}
          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Templates d'emails</CardTitle>
                <CardDescription>
                  Cette section sera bientôt disponible
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 dark:text-gray-400">
                  Créez et gérez vos modèles d'emails pour les relances.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab Content */}
          <TabsContent value="system" className="space-y-6">
            {/* Microsoft OAuth Connection */}
            <MicrosoftOAuth />
            
            {/* Email History Sync */}
            <EmailHistorySync />
            
            {/* Subscription Management */}
            <Card>
              <CardHeader>
                <CardTitle>Subscriptions Microsoft Graph</CardTitle>
                <CardDescription>
                  Gérez les webhooks de réception des emails et leur renouvellement automatique
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriptionManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}