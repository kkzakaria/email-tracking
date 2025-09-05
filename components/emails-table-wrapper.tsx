"use client"

import { EmailsTable } from "@/components/emails-table"
import { EmailTracking } from "@/lib/supabase/email-service"

interface EmailsTableWrapperProps {
  data: EmailTracking[]
}

export function EmailsTableWrapper({ data }: EmailsTableWrapperProps) {
  const handleDelete = async (ids: string[]) => {
    // TODO: Implémenter la suppression des emails
    console.log('Supprimer emails:', ids);
  };

  const handleStop = async (ids: string[]) => {
    // TODO: Implémenter l'arrêt des emails
    console.log('Arrêter emails:', ids);
  };

  const handleView = (email: EmailTracking) => {
    // TODO: Implémenter la vue détaillée
    console.log('Voir email:', email);
  };

  return (
    <EmailsTable
      data={data}
      onDelete={handleDelete}
      onStop={handleStop}
      onView={handleView}
    />
  );
}