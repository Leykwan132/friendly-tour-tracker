import { useMemo, useState } from "react";

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
}

export function SortableTable<T>({
  columns,
  data,
  defaultSortKey,
  defaultDirection = "desc",
  emptyMessage = "No data yet.",
  rowKey,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

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
    <div className="table-scroll">
      <table className="data-table">
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
          {sortedData.map((row) => (
            <tr key={rowKey(row)}>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
