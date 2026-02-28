"use client";

import { useMemo, useState } from "react";
import type { ProjectHealth, ProjectHealthMatrixItem, UnifiedProject } from "@/lib/data";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProjectTableProps {
  projects: UnifiedProject[];
  matrix: ProjectHealthMatrixItem[];
}

type BudgetStatus = "On Track" | "At Risk" | "Over Budget";

interface TableRowData {
  id: string;
  name: string;
  type: string;
  contractValue: number;
  percentComplete: number;
  budgetStatus: BudgetStatus;
  budgetHealth: ProjectHealth;
  stage: UnifiedProject["status"];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const budgetStatusByHealth: Record<ProjectHealth, BudgetStatus> = {
  good: "On Track",
  warning: "At Risk",
  critical: "Over Budget",
};

const badgeClassByHealth: Record<ProjectHealth, string> = {
  good: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  warning: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  critical: "border-rose-400/30 bg-rose-500/15 text-rose-300",
};

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") {
    return <ArrowUp className="h-3.5 w-3.5 text-slate-300" />;
  }

  if (direction === "desc") {
    return <ArrowDown className="h-3.5 w-3.5 text-slate-300" />;
  }

  return <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />;
}

export function ProjectTable({ projects, matrix }: ProjectTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const healthByProjectId = useMemo(
    () => new Map(matrix.map((item) => [item.projectId, item.health])),
    [matrix]
  );

  const data = useMemo<TableRowData[]>(
    () =>
      projects.map((project) => {
        const health = healthByProjectId.get(project.id) ?? "good";

        return {
          id: project.id,
          name: project.name,
          type: project.type,
          contractValue: project.totalValue,
          percentComplete: project.percentComplete,
          budgetStatus: budgetStatusByHealth[health],
          budgetHealth: health,
          stage: project.status,
        };
      }),
    [healthByProjectId, projects]
  );

  const columns = useMemo<ColumnDef<TableRowData>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1.5 text-slate-300 transition hover:text-slate-100"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Project Name
            <SortIndicator direction={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <div className="font-medium text-slate-100">{row.original.name}</div>
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1.5 text-slate-300 transition hover:text-slate-100"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Type
            <SortIndicator direction={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => <span className="text-slate-300">{row.original.type}</span>,
      },
      {
        accessorKey: "contractValue",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1.5 text-slate-300 transition hover:text-slate-100"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Contract Value ($)
            <SortIndicator direction={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-slate-300">
            {currencyFormatter.format(row.original.contractValue)}
          </span>
        ),
      },
      {
        accessorKey: "percentComplete",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1.5 text-slate-300 transition hover:text-slate-100"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            % Complete
            <SortIndicator direction={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => {
          const percent = row.original.percentComplete;

          return (
            <div className="flex min-w-[180px] items-center gap-3">
              <div className="h-2 w-full rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-amber-500"
                  style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-medium text-slate-300">
                {percent}%
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "budgetStatus",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1.5 text-slate-300 transition hover:text-slate-100"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Budget Status
            <SortIndicator direction={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={badgeClassByHealth[row.original.budgetHealth]}
          >
            {row.original.budgetStatus}
          </Badge>
        ),
      },
      {
        accessorKey: "stage",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1.5 text-slate-300 transition hover:text-slate-100"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Stage
            <SortIndicator direction={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => <span className="text-slate-300">{row.original.stage}</span>,
      },
    ],
    []
  );

  // TanStack Table is currently flagged by React Compiler lint as incompatible.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table className="w-full">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="border-slate-800 hover:bg-transparent">
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className="h-11 text-xs uppercase tracking-wide text-slate-400"
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow className="border-slate-800 hover:bg-transparent">
            <TableCell colSpan={columns.length} className="h-24 text-center text-slate-500">
              No projects found.
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer border-slate-800 hover:bg-slate-800/40"
              onClick={() => router.push(`/projects/${row.original.id}`)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="py-3 text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
