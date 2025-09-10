import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailsDashboardTable } from "@/components/dashboard/emails-dashboard-table";
import { RealtimeStats } from "@/components/dashboard/realtime-stats";

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Statistics Cards - Now with Realtime updates */}
      <div className="mb-6">
        <RealtimeStats />
      </div>

      {/* Email Tracking Table */}
      <Card>
        <CardContent className="px-6 py-0">
          <EmailsDashboardTable />
        </CardContent>
      </Card>
    </div>
  );
}