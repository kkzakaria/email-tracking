import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Mail, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Note: Ces requêtes seront fonctionnelles une fois la DB Supabase configurée
  // Pour l'instant, on utilise des valeurs par défaut
  const emailStats = {
    PENDING: 0,
    REPLIED: 0,
    STOPPED: 0,
    EXPIRED: 0
  };
  
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

        {/* Email Tracking Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Emails suivis</h2>
              <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Ajouter un email
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucun email suivi pour le moment</p>
              <p className="text-sm text-gray-400 mt-1">
                Commencez par ajouter un email à suivre
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}