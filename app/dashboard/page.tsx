import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Mail, Clock, CheckCircle, AlertCircle, Plus, RefreshCw, Webhook } from "lucide-react";
import { getEmailStats, getEmailTrackings } from "@/lib/supabase/email-service";
import { MicrosoftConnectCard } from "@/components/dashboard/microsoft-connect-card";
import { OutlookSyncButton } from "@/components/dashboard/outlook-sync-button";
import { TrackingStatus } from "@/components/dashboard/tracking-status";
import Link from "next/link";

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="mt-2 text-gray-600">
            Bienvenue {user.user_metadata?.full_name || user.email}
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Emails suivis</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalEmails}</p>
              </div>
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">En attente</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{emailStats.PENDING}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Répondus</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{emailStats.REPLIED}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Arrêtés</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{emailStats.STOPPED}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Microsoft Connection Card */}
        <div className="mb-8">
          <MicrosoftConnectCard />
        </div>

        {/* Tracking Status */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Statut du système</h3>
            <TrackingStatus />
          </div>
        </div>

        {/* Email Tracking Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Emails suivis</h2>
              <div className="flex items-center gap-3">
                <OutlookSyncButton />
                <Link 
                  href="/dashboard/webhooks"
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Webhook className="w-4 h-4" />
                  Webhooks
                </Link>
                <Link 
                  href="/dashboard/compose"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Composer un email
                </Link>
              </div>
            </div>
          </div>

          <div className="p-6">
            {emails.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucun email suivi pour le moment</p>
                <p className="text-sm text-gray-400 mt-1 mb-4">
                  Commencez par composer et envoyer votre premier email tracké
                </p>
                <Link 
                  href="/dashboard/compose"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Composer un email
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Destinataire
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sujet
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Envoyé le
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {emails.map((email) => (
                      <tr key={email.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {email.recipient_email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">
                          {email.subject}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            email.status === 'REPLIED' 
                              ? 'bg-green-100 text-green-800'
                              : email.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : email.status === 'STOPPED'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {email.status === 'REPLIED' && 'Répondu'}
                            {email.status === 'PENDING' && 'En attente'}
                            {email.status === 'STOPPED' && 'Arrêté'}
                            {email.status === 'EXPIRED' && 'Expiré'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(email.sent_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}