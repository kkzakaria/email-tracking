"use client"

import { useRealtime } from "./realtime-provider"
import { EmailsTable } from "./emails-table"

export function EmailsDashboardTable() {
  const { emails, isLoading, refreshData } = useRealtime()

  return (
    <EmailsTable 
      data={emails} 
      onRefresh={refreshData}
      isLoading={isLoading}
    />
  )
}