import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailsDashboardTable } from "@/components/dashboard/emails-dashboard-table";
import { RealtimeDebug } from "@/components/dashboard/realtime-debug";
import { RealtimeStats } from "@/components/dashboard/realtime-stats";

export default function DashboardPage() {
  return (
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
  );
}