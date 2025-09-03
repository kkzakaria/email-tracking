import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getEmailStats, getEmailTrackings } from "@/lib/supabase/email-service";
import { EmailsTableWrapper } from "@/components/emails-table-wrapper";
import { DashboardStats } from "@/components/dashboard-stats";
import { TooltipProvider } from "@/components/ui/tooltip";

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

  let emails: Array<{
    id: string
    recipient_email: string
    subject: string
    status: string
    sent_at: string
  }> = [];

  try {
    // Récupérer les statistiques
    emailStats = await getEmailStats();
    
    // Récupérer la liste des emails
    emails = await getEmailTrackings();
  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
  }
  
  const totalEmails = Object.values(emailStats).reduce((a, b) => a + b, 0);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tableau de bord</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Bienvenue {user.user_metadata?.full_name || user.email}
            </p>
          </div>

        {/* Statistics Cards */}
        <div className="mb-8">
          <DashboardStats 
            emailStats={emailStats} 
            totalEmails={totalEmails} 
          />
        </div>

        {/* Email Tracking Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Emails suivis</h2>
              {/* Les boutons d'actions sont maintenant intégrés dans le tableau */}
            </div>
          </div>

          <div className="p-0">
            <EmailsTableWrapper data={emails} />
          </div>
        </div>
        </div>
      </div>
    </TooltipProvider>
  );
}