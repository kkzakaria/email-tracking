import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { DashboardStatsRealtime } from "@/components/dashboard-stats-realtime";
import { EmailsTableWrapper } from "@/components/emails-table-wrapper";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Récupérer les statistiques depuis la vue email_stats
  let emailStats = {
    pending_emails: 0,
    replied_emails: 0,
    failed_emails: 0,
    expired_emails: 0,
    total_emails: 0
  };

  let emails: any[] = [];

  try {
    // Statistiques depuis la nouvelle vue
    const { data: stats } = await supabase
      .from('email_stats')
      .select('*')
      .single();
    
    if (stats) {
      emailStats = stats;
    }
    
    // Récupérer les emails trackés
    const { data: emailData } = await supabase
      .from('tracked_emails')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);
      
    if (emailData) {
      emails = emailData;
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Statistics Cards */}
          <div className="mb-4">
            <DashboardStatsRealtime 
              initialStats={{
                PENDING: emailStats.pending_emails,
                REPLIED: emailStats.replied_emails,
                FAILED: emailStats.failed_emails,
                EXPIRED: emailStats.expired_emails
              }} 
              initialTotal={emailStats.total_emails} 
            />
          </div>

          {/* Email Tracking Table - Display Only */}
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