import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { User, RefreshCw, FileText, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscriptionManager } from "@/components/dashboard/subscription-manager";
import { EmailHistorySync } from "@/components/dashboard/email-history-sync";
import UsersTable from "@/components/dashboard/users-table";
import { ReminderConfiguration } from "@/components/dashboard/reminder-configuration";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tabs for different settings categories */}
        <Tabs defaultValue="users" className="w-full">
          <div className="sticky top-12 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900 pt-2 pb-2">
            <TabsList className="grid w-full grid-cols-4 h-10 p-1 bg-white dark:bg-gray-800 shadow-sm">
            <TabsTrigger value="users" className="flex items-center justify-center gap-2 data-[state=active]:bg-gray-900 dark:data-[state=active]:bg-white data-[state=active]:text-white dark:data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Utilisateurs</span>
            </TabsTrigger>
            <TabsTrigger value="reminders" className="flex items-center justify-center gap-2 data-[state=active]:bg-gray-900 dark:data-[state=active]:bg-white data-[state=active]:text-white dark:data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Relances</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center justify-center gap-2 data-[state=active]:bg-gray-900 dark:data-[state=active]:bg-white data-[state=active]:text-white dark:data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center justify-center gap-2 data-[state=active]:bg-gray-900 dark:data-[state=active]:bg-white data-[state=active]:text-white dark:data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Système</span>
            </TabsTrigger>
            </TabsList>
          </div>

          {/* Users Tab Content */}
          <TabsContent value="users" className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
            <UsersTable />
          </TabsContent>

          {/* Reminders Tab Content */}
          <TabsContent value="reminders" className="px-4 sm:px-6 lg:px-8 pb-8">
            <ReminderConfiguration />
          </TabsContent>

          {/* Templates Tab Content */}
          <TabsContent value="templates" className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Templates d'emails</CardTitle>
                <CardDescription>
                  Créez et gérez vos modèles d'emails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <div className="flex items-center gap-3 mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Fonctionnalités à venir</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                      Bibliothèque de templates prédéfinis
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                      Éditeur de templates avec aperçu en temps réel
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                      Variables dynamiques (nom, entreprise, date, etc.)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                      Templates pour différents contextes (relance, suivi, remerciement)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                      Import/Export de templates
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                      Versioning et historique des modifications
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                      Templates multilingues
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab Content */}
          <TabsContent value="system" className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
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