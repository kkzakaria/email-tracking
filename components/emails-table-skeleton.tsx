import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/**
 * Skeleton de chargement pour le tableau d'emails
 */
export function EmailsTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-60" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Table skeleton */}
      <div className="bg-background overflow-hidden rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-7">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              <TableHead className="w-60">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-80">
                <Skeleton className="h-4 w-12" />
              </TableHead>
              <TableHead className="w-28">
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead className="w-40">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-16">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 5 rows de skeleton */}
            {Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-64" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 rounded-md" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between gap-8">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
    </div>
  )
}