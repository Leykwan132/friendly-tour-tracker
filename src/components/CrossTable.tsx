import { useMemo } from "react";
import type { CrossTableData } from "../types";

interface CrossTableProps {
  data: CrossTableData;
}

export function CrossTable({ data }: CrossTableProps) {
  const cellMap = useMemo(() => {
    const map = new Map<string, CrossTableData["cells"][number]>();
    for (const cell of data.cells) {
      map.set(`${cell.rowId}-${cell.colId}`, cell);
    }
    return map;
  }, [data.cells]);

  if (data.players.length === 0) {
    return <p className="empty-message">Add players and matches to see head-to-head records.</p>;
  }

  return (
    <div className="cross-table-scroll">
      <table className="cross-table">
        <thead>
          <tr>
            <th className="corner-cell" />
            {data.players.map((player) => (
              <th key={player.id} className="col-header">
                <span className="header-label" title={player.name}>
                  {player.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.players.map((rowPlayer) => (
            <tr key={rowPlayer.id}>
              <th className="row-header">
                <span className="header-label" title={rowPlayer.name}>
                  {rowPlayer.name}
                </span>
              </th>
              {data.players.map((colPlayer) => {
                if (rowPlayer.id === colPlayer.id) {
                  return <td key={colPlayer.id} className="cross-cell diagonal" />;
                }

                const cell = cellMap.get(`${rowPlayer.id}-${colPlayer.id}`);

                if (!cell || cell.games === 0) {
                  return <td key={colPlayer.id} className="cross-cell empty" />;
                }

                return (
                  <td key={colPlayer.id} className="cross-cell filled">
                    <span className="cell-record">
                      {cell.wins}W-{cell.losses}L
                    </span>
                    <span className="cell-pct">{cell.winPct}%</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
