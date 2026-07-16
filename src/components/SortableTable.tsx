import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export type SortDirection = "asc" | "desc";

export interface Column<T> {
  key: string;
  label: string;
  sortValue?: (row: T) => string | number;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface SortableTableProps<T> {
  columns: Column<T>[];
  data: T[];
  defaultSortKey: string;
  defaultDirection?: SortDirection;
  emptyMessage?: string;
  rowKey: (row: T) => string | number;
  compact?: boolean;
  initialLimit?: number;
  expandedRowKey?: string | number | null;
  onRowClick?: (row: T) => void;
  renderExpandedRow?: (row: T) => React.ReactNode;
}

export function SortableTable<T>({
  columns,
  data,
  defaultSortKey,
  defaultDirection = "desc",
  emptyMessage = "No data yet.",
  rowKey,
  compact = false,
  initialLimit,
  expandedRowKey = null,
  onRowClick,
  renderExpandedRow,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);
  const [showAll, setShowAll] = useState(false);

  const sortedData = useMemo(() => {
    const column = columns.find((col) => col.key === sortKey);
    if (!column?.sortValue) return data;

    return [...data].sort((a, b) => {
      const aVal = column.sortValue!(a);
      const bVal = column.sortValue!(b);

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [columns, data, sortDirection, sortKey]);

  const visibleData = useMemo(() => {
    if (!initialLimit || showAll || sortedData.length <= initialLimit) {
      return sortedData;
    }
    return sortedData.slice(0, initialLimit);
  }, [initialLimit, showAll, sortedData]);

  const canExpand = initialLimit !== undefined && sortedData.length > initialLimit;

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  }

  if (data.length === 0) {
    return <p className="empty-message">{emptyMessage}</p>;
  }

  return (
    <div className="sortable-table">
      <div className={compact ? "table-scroll compact-table-scroll" : "table-scroll"}>
        <table className={compact ? "data-table compact-table" : "data-table"}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.align ? `align-${column.align}` : undefined}
                >
                  <button
                    type="button"
                    className={`sort-button${sortKey === column.key ? " active" : ""}`}
                    onClick={() => toggleSort(column.key)}
                  >
                    {column.label}
                    {sortKey === column.key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row) => {
              const key = rowKey(row);
              const isExpanded = expandedRowKey != null && key === expandedRowKey;

              return (
                <Fragment key={key}>
                  <tr
                    className={[
                      onRowClick ? "clickable-row" : "",
                      isExpanded ? "expanded-row" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={column.align ? `align-${column.align}` : undefined}
                      >
                        {column.render
                          ? column.render(row)
                          : String((row as Record<string, unknown>)[column.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpandedRow && (
                    <tr className="expanded-detail-row">
                      <td colSpan={columns.length}>{renderExpandedRow(row)}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {canExpand && (
        <div className="table-expand-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAll((expanded) => !expanded)}
          >
            {showAll ? "Show less" : `Show all (${sortedData.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}
