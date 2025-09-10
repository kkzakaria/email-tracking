import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RealtimeProvider } from "@/components/dashboard/realtime-provider";
import { EmailsDashboardTable } from "@/components/dashboard/emails-dashboard-table";
import { RealtimeDebug } from "@/components/dashboard/realtime-debug";
import { RealtimeStats } from "@/components/dashboard/realtime-stats";
import { NavigationBar } from "@/components/navigation-bar";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  let emails: any[] = [];

  try {
    // Récupérer les emails trackés pour l'initialisation
    const { data: emailData } = await supabase
      .from('tracked_emails')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(1000);
      
    if (emailData) {
      emails = emailData;
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
  }

  // Récupérer les informations utilisateur pour la navigation
  const userInfo = user ? {
    email: user.email || undefined,
    name: user.user_metadata?.name || undefined,
    image: user.user_metadata?.avatar_url || undefined
  } : undefined

  return (
    <TooltipProvider>
      <RealtimeProvider initialEmails={emails}>
        <div className="min-h-screen bg-background">
          {/* Navigation Bar */}
          <NavigationBar user={userInfo} />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Realtime Debug Info */}
            <div className="mb-4">
              <RealtimeDebug />
            </div>

            {/* Statistics Cards - Now with Realtime updates */}
            <div className="mb-6">
              <RealtimeStats />
            </div>

            {/* Email Tracking Table */}
            <Card>
              <CardHeader>
                <CardTitle>Emails suivis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Tableau des emails envoyés avec suivi en temps réel
                </p>
              </CardHeader>
              <CardContent className="px-6 py-0">
                <EmailsDashboardTable />
              </CardContent>
            </Card>
          </div>
        </div>
      </RealtimeProvider>
    </TooltipProvider>
  );
}