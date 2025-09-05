"use client"

import { EmailsTable } from "@/components/emails-table"
import { EmailTracking } from "@/lib/supabase/email-service"
import { 
  useEmailTrackings, 
  useDeleteEmailTrackings, 
  useStopEmailTrackings 
} from "@/hooks/use-email-tracking"
import { EmailsTableSkeleton } from "@/components/emails-table-skeleton"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmailsTableWrapperProps {
  initialData?: EmailTracking[]
}

export function EmailsTableWrapper({ initialData }: EmailsTableWrapperProps) {
  // Hooks React Query avec temps réel
  const { data: emails = [], isLoading, error, refetch } = useEmailTrackings(initialData)
  const deleteEmailsMutation = useDeleteEmailTrackings()
  const stopEmailsMutation = useStopEmailTrackings()

  const handleDelete = async (ids: string[]) => {
    try {
      await deleteEmailsMutation.mutateAsync(ids)
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
    }
  };

  const handleStop = async (ids: string[]) => {
    try {
      await stopEmailsMutation.mutateAsync(ids)
    } catch (error) {
      console.error('Erreur lors de l\'arrêt:', error)
    }
  };

  const handleView = (email: EmailTracking) => {
    // TODO: Implémenter la vue détaillée
    console.log('Voir email:', email);
  };

  // Bouton de rafraîchissement manuel
  const RefreshButton = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => refetch()}
      disabled={isLoading}
      className="gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      Actualiser
    </Button>
  )

  // États de chargement et d'erreur
  if (isLoading && !initialData) {
    return <EmailsTableSkeleton />
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          Erreur lors du chargement des emails
        </div>
        <Button onClick={() => refetch()} variant="outline">
          Réessayer
        </Button>
      </div>
    )
  }

  return (
    <EmailsTable
      data={emails}
      onDelete={handleDelete}
      onStop={handleStop}
      onView={handleView}
      isLoading={isLoading}
      headerActions={<RefreshButton />}
    />
  );
}