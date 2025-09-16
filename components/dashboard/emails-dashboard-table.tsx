"use client"

import { useRealtime } from "./realtime-provider"
import { EmailsTable } from "./emails-table"

export function EmailsDashboardTable() {
  const { emails, isLoading, refreshData } = useRealtime()

  console.log('📊 EmailsDashboardTable: emails from useRealtime:', emails.length)

  return (
    <EmailsTable
      data={emails}
      onRefresh={refreshData}
      isLoading={isLoading}
    />
  )
}