import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getEmailStats, getEmailTrackings, EmailTracking } from "@/lib/supabase/email-service";
import { EmailsTableWrapper } from "@/components/emails-table-wrapper";
import { DashboardStatsRealtime } from "@/components/dashboard-stats-realtime";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { OutlookSyncButton } from "@/components/dashboard/outlook-sync-button";
import { DashboardActionButtons } from "@/components/dashboard-action-buttons";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Récupérer les statistiques et emails directement depuis le service
  let emailStats = {
    PENDING: 0,
    REPLIED: 0,
    STOPPED: 0,
    EXPIRED: 0
  };

  let emails: EmailTracking[] = [];

  try {
    // Récupérer les statistiques
    emailStats = await getEmailStats() as {
      PENDING: number;
      REPLIED: number;
      STOPPED: number;
      EXPIRED: number;
    };
    
    // Récupérer la liste des emails
    emails = await getEmailTrackings();
  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
  }
  
  const totalEmails = Object.values(emailStats).reduce((a, b) => a + b, 0);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Statistics Cards */}
        <div className="mb-4">
          <DashboardStatsRealtime 
            initialStats={emailStats} 
            initialTotal={totalEmails} 
          />
        </div>

        {/* Action Buttons - Always visible */}
        <div className="flex gap-2 mb-4">
          <OutlookSyncButton />
          <DashboardActionButtons />
        </div>

        {/* Email Tracking Table */}
        <Card>
          <CardContent className="px-6 py-0">
            <EmailsTableWrapper initialData={emails} />
          </CardContent>
        </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}