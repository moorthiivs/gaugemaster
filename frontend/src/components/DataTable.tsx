import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Settings2,
  Search,
  Filter,
  X
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  pageCount: number
  pageIndex: number
  pageSize?: number
  totalItems?: number
  onPageChange: (index: number) => void
  onPageSizeChange?: (size: number) => void
  onRowClick?: (row: TData) => void
  rowSelection?: Record<string, boolean>
  onRowSelectionChange?: (selection: any) => void
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (visibility: VisibilityState) => void
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void
  headerActions?: React.ReactNode
  searchPlaceholder?: string
  searchTooltip?: string
  hideSearch?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading,
  pageCount,
  pageIndex,
  pageSize = 10,
  totalItems,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  rowSelection: externalRowSelection,
  onRowSelectionChange: externalOnRowSelectionChange,
  columnVisibility: externalColumnVisibility,
  onColumnVisibilityChange: externalOnColumnVisibilityChange,
  columnFilters: externalColumnFilters,
  onColumnFiltersChange: externalOnColumnFiltersChange,
  headerActions,
  searchPlaceholder = "Search in results...",
  searchTooltip,
  hideSearch = false,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [localColumnVisibility, setLocalColumnVisibility] = React.useState<VisibilityState>({})
  const [localRowSelection, setLocalRowSelection] = React.useState({})
  const [localColumnFilters, setLocalColumnFilters] = React.useState<ColumnFiltersState>([])
  const [searchOpen, setSearchOpen] = React.useState(false)

  const suggestions = React.useMemo(() => {
    if (hideSearch || !globalFilter || globalFilter.length < 1) return [];
    const lowerFilter = globalFilter.toLowerCase();
    const results = new Set<string>();
    
    // Use the table columns to ensure we only suggest things that can actually be searched
    const searchCols = columns.map(c => (c as any).accessorKey || c.id).filter(Boolean);
    
    data.forEach((row: any) => {
      searchCols.forEach(colKey => {
        if (!colKey) return;
        const val = row[colKey];
        if (val == null) return;
        
        if (typeof val === 'string' && val.length > 0 && val.length < 60) {
          let displayVal = val;
          // Check if it's an ISO date string
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
              displayVal = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth()+1).padStart(2, '0')}-${d.getFullYear()}`;
            }
          } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
            // Exclude UUIDs
            return;
          }

          if (displayVal.toLowerCase().includes(lowerFilter)) {
            results.add(displayVal);
          }
        } else if (typeof val === 'number') {
          if (String(val).toLowerCase().includes(lowerFilter)) {
            results.add(String(val));
          }
        }
      });
    });
    
    return Array.from(results).slice(0, 6);
  }, [globalFilter, data, columns, hideSearch]);

  const columnVisibility = externalColumnVisibility ?? localColumnVisibility
  const onColumnVisibilityChange = externalOnColumnVisibilityChange ?? setLocalColumnVisibility

  const rowSelection = externalRowSelection ?? localRowSelection
  const onRowSelectionChange = externalOnRowSelectionChange ?? setLocalRowSelection

  const columnFilters = externalColumnFilters ?? localColumnFilters
  const onColumnFiltersChange = externalOnColumnFiltersChange ?? setLocalColumnFilters

  const customGlobalFilterFn = (row: any, columnId: string, filterValue: string) => {
    const value = row.getValue(columnId);
    if (value == null) return false;
    let strVal = String(value);
    
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(strVal)) {
      const d = new Date(strVal);
      if (!isNaN(d.getTime())) {
        strVal = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth()+1).padStart(2, '0')}-${d.getFullYear()}`;
      }
    }
    
    return strVal.toLowerCase().includes(String(filterValue).toLowerCase());
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange,
    manualPagination: true,
    pageCount,
    globalFilterFn: customGlobalFilterFn,
    state: {
      rowSelection,
      columnVisibility,
      globalFilter,
      columnFilters,
    },
    onRowSelectionChange,
    onColumnVisibilityChange,
    onGlobalFilterChange: setGlobalFilter,
    enableRowSelection: true,
    getRowId: (row: any) => row.id,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-1 items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
          {!hideSearch && (
            <div className="relative w-full max-w-md group shrink-0" title={searchTooltip}>
              <Popover open={searchOpen && suggestions.length > 0} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                    <Input
                      placeholder={searchPlaceholder}
                      value={globalFilter ?? ""}
                      onChange={(event) => {
                        setGlobalFilter(event.target.value);
                        setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      className="h-10 pl-10 pr-10 bg-background/60 hover:bg-background/90 transition-all border-muted/30 focus-visible:ring-primary/40 focus-visible:border-primary/50 shadow-sm rounded-full w-full"
                    />
                    {globalFilter && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50"
                        onClick={() => {
                          setGlobalFilter("");
                          setSearchOpen(false);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl overflow-hidden shadow-xl border-muted/20" 
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="max-h-[300px] overflow-y-auto py-2">
                    <div className="px-4 pb-2 pt-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Suggestions
                    </div>
                    {suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 focus:bg-primary/10 focus:outline-none transition-colors flex items-center gap-3"
                        onClick={() => {
                          setGlobalFilter(suggestion);
                          setSearchOpen(false);
                        }}
                      >
                        <Search className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span className="truncate">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
          {headerActions}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto h-9 flex gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span>Columns</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px] max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id.replace(/_/g, " ")}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-xl border bg-card shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl border-muted/20">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          <Table>
            <TableHeader className="bg-gradient-to-r from-muted/50 to-muted/30">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-muted/20">
                  {headerGroup.headers.map((header, index) => {
                    const isFirst = index === 0;
                    const isLast = index === headerGroup.headers.length - 1;
                    return (
                      <TableHead key={header.id} className={`font-bold text-foreground/80 py-3 px-6 h-auto ${isFirst ? 'text-left' : isLast ? 'text-right' : 'text-center'}`}>
                        <div className="flex flex-col gap-2">
                          <div className={`flex items-center gap-2 group ${isFirst ? 'justify-start' : isLast ? 'justify-end' : 'justify-center'}`}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                            
                            {header.column.getCanFilter() && header.column.columnDef.meta && (header.column.columnDef.meta as any).enableFilter && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className={`h-6 w-6 p-0 hover:bg-primary/10 ${header.column.getFilterValue() ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'}`}
                                  >
                                    <Filter className="h-3 w-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60 p-3" align="start">
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Filter {header.id}</h4>
                                    {(header.column.columnDef.meta as any).filterOptions ? (
                                      <Select
                                        value={(header.column.getFilterValue() as string) ?? "all"}
                                        onValueChange={(value) => 
                                          header.column.setFilterValue(value === "all" ? "" : value)
                                        }
                                      >
                                        <SelectTrigger className="h-9 w-full bg-background/50 border-muted/20">
                                          <SelectValue placeholder="All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="all">All</SelectItem>
                                          {(header.column.columnDef.meta as any).filterOptions.map((opt: string) => (
                                            <SelectItem key={opt} value={opt}>
                                              {opt}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <div className="relative">
                                        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                          placeholder={`Search...`}
                                          value={(header.column.getFilterValue() as string) ?? ""}
                                          onChange={(event) =>
                                            header.column.setFilterValue(event.target.value)
                                          }
                                          className="h-9 pl-7 bg-background/50 border-muted/20"
                                        />
                                      </div>
                                    )}
                                    {header.column.getFilterValue() && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="w-full h-7 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => header.column.setFilterValue("")}
                                      >
                                        Clear Filter
                                      </Button>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-muted/10 last:border-0">
                    {columns.filter(c => true).map((_, j) => (
                      <TableCell key={j} className="py-5 px-6">
                        <Skeleton className="h-5 w-full rounded-full opacity-60" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={`group transition-all hover:bg-primary/5 border-b border-muted/10 last:border-0 ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell, index) => {
                      const isFirst = index === 0;
                      const isLast = index === row.getVisibleCells().length - 1;
                      return (
                        <TableCell key={cell.id} className={`py-4 px-6 text-sm font-medium ${isFirst ? 'text-left' : isLast ? 'text-right' : 'text-center'}`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-60 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-500">
                      <div className="bg-muted/30 p-6 rounded-full">
                        <Settings2 className="h-12 w-12 text-muted-foreground/40" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xl font-semibold text-muted-foreground">No records found</p>
                        <p className="text-sm text-muted-foreground/60 max-w-[250px] mx-auto">We couldn't find any instruments matching your current filters.</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => onPageChange(1)}>
                        Clear all filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 px-2 py-1">
        <div className="text-sm font-medium text-muted-foreground order-3 lg:order-1">
          Showing <span className="text-foreground">{(pageIndex - 1) * pageSize + 1}</span> to <span className="text-foreground">{Math.min(pageIndex * pageSize, totalItems || 0)}</span> of <span className="text-foreground">{totalItems}</span> results
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-8 order-1 lg:order-2">
          {/* Page Navigation Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hidden sm:flex"
              onClick={() => onPageChange(1)}
              disabled={pageIndex <= 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(pageIndex - 1)}
              disabled={pageIndex <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center px-2 text-sm font-medium">
              Page <span className="mx-1 text-foreground">{pageIndex}</span> of <span className="mx-1 text-foreground">{pageCount}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(pageIndex + 1)}
              disabled={pageIndex >= pageCount}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hidden sm:flex"
              onClick={() => onPageChange(pageCount)}
              disabled={pageIndex >= pageCount}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Go to Page Input */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Go to page:</span>
            <Input
              type="number"
              min={1}
              max={pageCount}
              defaultValue={pageIndex}
              key={pageIndex} // Ensure the input resets when page changes externally
              className="h-8 w-16 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = parseInt(e.currentTarget.value)
                  if (val >= 1 && val <= pageCount) {
                    onPageChange(val)
                  }
                }
              }}
              onBlur={(e) => {
                const val = parseInt(e.currentTarget.value)
                if (val >= 1 && val <= pageCount && val !== pageIndex) {
                  onPageChange(val)
                } else {
                  e.currentTarget.value = String(pageIndex)
                }
              }}
            />
          </div>

          {/* Page Size Selector */}
          {onPageSizeChange && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Rows per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => onPageSizeChange(Number(v))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
