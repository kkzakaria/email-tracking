import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionManager } from "@/components/dashboard/subscription-manager";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au dashboard
          </Link>
          
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Paramètres</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Gestion des subscriptions Microsoft Graph pour le suivi des emails
            </p>
          </div>
        </div>

        {/* Subscription Management */}
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions Microsoft Graph</CardTitle>
          </CardHeader>
          <CardContent>
            <SubscriptionManager />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}