"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import {
  ChevronDownIcon,
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleXIcon,
  Columns3Icon,
  EllipsisIcon,
  FilterIcon,
  ListFilterIcon,
  Mail,
  PlusIcon,
  Shield,
  TrashIcon,
  User,
  UserCog,
  UserX,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { userService, type UserProfile, type CreateUserData } from "@/lib/services/user-service"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { AddUserModal } from "@/components/dashboard/add-user-modal"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type UserItem = {
  id: string
  name: string
  email: string
  role: "admin" | "user" | "viewer"
  status: "active" | "inactive"
  lastLogin: string | null
  emailsSent: number
  responseRate: number
}

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<UserItem> = (row, columnId, filterValue) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.email}`.toLowerCase()
  const searchTerm = (filterValue ?? "").toLowerCase()
  return searchableRowContent.includes(searchTerm)
}

const statusFilterFn: FilterFn<UserItem> = (
  row,
  columnId,
  filterValue: string[]
) => {
  if (!filterValue?.length) return true
  const status = row.getValue(columnId) as string
  return filterValue.includes(status)
}

const roleFilterFn: FilterFn<UserItem> = (
  row,
  columnId,
  filterValue: string[]
) => {
  if (!filterValue?.length) return true
  const role = row.getValue(columnId) as string
  return filterValue.includes(role)
}

export default function UsersTable() {
  const id = useId()
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const inputRef = useRef<HTMLInputElement>(null)

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "name",
      desc: false,
    },
  ])

  // États pour les données réelles
  const [data, setData] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalUsers, setTotalUsers] = useState(0)

  // Fonction pour transformer UserProfile en UserItem pour le tableau
  const transformUser = (user: UserProfile): UserItem => ({
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLogin: user.last_login_at,
    emailsSent: user.emails_sent,
    responseRate: user.response_rate
  })

  // Charger les utilisateurs
  const fetchUsers = async (searchFilter = "", statusFilter: string[] = [], roleFilter: string[] = []) => {
    try {
      setLoading(true)
      setError(null)

      const result = await userService.getUsers({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: searchFilter || undefined,
        status: statusFilter.length === 1 ? statusFilter[0] as 'active' | 'inactive' : undefined,
        role: roleFilter.length === 1 ? roleFilter[0] as 'admin' | 'user' | 'viewer' : undefined,
      })

      setData(result.users.map(transformUser))
      setTotalUsers(result.pagination.total)
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      toast.error('Erreur lors du chargement des utilisateurs')
    } finally {
      setLoading(false)
    }
  }

  // Charger les utilisateurs au montage et quand les paramètres changent
  useEffect(() => {
    fetchUsers()
  }, [pagination.pageIndex, pagination.pageSize])

  // Recharger quand les filtres changent avec debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (pagination.pageIndex === 0) {
        // Extraire les filtres des états
        const searchFilter = columnFilters.find(f => f.id === "name")?.value as string || ""
        const statusFilter = columnFilters.find(f => f.id === "status")?.value as string[] || []
        const roleFilter = columnFilters.find(f => f.id === "role")?.value as string[] || []

        fetchUsers(searchFilter, statusFilter, roleFilter)
      } else {
        setPagination({ ...pagination, pageIndex: 0 })
      }
    }, 500)

    return () => clearTimeout(timeout)
  }, [columnFilters])

  const handleDeleteRows = async () => {
    const selectedRows = table.getSelectedRowModel().rows
    const userIds = selectedRows.map((row) => row.original.id)

    try {
      setLoading(true)

      // Supprimer tous les utilisateurs sélectionnés
      await Promise.all(userIds.map(id => userService.deleteUser(id)))

      // Recharger les données
      await fetchUsers()
      table.resetRowSelection()

      toast.success(`${userIds.length} utilisateur${userIds.length > 1 ? 's supprimés' : ' supprimé'}`)
    } catch (err) {
      console.error('Erreur lors de la suppression:', err)
      toast.error('Erreur lors de la suppression')
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (newUser: CreateUserData) => {
    try {
      setLoading(true)
      await userService.createUser({
        full_name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role.toLowerCase() as 'admin' | 'user' | 'viewer'
      })

      // Recharger les données
      await fetchUsers()
      toast.success('Utilisateur créé avec succès')
    } catch (err) {
      console.error('Erreur lors de la création:', err)
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async (userId: string, updateData: { status?: 'active' | 'inactive'; role?: 'admin' | 'user' | 'viewer' }) => {
    try {
      await userService.updateUser(userId, updateData)

      // Recharger les données
      await fetchUsers()

      const actionText = updateData.status ? 'Statut mis à jour' : 'Rôle mis à jour'
      toast.success(actionText)
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err)
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await userService.deleteUser(userId)

      // Recharger les données
      await fetchUsers()
      toast.success('Utilisateur supprimé avec succès')
    } catch (err) {
      console.error('Erreur lors de la suppression:', err)
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    }
  }

  const columns: ColumnDef<UserItem>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Sélectionner tout"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Sélectionner la ligne"
      />
    ),
    size: 28,
    enableSorting: false,
    enableHiding: false,
  },
  {
    header: "Nom",
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="font-medium">{row.getValue("name")}</div>
      </div>
    ),
    size: 200,
    filterFn: multiColumnFilterFn,
    enableHiding: false,
  },
  {
    header: "Email",
    accessorKey: "email",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Mail className="h-3 w-3 text-gray-400" />
        <span className="text-sm">{row.getValue("email")}</span>
      </div>
    ),
    size: 250,
  },
  {
    header: "Rôle",
    accessorKey: "role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string
      const roleLabels = {
        admin: "Admin",
        user: "Utilisateur",
        viewer: "Lecteur"
      }
      const icon = role === "admin" ? Shield : role === "user" ? UserCog : User
      const Icon = icon
      return (
        <Badge
          variant={role === "admin" ? "default" : "secondary"}
          className="gap-1"
        >
          <Icon className="h-3 w-3" />
          {roleLabels[role as keyof typeof roleLabels]}
        </Badge>
      )
    },
    size: 120,
    filterFn: roleFilterFn,
  },
  {
    header: "Statut",
    accessorKey: "status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const statusLabels = {
        active: "Actif",
        inactive: "Inactif"
      }
      return (
        <Badge
          className={cn(
            status === "inactive" && "bg-gray-500 text-white hover:bg-gray-600",
            status === "active" && "bg-green-500 text-white hover:bg-green-600"
          )}
        >
          {statusLabels[status as keyof typeof statusLabels]}
        </Badge>
      )
    },
    size: 100,
    filterFn: statusFilterFn,
  },
  {
    header: "Dernière connexion",
    accessorKey: "lastLogin",
    cell: ({ row }) => {
      const lastLogin = row.getValue("lastLogin") as string | null
      if (!lastLogin) {
        return (
          <span className="text-sm text-gray-500 dark:text-gray-400 italic">
            Jamais
          </span>
        )
      }
      const date = new Date(lastLogin)
      return (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {date.toLocaleDateString('fr-FR')}
        </span>
      )
    },
    size: 140,
  },
  // TODO: À réactiver plus tard
  // {
  //   header: "Emails envoyés",
  //   accessorKey: "emailsSent",
  //   cell: ({ row }) => (
  //     <span className="font-mono text-sm">{row.getValue("emailsSent")}</span>
  //   ),
  //   size: 120,
  // },
  // {
  //   header: "Taux de réponse",
  //   accessorKey: "responseRate",
  //   cell: ({ row }) => {
  //     const rate = row.getValue("responseRate") as number
  //     return (
  //       <div className="flex items-center gap-2">
  //         <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
  //           <div
  //             className={cn(
  //               "h-2 rounded-full",
  //               rate >= 70 ? "bg-green-500" : rate >= 40 ? "bg-yellow-500" : "bg-red-500"
  //             )}
  //             style={{ width: `${rate}%` }}
  //           />
  //         </div>
  //         <span className="text-sm font-medium">{rate}%</span>
  //       </div>
  //     )
  //   },
  //   size: 140,
  // },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row} onUpdate={handleUpdateUser} onDelete={handleDeleteUser} />,
    size: 60,
    enableHiding: false,
  },
]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: Math.ceil(totalUsers / pagination.pageSize),
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
    },
  })

  // Get unique status values
  const uniqueStatusValues = useMemo(() => {
    const statusColumn = table.getColumn("status")
    if (!statusColumn) return []
    const values = Array.from(statusColumn.getFacetedUniqueValues().keys())
    return values.sort()
  }, [table.getColumn("status")?.getFacetedUniqueValues()])

  // Get unique role values
  const uniqueRoleValues = useMemo(() => {
    const roleColumn = table.getColumn("role")
    if (!roleColumn) return []
    const values = Array.from(roleColumn.getFacetedUniqueValues().keys())
    return values.sort()
  }, [table.getColumn("role")?.getFacetedUniqueValues()])

  // Get counts for each status
  const statusCounts = useMemo(() => {
    const statusColumn = table.getColumn("status")
    if (!statusColumn) return new Map()
    return statusColumn.getFacetedUniqueValues()
  }, [table.getColumn("status")?.getFacetedUniqueValues()])

  // Get counts for each role
  const roleCounts = useMemo(() => {
    const roleColumn = table.getColumn("role")
    if (!roleColumn) return new Map()
    return roleColumn.getFacetedUniqueValues()
  }, [table.getColumn("role")?.getFacetedUniqueValues()])

  const selectedStatuses = useMemo(() => {
    const filterValue = table.getColumn("status")?.getFilterValue() as string[]
    return filterValue ?? []
  }, [table.getColumn("status")?.getFilterValue()])

  const selectedRoles = useMemo(() => {
    const filterValue = table.getColumn("role")?.getFilterValue() as string[]
    return filterValue ?? []
  }, [table.getColumn("role")?.getFilterValue()])

  const handleStatusChange = (checked: boolean, value: string) => {
    const filterValue = table.getColumn("status")?.getFilterValue() as string[]
    const newFilterValue = filterValue ? [...filterValue] : []

    if (checked) {
      newFilterValue.push(value)
    } else {
      const index = newFilterValue.indexOf(value)
      if (index > -1) {
        newFilterValue.splice(index, 1)
      }
    }

    table
      .getColumn("status")
      ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined)
  }

  const handleRoleChange = (checked: boolean, value: string) => {
    const filterValue = table.getColumn("role")?.getFilterValue() as string[]
    const newFilterValue = filterValue ? [...filterValue] : []

    if (checked) {
      newFilterValue.push(value)
    } else {
      const index = newFilterValue.indexOf(value)
      if (index > -1) {
        newFilterValue.splice(index, 1)
      }
    }

    table
      .getColumn("role")
      ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Filter by name or email */}
          <div className="relative">
            <Input
              id={`${id}-input`}
              ref={inputRef}
              className={cn(
                "peer min-w-60 ps-9",
                Boolean(table.getColumn("name")?.getFilterValue()) && "pe-9"
              )}
              value={
                (table.getColumn("name")?.getFilterValue() ?? "") as string
              }
              onChange={(e) =>
                table.getColumn("name")?.setFilterValue(e.target.value)
              }
              placeholder="Filtrer par nom ou email..."
              type="text"
              aria-label="Filtrer par nom ou email"
            />
            <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
              <ListFilterIcon size={16} aria-hidden="true" />
            </div>
            {Boolean(table.getColumn("name")?.getFilterValue()) && (
              <button
                className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Effacer le filtre"
                onClick={() => {
                  table.getColumn("name")?.setFilterValue("")
                  if (inputRef.current) {
                    inputRef.current.focus()
                  }
                }}
              >
                <CircleXIcon size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          
          {/* Filter by status */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <FilterIcon
                  className="-ms-1 opacity-60"
                  size={16}
                  aria-hidden="true"
                />
                Statut
                {selectedStatuses.length > 0 && (
                  <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                    {selectedStatuses.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-36 p-3" align="start">
              <div className="space-y-3">
                <div className="text-muted-foreground text-xs font-medium">
                  Filtres
                </div>
                <div className="space-y-3">
                  {uniqueStatusValues.map((value, i) => (
                    <div key={value} className="flex items-center gap-2">
                      <Checkbox
                        id={`${id}-status-${i}`}
                        checked={selectedStatuses.includes(value)}
                        onCheckedChange={(checked: boolean) =>
                          handleStatusChange(checked, value)
                        }
                      />
                      <Label
                        htmlFor={`${id}-status-${i}`}
                        className="flex grow justify-between gap-2 font-normal"
                      >
                        {value}{" "}
                        <span className="text-muted-foreground ms-2 text-xs">
                          {statusCounts.get(value)}
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Filter by role */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <UserCog
                  className="-ms-1 opacity-60"
                  size={16}
                  aria-hidden="true"
                />
                Rôle
                {selectedRoles.length > 0 && (
                  <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                    {selectedRoles.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-36 p-3" align="start">
              <div className="space-y-3">
                <div className="text-muted-foreground text-xs font-medium">
                  Filtres
                </div>
                <div className="space-y-3">
                  {uniqueRoleValues.map((value, i) => (
                    <div key={value} className="flex items-center gap-2">
                      <Checkbox
                        id={`${id}-role-${i}`}
                        checked={selectedRoles.includes(value)}
                        onCheckedChange={(checked: boolean) =>
                          handleRoleChange(checked, value)
                        }
                      />
                      <Label
                        htmlFor={`${id}-role-${i}`}
                        className="flex grow justify-between gap-2 font-normal"
                      >
                        {value}{" "}
                        <span className="text-muted-foreground ms-2 text-xs">
                          {roleCounts.get(value)}
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Toggle columns visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Columns3Icon
                  className="-ms-1 opacity-60"
                  size={16}
                  aria-hidden="true"
                />
                Colonnes
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Afficher/Masquer les colonnes</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  const columnNames: Record<string, string> = {
                    name: "Nom",
                    email: "Email",
                    role: "Rôle",
                    status: "Statut",
                    lastLogin: "Dernière connexion",
                    // emailsSent: "Emails envoyés", // TODO: À réactiver plus tard
                    // responseRate: "Taux de réponse", // TODO: À réactiver plus tard
                  }
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                      onSelect={(event) => event.preventDefault()}
                    >
                      {columnNames[column.id] || column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-3">
          {/* Delete button */}
          {table.getSelectedRowModel().rows.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="ml-auto" variant="outline">
                  <TrashIcon
                    className="-ms-1 opacity-60"
                    size={16}
                    aria-hidden="true"
                  />
                  Supprimer
                  <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                    {table.getSelectedRowModel().rows.length}
                  </span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border"
                    aria-hidden="true"
                  >
                    <CircleAlertIcon className="opacity-80" size={16} />
                  </div>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Êtes-vous sûr ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Cela supprimera définitivement{" "}
                      {table.getSelectedRowModel().rows.length}{" "}
                      {table.getSelectedRowModel().rows.length === 1
                        ? "utilisateur"
                        : "utilisateurs"} sélectionné{table.getSelectedRowModel().rows.length > 1 ? "s" : ""}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteRows}>
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {/* Add user button */}
          <AddUserModal onAddUser={handleAddUser} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-background overflow-hidden rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                      className="h-11"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          className={cn(
                            header.column.getCanSort() &&
                              "flex h-full cursor-pointer items-center justify-between gap-2 select-none"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={(e) => {
                            if (
                              header.column.getCanSort() &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              e.preventDefault()
                              header.column.getToggleSortingHandler()?.(e)
                            }
                          }}
                          tabIndex={header.column.getCanSort() ? 0 : undefined}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: (
                              <ChevronUpIcon
                                className="shrink-0 opacity-60"
                                size={16}
                                aria-hidden="true"
                              />
                            ),
                            desc: (
                              <ChevronDownIcon
                                className="shrink-0 opacity-60"
                                size={16}
                                aria-hidden="true"
                              />
                            ),
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Chargement des utilisateurs...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-red-600"
                >
                  <div className="flex flex-col items-center">
                    <CircleXIcon className="h-6 w-6 mb-2" />
                    <span>Erreur: {error}</span>
                    <button
                      onClick={fetchUsers}
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      Réessayer
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="last:py-0">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Aucun utilisateur trouvé.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-8">
        {/* Results per page */}
        <div className="flex items-center gap-3">
          <Label htmlFor={id} className="max-sm:sr-only">
            Lignes par page
          </Label>
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger id={id} className="w-fit whitespace-nowrap">
              <SelectValue placeholder="Sélectionner le nombre de résultats" />
            </SelectTrigger>
            <SelectContent className="[&_*[role=option]]:ps-2 [&_*[role=option]]:pe-8 [&_*[role=option]>span]:start-auto [&_*[role=option]>span]:end-2">
              {[5, 10, 25, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={pageSize.toString()}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Page number information */}
        <div className="text-muted-foreground flex grow justify-end text-sm whitespace-nowrap">
          <p
            className="text-muted-foreground text-sm whitespace-nowrap"
            aria-live="polite"
          >
            <span className="text-foreground">
              {table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
                1}
              -
              {Math.min(
                Math.max(
                  table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                    table.getState().pagination.pageSize,
                  0
                ),
                totalUsers
              )}
            </span>{" "}
            sur{" "}
            <span className="text-foreground">
              {totalUsers.toString()}
            </span>
          </p>
        </div>

        {/* Pagination buttons */}
        <div>
          <Pagination>
            <PaginationContent>
              {/* First page button */}
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.firstPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Aller à la première page"
                >
                  <ChevronFirstIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
              {/* Previous page button */}
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Aller à la page précédente"
                >
                  <ChevronLeftIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
              {/* Next page button */}
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Aller à la page suivante"
                >
                  <ChevronRightIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
              {/* Last page button */}
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.lastPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Aller à la dernière page"
                >
                  <ChevronLastIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  )
}

function RowActions({ row, onUpdate, onDelete }: {
  row: Row<UserItem>
  onUpdate: (userId: string, data: { status?: 'active' | 'inactive'; role?: 'admin' | 'user' | 'viewer' }) => Promise<void>
  onDelete: (userId: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  const handleStatusToggle = async () => {
    setLoading(true)
    try {
      const newStatus = row.original.status === "active" ? "inactive" : "active"
      await onUpdate(row.original.id, { status: newStatus })
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (newRole: 'admin' | 'user' | 'viewer') => {
    setLoading(true)
    try {
      await onUpdate(row.original.id, { role: newRole })
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await onDelete(row.original.id)
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex justify-end">
          <Button
            size="icon"
            variant="ghost"
            className="shadow-none"
            aria-label="Actions pour l'utilisateur"
            disabled={loading}
          >
            <EllipsisIcon size={16} aria-hidden="true" />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <UserCog className="mr-2 h-4 w-4" />
              <span>Changer le rôle</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onClick={() => handleRoleChange('admin')}
                  disabled={loading || row.original.role === 'admin'}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Admin</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleRoleChange('user')}
                  disabled={loading || row.original.role === 'user'}
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  <span>Utilisateur</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleRoleChange('viewer')}
                  disabled={loading || row.original.role === 'viewer'}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Lecteur</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleStatusToggle} disabled={loading}>
            {row.original.status === "active" ? (
              <>
                <UserX className="mr-2 h-4 w-4" />
                <span>Désactiver</span>
              </>
            ) : (
              <>
                <User className="mr-2 h-4 w-4" />
                <span>Activer</span>
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              <span>Supprimer</span>
              <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-full border"
                aria-hidden="true"
              >
                <CircleAlertIcon className="opacity-80" size={16} />
              </div>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Êtes-vous sûr ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. L'utilisateur "{row.original.name}"
                  sera définitivement supprimé.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={loading}>
                {loading ? "Suppression..." : "Supprimer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}