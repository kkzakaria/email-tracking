import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RealtimeProvider } from "@/components/dashboard/realtime-provider";
import { EmailsDashboardTable } from "@/components/dashboard/emails-dashboard-table";
import { RealtimeDebug } from "@/components/dashboard/realtime-debug";
import { RealtimeStats } from "@/components/dashboard/realtime-stats";
import { ModeToggle } from "@/components/mode-toggle";
import { MailIcon, Settings } from "lucide-react";
import Link from "next/link";

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

  return (
    <TooltipProvider>
      <RealtimeProvider initialEmails={emails}>
        <div className="min-h-screen bg-background">
          {/* Header */}
          <div className="border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <MailIcon className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">Email Tracking</h1>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Link
                    href="/dashboard/settings"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  >
                    <Settings className="h-4 w-4" />
                    Paramètres
                  </Link>
                  <ModeToggle />
                </div>
              </div>
            </div>
          </div>

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